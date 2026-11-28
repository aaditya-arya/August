package app.august.nativejournal.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
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
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
internal fun JournalDashboard(state: JournalUiState, write: () -> Unit, openTasks: () -> Unit) {
    val today = LocalDate.now()
    val open = state.tasks.count { !it.completed }
    val shape = RoundedCornerShape(34.dp)
    Box(
        Modifier.fillMaxWidth().clip(shape).background(
            Brush.linearGradient(listOf(Color(0xFF0A252C), Color(0xFF104F53), Color(0xFF237C75))),
        ),
    ) {
        Canvas(Modifier.matchParentSize()) {
            val center = Offset(size.width * 1.12f, size.height * .17f)
            repeat(6) { index ->
                drawCircle(Color(0xFF9CE2C7).copy(alpha = .17f), size.width * (.30f + index * .075f), center, style = Stroke(1.dp.toPx()))
            }
        }
        Column(Modifier.fillMaxWidth().padding(25.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
            Text(today.format(DateTimeFormatter.ofPattern("EEE, MMM d")), color = Color(0xFFBCDFD8),
                style = MaterialTheme.typography.labelLarge)
            Text(
                if (state.draft.isBlank()) "What's on your mind?" else "Your draft is waiting",
                color = Color.White, style = MaterialTheme.typography.displayMedium,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                Button(
                    onClick = write,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF1FAF4), contentColor = Color(0xFF153C36)),
                    modifier = Modifier.semantics { contentDescription = "Write a moment" },
                ) {
                    Text(if (state.draft.isBlank()) "Start writing" else "Continue draft")
                    Spacer(Modifier.width(8.dp))
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, null, Modifier.size(18.dp))
                }
                if (open > 0) TextButton(
                    onClick = openTasks,
                    colors = ButtonDefaults.textButtonColors(contentColor = Color(0xFFDCF4E9)),
                ) { Text("$open open") }
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
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
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
