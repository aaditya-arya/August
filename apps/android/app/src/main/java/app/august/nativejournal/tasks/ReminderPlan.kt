package app.august.nativejournal.tasks

import app.august.nativejournal.data.JournalTask
import java.time.Instant

data class TaskReminder(val taskId: String, val dueAt: String, val at: Long, val label: String) {
    val identity get() = "$taskId|$dueAt|$at"
}

fun reminderPlan(tasks: List<JournalTask>, now: Long = Instant.now().epochSecond): List<TaskReminder> = tasks.filterNot { it.completed }.flatMap { task ->
    val due = task.dueAt?.let { runCatching { Instant.parse(it).epochSecond }.getOrNull() }
    if (due == null || due <= now) emptyList()
    else {
        val before = listOf(86_400L to "Due tomorrow", 3_600L to "Due in one hour").filter { due - it.first > now }
        if (before.isEmpty()) listOf(TaskReminder(task.id, task.dueAt, due, "Your task is due"))
        else before.map { (offset, label) -> TaskReminder(task.id, task.dueAt, due - offset, label) }
    }
}
