package app.august.nativejournal

import app.august.nativejournal.data.JournalTask
import app.august.nativejournal.tasks.reminderPlan
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class ReminderPlanTest {
    private val now = Instant.parse("2026-11-26T10:00:00Z")
    private fun task(id: String, due: Long?, completed: Boolean = false) = JournalTask(id, "Build a website", "My own task", due?.let { now.plusSeconds(it).toString() }, completed = completed, updatedAt = now.toString(), createdAt = now.toString())
    @Test fun deadlinesScheduleOneDayAndOneHourBefore() {
        val plan = reminderPlan(listOf(task("a", 172800)), now.epochSecond)
        assertEquals(listOf(now.epochSecond + 86400, now.epochSecond + 169200), plan.map { it.at })
    }
    @Test fun journalReminderNotifiesAtItsOwnTime() {
        val reminder = task("call", 172800).copy(kind = "reminder")
        val plan = reminderPlan(listOf(reminder, task("unset", null).copy(kind = "reminder")), now.epochSecond)
        assertEquals(listOf(now.epochSecond + 172800), plan.map { it.at })
        assertEquals("reminder", plan.single().kind)
    }
    @Test fun aCloseDeadlineGetsOnlyTheRemainingReminderOrTheDeadlineItself() {
        assertEquals(listOf(now.epochSecond + 3600), reminderPlan(listOf(task("a", 7200)), now.epochSecond).map { it.at })
        assertEquals(listOf(now.epochSecond + 600), reminderPlan(listOf(task("a", 600)), now.epochSecond).map { it.at })
    }
    @Test fun completedUndatedAndOverdueTasksNeverScheduleNotifications() {
        assertTrue(reminderPlan(listOf(task("done", 172800, true), task("undated", null), task("overdue", -300)), now.epochSecond).isEmpty())
    }
    @Test fun changingTheDeadlineProducesDifferentReminderIdentities() {
        assertNotEquals(reminderPlan(listOf(task("a", 172800)), now.epochSecond).first().identity,
            reminderPlan(listOf(task("a", 259200)), now.epochSecond).first().identity)
    }
}
