package app.august.nativejournal.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import app.august.nativejournal.JournalUiState
import app.august.nativejournal.data.SaveResponse
import app.august.nativejournal.tasks.TaskRuntime
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Composable
internal fun JournalDashboard(state: JournalUiState, write: () -> Unit, openTasks: () -> Unit) {
    val today = LocalDate.now()
    val open = state.tasks.count { !it.completed }
    val palette = MaterialTheme.colorScheme
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(26.dp),
        color = palette.surfaceContainerLow,
        border = BorderStroke(1.dp, palette.outlineVariant),
    ) {
        Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Text(
                today.format(DateTimeFormatter.ofPattern("EEEE, MMMM d")),
                color = palette.onSurfaceVariant,
                style = MaterialTheme.typography.labelLarge,
            )
            Text(
                if (state.draft.isBlank()) "What's on your mind?" else "Your draft is waiting",
                color = palette.onSurface,
                style = MaterialTheme.typography.displaySmall.copy(fontFamily = FontFamily.Serif),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                Button(
                    onClick = write,
                    shape = RoundedCornerShape(999.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = palette.primary, contentColor = palette.onPrimary),
                    contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
                    modifier = Modifier.semantics { contentDescription = "Write a moment" },
                ) {
                    Text(if (state.draft.isBlank()) "Start writing" else "Continue draft")
                    Spacer(Modifier.width(8.dp))
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, null, Modifier.size(18.dp))
                }
                if (open > 0) {
                    FilledTonalButton(
                        onClick = openTasks,
                        shape = RoundedCornerShape(999.dp),
                        colors = ButtonDefaults.filledTonalButtonColors(
                            containerColor = palette.primaryContainer,
                            contentColor = palette.onPrimaryContainer,
                        ),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                    ) { Text("$open open") }
                }
            }
        }
    }
}

@Composable
internal fun NoteReceipt(receipt: SaveResponse, state: JournalUiState, dismiss: () -> Unit, openTasks: () -> Unit) {
    val tasks = receipt.tasks
    val events = receipt.events
    val context = LocalContext.current
    val hasFutureDate = tasks.any { item ->
        !item.completed && item.dueAt?.let { runCatching { Instant.parse(it).isAfter(Instant.now()) }.getOrDefault(false) } == true
    }
    val notificationsOff = hasFutureDate && (!state.device.taskRemindersEnabled || !TaskRuntime.canNotify(context))
    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(26.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
    ) {
        Column(Modifier.padding(start = 20.dp, end = 12.dp, top = 12.dp, bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Saved from your note", Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
                IconButton(onClick = dismiss) { Icon(Icons.Default.Close, "Dismiss save summary") }
            }
            Text("${receipt.extractedCount} saved ${if (receipt.extractedCount == 1) "moment" else "moments"}",
                color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            tasks.take(5).forEach { task ->
                val reminder = task.kind == "reminder"
                ReceiptRow(
                    if (reminder) Icons.Default.Notifications else Icons.Default.Check,
                    task.title, if (reminder) "Reminder" else "Task",
                    if (task.completed) "Completed" else task.dueAt?.let { momentDate(it, "MMM d · h:mm a") }
                        ?: if (reminder) "No time set" else "No deadline",
                )
            }
            events.take(3).forEach { event ->
                ReceiptRow(Icons.Default.DateRange, event.title, "Event", momentDate(event.startsAt, "MMM d · h:mm a"))
                if (event.calendarSynced) Text("Added to Google Calendar", style = MaterialTheme.typography.labelMedium)
            }
            if (tasks.size > 5 || events.size > 3) {
                Text("Showing ${minOf(tasks.size, 5) + minOf(events.size, 3)} of ${tasks.size + events.size} actions.",
                    style = MaterialTheme.typography.labelMedium)
            }
            if (notificationsOff) Text("Phone alerts are off. Turn them on in Tasks.", style = MaterialTheme.typography.bodySmall)
            if (tasks.isNotEmpty()) TextButton(onClick = openTasks) {
                Text("View tasks")
                Spacer(Modifier.width(8.dp))
                Icon(Icons.AutoMirrored.Filled.ArrowForward, null, Modifier.size(16.dp))
            }
        }
    }
}

@Composable
private fun ReceiptRow(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, kind: String, time: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Surface(shape = CircleShape, color = MaterialTheme.colorScheme.primaryContainer) {
            Icon(icon, null, Modifier.padding(9.dp).size(18.dp), tint = MaterialTheme.colorScheme.onPrimaryContainer)
        }
        Column {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text("$kind · $time", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
internal fun plannerTitle() = MaterialTheme.typography.displaySmall.copy(fontFamily = FontFamily.Serif)
