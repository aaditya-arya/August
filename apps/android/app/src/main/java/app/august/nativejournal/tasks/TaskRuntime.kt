package app.august.nativejournal.tasks

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.*
import app.august.nativejournal.AugustApplication
import app.august.nativejournal.MainActivity
import app.august.nativejournal.R
import app.august.nativejournal.data.*
import kotlinx.coroutines.CancellationException
import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.withTimeoutOrNull

object TaskRuntime {
    const val CHANNEL = "august-task-deadlines"
    private const val REMINDERS = "august-task-reminders"
    private const val SYNC = "august-task-sync"
    private val revision = AtomicLong()
    fun identity(value: String) = MessageDigest.getInstance("SHA-256").digest(value.toByteArray()).take(16).joinToString("") { "%02x".format(it) }
    fun canNotify(context: Context): Boolean {
        val channel = context.getSystemService(NotificationManager::class.java).getNotificationChannel(CHANNEL)
        return NotificationManagerCompat.from(context).areNotificationsEnabled() && channel?.importance != NotificationManager.IMPORTANCE_NONE &&
            (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
    }

    fun openTasks(context: Context, request: Int = 0): PendingIntent = PendingIntent.getActivity(context, request,
        Intent(context, MainActivity::class.java).putExtra("open_tasks", true).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    fun sync(context: Context) {
        WorkManager.getInstance(context).enqueueUniqueWork("august-task-manual-sync", ExistingWorkPolicy.KEEP,
            OneTimeWorkRequestBuilder<SyncTasksWorker>().setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build())
    }

    @Synchronized
    fun update(context: Context, snapshot: DeviceState) {
        val device = (context.applicationContext as? AugustApplication)?.repository?.state?.value ?: snapshot
        val version = revision.incrementAndGet()
        val work = WorkManager.getInstance(context)
        val account = device.accountKey()
        val tasks = device.cachedTasks[account].orEmpty()
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "Task deadlines", NotificationManager.IMPORTANCE_DEFAULT).apply { description = "One day and one hour before task deadlines" })
        manager.activeNotifications.filter { notification -> notification.tag == CHANNEL &&
            (!device.taskRemindersEnabled || notification.notification.extras.getString("account") != account || tasks.none { it.id == notification.notification.extras.getString("task_id") && !it.completed })
        }.forEach { manager.cancel(it.tag, it.id) }
        TaskWidget.render(context, device)
        if (account == null) { work.cancelAllWorkByTag(REMINDERS); work.cancelUniqueWork(SYNC); return }
        work.enqueueUniquePeriodicWork(SYNC, ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<SyncTasksWorker>(15, TimeUnit.MINUTES).setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build())
        if (!device.taskRemindersEnabled || !canNotify(context)) { work.cancelAllWorkByTag(REMINDERS); return }
        // Cancel only obsolete task/deadline jobs. Replacing every job on sync
        // could cancel a reminder that is currently delivering for another task.
        val validSchedules = tasks.filter { !it.completed && it.dueAt != null }.map { "task-schedule-${identity("$account|${it.id}|${it.dueAt}")}" }.toSet()
        val pending = work.getWorkInfosByTag(REMINDERS)
        pending.addListener({
            if (version == revision.get()) runCatching { pending.get().filter { !it.state.isFinished && it.tags.none { tag -> tag in validSchedules } }.forEach { work.cancelWorkById(it.id) } }
        }, ContextCompat.getMainExecutor(context))
        val now = Instant.now().epochSecond
        reminderPlan(tasks, now).filterNot { "${identity(account)}|${it.identity}" in device.deliveredTaskReminders }.forEach { reminder ->
            val record = "${identity(account)}|${reminder.identity}"
            val data = workDataOf("account" to account, "task_id" to reminder.taskId, "due_at" to reminder.dueAt, "record" to record, "label" to reminder.label)
            work.enqueueUniqueWork("task-reminder-${identity(record)}", ExistingWorkPolicy.KEEP,
                OneTimeWorkRequestBuilder<TaskReminderWorker>().setInputData(data).setInitialDelay(reminder.at - now, TimeUnit.SECONDS).addTag(REMINDERS)
                    .addTag("task-schedule-${identity("$account|${reminder.taskId}|${reminder.dueAt}")}").build())
        }
    }

