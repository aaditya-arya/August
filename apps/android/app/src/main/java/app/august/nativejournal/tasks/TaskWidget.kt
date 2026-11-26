package app.august.nativejournal.tasks

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import androidx.core.net.toUri
import androidx.work.*
import app.august.nativejournal.AugustApplication
import app.august.nativejournal.R
import app.august.nativejournal.data.DeviceState
import app.august.nativejournal.data.accountKey
import kotlinx.coroutines.*
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class TaskWidget : AppWidgetProvider() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            COMPLETE -> {
                val account = intent.getStringExtra("account") ?: return
                val id = intent.getStringExtra("task_id") ?: return
                WorkManager.getInstance(context).enqueueUniqueWork("widget-complete-${TaskRuntime.identity("$account|$id")}", ExistingWorkPolicy.KEEP,
                    OneTimeWorkRequestBuilder<CompleteTaskWorker>().setInputData(workDataOf("account" to account, "task_id" to id)).build())
            }
            REFRESH -> TaskRuntime.sync(context)
            else -> super.onReceive(context, intent)
        }
    }
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) = load(context)
    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) = load(context)
    private fun load(context: Context) {
        val result = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try { val repository = (context.applicationContext as AugustApplication).repository; repository.initialize(); render(context, repository.state.value); TaskRuntime.sync(context) }
            catch (_: Exception) { render(context, DeviceState(), "Open August to reconnect your tasks.") }
            finally { result.finish() }
        }
    }
    companion object {
        const val COMPLETE = "app.august.nativejournal.COMPLETE_TASK"
        const val REFRESH = "app.august.nativejournal.REFRESH_TASKS"
        fun render(context: Context, state: DeviceState, status: String? = null) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, TaskWidget::class.java))
            val account = state.accountKey()
            val tasks = state.cachedTasks[account].orEmpty().filterNot { it.completed }.sortedWith(compareBy({ it.dueAt ?: "9999" }, { it.createdAt }))
            ids.forEach { widget ->
                val views = RemoteViews(context.packageName, R.layout.task_widget)
                views.setOnClickPendingIntent(R.id.widget_header, TaskRuntime.openTasks(context, widget))
                views.setTextViewText(R.id.widget_count, if (account == null) "Sign in to see your tasks" else "${tasks.size} things to move forward")
                views.removeAllViews(R.id.widget_tasks)
                val maxRows = ((manager.getAppWidgetOptions(widget).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 250) - 120) / 56).coerceIn(1, 8)
                tasks.take(maxRows).forEach { task ->
                    val row = RemoteViews(context.packageName, R.layout.task_widget_row)
                    row.setTextViewText(R.id.widget_task_title, task.title)
                    val due = task.dueAt?.let { runCatching { DateTimeFormatter.ofPattern("MMM d · h:mm a").withZone(ZoneId.systemDefault()).format(Instant.parse(it)) }.getOrNull() } ?: "No deadline"
                    row.setTextViewText(R.id.widget_task_due, due)
                    row.setOnClickPendingIntent(R.id.widget_task_text, TaskRuntime.openTasks(context, task.id.hashCode()))
                    val intent = Intent(context, TaskWidget::class.java).setAction(COMPLETE)
                        .setData("augusttaskwidget://complete/${TaskRuntime.identity(account.orEmpty())}/${task.id}".toUri())
                        .putExtra("account", account).putExtra("task_id", task.id)
                    row.setOnClickPendingIntent(R.id.widget_task_check, PendingIntent.getBroadcast(context, task.id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
                    views.addView(R.id.widget_tasks, row)
                }
                views.setViewVisibility(R.id.widget_empty, if (tasks.isEmpty()) View.VISIBLE else View.GONE)
                views.setTextViewText(R.id.widget_empty, if (account == null) "Open August to connect your journal." else "A clear little space. Add a task in August.")
                views.setTextViewText(R.id.widget_status, status ?: if (tasks.size > maxRows) "+${tasks.size - maxRows} more · Open Tasks" else "Tap a circle to finish · Refresh ↻")
                views.setOnClickPendingIntent(R.id.widget_status, if (tasks.size > maxRows) TaskRuntime.openTasks(context, widget) else PendingIntent.getBroadcast(context, widget,
                    Intent(context, TaskWidget::class.java).setAction(REFRESH), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
                try { manager.updateAppWidget(widget, views) } catch (_: IllegalArgumentException) { /* The launcher may have just removed this widget. */ }
            }
        }
    }
}
