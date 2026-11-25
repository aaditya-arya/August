package app.august.nativejournal.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.august.nativejournal.data.Moment
import java.time.Instant
import java.time.ZoneId
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

fun categoryLabel(category: String) = when (category) {
    "Milestone_HardWork" -> "Milestone"
    "Perspective_Lesson" -> "Perspective"
    "Quiet_Moment" -> "Quiet moment"
    "Hard_Truth" -> "Hard truth"
    "Media_Log" -> "Media log"
    "Daily_Log" -> "Daily life"
    "Shaairi_Quote" -> "Words to keep"
    else -> category.replace('_', ' ')
}

fun momentDate(value: String, pattern: String = "MMM d · h:mm a"): String = runCatching {
    DateTimeFormatter.ofPattern(pattern, Locale.getDefault()).withZone(ZoneId.systemDefault()).format(Instant.parse(value))
}.getOrElse { "Date unavailable" }

fun momentDay(value: String): String = runCatching {
    val day = Instant.parse(value).atZone(ZoneId.systemDefault()).toLocalDate()
    when (day) { LocalDate.now() -> "Today"; LocalDate.now().minusDays(1) -> "Yesterday"; else -> day.format(DateTimeFormatter.ofPattern("EEEE, MMM d", Locale.getDefault())) }
}.getOrElse { "Other moments" }

@Composable
fun PageHeading(eyebrow: String, title: String, description: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(eyebrow.uppercase(), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
        Text(title, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.SemiBold)
        description?.let { Text(it, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

@Composable
fun EmptyState(title: String, description: String, action: String? = null, onAction: () -> Unit = {}) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (action != null) FilledTonalButton(onClick = onAction) { Text(action) }
        }
    }
}

@Composable
fun MomentCard(moment: Moment, onClick: () -> Unit) {
    val accent = when (moment.category) {
        "Quiet_Moment", "Milestone_HardWork" -> MaterialTheme.colorScheme.secondary
        "Wishlist", "Media_Log" -> MaterialTheme.colorScheme.tertiary
        "Hard_Truth" -> MaterialTheme.colorScheme.error
        else -> MaterialTheme.colorScheme.primary
    }
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth(), shape = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Surface(shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp), color = accent.copy(alpha = .10f)) {
                    Text(categoryLabel(moment.category), Modifier.padding(horizontal = 10.dp, vertical = 5.dp), style = MaterialTheme.typography.labelMedium, color = accent)
                }
                Text(momentDate(moment.eventTimestamp, "h:mm a"), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            moment.memory?.title?.takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.titleMedium) }
            Text(moment.content, style = MaterialTheme.typography.bodyMedium, maxLines = 3, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                LazyRow(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(moment.tags.take(3)) { tag -> Text("#$tag", style = MaterialTheme.typography.labelSmall, color = accent) }
                }
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
fun MomentDetail(moment: Moment, share: () -> Unit) {
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp).padding(bottom = 36.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Text(categoryLabel(moment.category), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
        Text(moment.memory?.title?.ifBlank { null } ?: "A moment worth keeping", style = MaterialTheme.typography.headlineSmall)
        Text(momentDate(moment.eventTimestamp), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
        SelectionContainer { Text(moment.content, style = MaterialTheme.typography.bodyLarge) }
        Text(moment.tags.joinToString("  ") { "#$it" }, color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedButton(onClick = share) { Icon(Icons.Default.Share, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text("Share this moment") }
    }
}