    @Synchronized
    fun notifyIfCurrent(context: Context, account: String, task: JournalTask, notification: Notification) {
        val latest = (context.applicationContext as AugustApplication).repository.state.value
        if (latest.accountKey() == account && latest.taskRemindersEnabled && canNotify(context) &&
            latest.cachedTasks[account].orEmpty().any { it.id == task.id && !it.completed && it.dueAt == task.dueAt } &&
            (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)) {
            NotificationManagerCompat.from(context).notify(CHANNEL, task.id.hashCode(), notification)
        }
    }
}

class SyncTasksWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result {
        val repository = (applicationContext.applicationContext as AugustApplication).repository
        return try { repository.initialize(); if (repository.state.value.session != null) repository.tasks(); TaskWidget.render(applicationContext, repository.state.value); Result.success() }
        catch (error: Exception) {
            if (error is CancellationException) throw error
            TaskWidget.render(applicationContext, repository.state.value, "Couldn't sync. Tap to open Tasks.")
            if (runAttemptCount < 2) Result.retry() else Result.failure()
        }
    }
}

class CompleteTaskWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result {
        val repository = (applicationContext.applicationContext as AugustApplication).repository
        return try {
            repository.initialize()
            if (repository.state.value.accountKey() != inputData.getString("account")) return Result.success()
            val id = inputData.getString("task_id") ?: return Result.failure()
            repository.completeTask(id, true)
            Result.success()
        } catch (error: Exception) {
            if (error is CancellationException) throw error
            TaskWidget.render(applicationContext, repository.state.value, "Couldn't finish that. Tap to retry in Tasks.")
            Result.failure() // Keep the task open; never claim an unsaved completion.
        }
    }
}

class TaskReminderWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result {
        val repository = (applicationContext.applicationContext as AugustApplication).repository
        return try {
            repository.initialize()
            val account = inputData.getString("account") ?: return Result.success()
            if (repository.state.value.accountKey() != account) return Result.success()
            // Reconcile completion from the website before notifying when a
            // connection is available. Offline reminders use the encrypted cache.
            withTimeoutOrNull(8_000) { try { repository.tasks() } catch (error: Exception) { if (error is CancellationException) throw error } }
            val device = repository.state.value
            if (device.accountKey() != account || !device.taskRemindersEnabled || !TaskRuntime.canNotify(applicationContext)) return Result.success()
            val task = device.cachedTasks[account].orEmpty().find { it.id == inputData.getString("task_id") && !it.completed && it.dueAt == inputData.getString("due_at") } ?: return Result.success()
            val record = inputData.getString("record") ?: return Result.success()
            if (!repository.claimReminder(account, record)) return Result.success()
            val public = NotificationCompat.Builder(applicationContext, TaskRuntime.CHANNEL).setSmallIcon(R.drawable.ic_task_check).setContentTitle("August task reminder").setContentText("Open August to see your task.").build()
            val due = Instant.parse(task.dueAt)
            val deadline = DateTimeFormatter.ofPattern("MMM d · h:mm a").withZone(ZoneId.systemDefault()).format(due)
            val notification = NotificationCompat.Builder(applicationContext, TaskRuntime.CHANNEL).setSmallIcon(R.drawable.ic_task_check)
                .setContentTitle(task.title).setContentText("${if (due.isBefore(Instant.now())) "Deadline was" else "Due"} $deadline")
                .setContentIntent(TaskRuntime.openTasks(applicationContext, task.id.hashCode())).setAutoCancel(true)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setPublicVersion(public)
                .setExtras(android.os.Bundle().apply { putString("account", account); putString("task_id", task.id) }).build()
            TaskRuntime.notifyIfCurrent(applicationContext, account, task, notification)
            Result.success()
        } catch (error: Exception) { if (error is CancellationException) throw error; Result.failure() }
    }
}
