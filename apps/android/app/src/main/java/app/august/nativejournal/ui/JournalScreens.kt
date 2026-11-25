package app.august.nativejournal.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.august.nativejournal.BuildConfig
import app.august.nativejournal.JournalUiState
import app.august.nativejournal.data.*
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Composable
fun MomentsScreen(state: JournalUiState, selected: (Moment) -> Unit, write: () -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var category by rememberSaveable { mutableStateOf<String?>(null) }
    val categories = remember(state.moments) { state.moments.map { it.category }.distinct().sorted() }
    val filtered = remember(state.moments, query, category) {
        state.moments.filter { moment -> (category == null || category == moment.category) &&
            (query.isBlank() || listOf(moment.content, moment.memory?.title.orEmpty(), categoryLabel(moment.category), moment.tags.joinToString(" ")).any { it.contains(query.trim(), ignoreCase = true) }) }
    }
    LazyColumn(contentPadding = PaddingValues(start = 24.dp, end = 24.dp, top = 16.dp, bottom = 104.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            PageHeading(LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE, MMMM d")), "Your life,\nin perspective.", "A home for the things you want to remember.")
        }
        item {
            Card(onClick = write, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                Row(Modifier.fillMaxWidth().padding(22.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Icon(Icons.Default.Edit, null, tint = MaterialTheme.colorScheme.onPrimaryContainer)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(if (state.draft.isBlank()) "What's on your mind?" else "Your draft is waiting", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                        Text(if (state.draft.isBlank()) "A thought, a feeling, a moment to keep." else "Pick up where you left off.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                    }
                    Icon(Icons.Default.Add, null, tint = MaterialTheme.colorScheme.onPrimaryContainer)
                }
            }
        }
        if (state.moments.isNotEmpty()) item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                listOf(state.moments.size.toString() to "moments kept", categories.size.toString() to "parts of your life").forEach { (count, label) ->
                    Surface(Modifier.weight(1f), shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surfaceContainer) {
                        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(count, style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
                            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
        item {
            OutlinedTextField(query, { query = it }, modifier = Modifier.fillMaxWidth(), placeholder = { Text("Find a moment, person, or idea") },
                leadingIcon = { Icon(Icons.Default.Search, null) }, trailingIcon = { if (query.isNotEmpty()) IconButton(onClick = { query = "" }) { Icon(Icons.Default.Close, "Clear search") } },
                singleLine = true, shape = RoundedCornerShape(28.dp))
        }
        if (categories.isNotEmpty()) item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item { FilterChip(selected = category == null, onClick = { category = null }, label = { Text("All moments") }) }
                items(categories) { value -> FilterChip(selected = category == value, onClick = { category = if (category == value) null else value }, label = { Text(categoryLabel(value)) }) }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Your moments", style = MaterialTheme.typography.titleLarge)
                Text("${filtered.size} kept", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
            }
        }
        if (state.loadingMoments) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        if (filtered.isEmpty() && !state.loadingMoments) item {
            EmptyState(if (state.moments.isEmpty()) "Start with something small." else "No matching moments",
                if (state.moments.isEmpty()) "A sentence is enough. Your journal grows one moment at a time." else "Try a different word or category.",
                if (state.moments.isEmpty()) "Write your first moment" else null, write)
        }
        filtered.groupBy { momentDay(it.eventTimestamp) }.forEach { (day, moments) ->
            item(key = "day:$day") { Text(day, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp)) }
            items(moments, key = { it.id }) { moment -> MomentCard(moment) { selected(moment) } }
        }
        if (state.moments.isNotEmpty() && !state.preview) item {
            Text("Your last 200 loaded moments are kept encrypted on this device for offline reading.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

private data class WritingMode(val name: String, val hint: String, val prompts: List<String>)
private val modes = listOf(
    WritingMode("Free write", "Today, I keep coming back to…", listOf("What's taking up space in your mind?", "What's one small moment you'd like to keep?")),
    WritingMode("Little joys", "Something small that made today better…", listOf("Who made your day a little lighter?", "What felt ordinary, but lovely looking back?")),
    WritingMode("Let it out", "If I'm being honest with myself…", listOf("What don't you need to figure out tonight?", "What would you say to a friend who felt this way?")),
    WritingMode("Dream a little", "I'd love to make more room for…", listOf("What would you try without needing to be good at it?", "What's a small first step toward something you want?")),
)

@Composable
fun WriteScreen(state: JournalUiState, edit: (String) -> Unit, save: () -> Unit) {
    var modeIndex by rememberSaveable { mutableIntStateOf(0) }
    var promptIndex by rememberSaveable { mutableIntStateOf(0) }
    var focused by rememberSaveable { mutableStateOf(false) }
    val mode = modes[modeIndex]
    val words = remember(state.draft) { state.draft.trim().takeIf { it.isNotEmpty() }?.split(Regex("\\s+")).orEmpty().size }
    Column(Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp).padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Spacer(Modifier.height(4.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Write it your way.", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.weight(1f))
            FilterChip(selected = focused, onClick = { focused = !focused }, label = { Text("Focus") })
        }
        if (!focused) LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(modes.indices.toList()) { index -> FilterChip(selected = index == modeIndex, onClick = { modeIndex = index; promptIndex = 0 }, label = { Text(modes[index].name) }) }
        }
        OutlinedTextField(state.draft, edit, modifier = Modifier.fillMaxWidth().heightIn(min = if (focused) 420.dp else 300.dp),
            enabled = !state.saving, placeholder = { Text(mode.hint, style = MaterialTheme.typography.bodyLarge) },
            textStyle = MaterialTheme.typography.bodyLarge.copy(fontSize = 18.sp, lineHeight = 30.sp), shape = RoundedCornerShape(24.dp),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("$words ${if (words == 1) "word" else "words"}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(if (state.preview) "Sample journal" else if (state.draftStored) "Draft saved on device" else "Keeping your draft…", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Button(onClick = save, enabled = state.draft.isNotBlank() && !state.saving,
            modifier = Modifier.fillMaxWidth().height(56.dp), shape = RoundedCornerShape(16.dp)) {
            if (state.saving) { CircularProgressIndicator(Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp); Spacer(Modifier.width(12.dp)) }
            Text(if (state.saving) "Saving your moment…" else "Save moment")
        }
        if (!focused) Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer)) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("NEED A STARTING POINT?", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                Text(mode.prompts[promptIndex], style = MaterialTheme.typography.titleMedium)
                Row {
                    TextButton(enabled = !state.saving, onClick = { edit(listOf(state.draft.trimEnd(), mode.prompts[promptIndex]).filter { it.isNotBlank() }.joinToString("\n\n") + "\n") }) { Text("Use this prompt") }
                    TextButton(onClick = { promptIndex = (promptIndex + 1) % mode.prompts.size }) { Text("Another") }
                }
            }
        }
    }
}

@Composable
fun ReviewScreen(state: JournalUiState, load: (String, Boolean) -> Unit, selected: (Moment) -> Unit) {
    val response = state.review
    val reflection = response?.review
    val supporting = remember(reflection) { reflection?.let { (it.progress + it.experiences + it.lessons + it.patterns + listOfNotNull(it.nextStep)).distinctBy { insight -> insight.title }.take(3) }.orEmpty() }
    LazyColumn(contentPadding = PaddingValues(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        item { PageHeading("A pause to look back", "See the bigger picture.", "A reflection grounded in the moments you've actually kept.") }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("7" to "7 days", "30" to "30 days", "all" to "All time").forEach { (period, title) ->
                    FilterChip(selected = state.reviewPeriod == period, onClick = { load(period, false) }, enabled = !state.preview, label = { Text(title) })
                }
            }
        }
        if (state.loadingReview) item {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) { LinearProgressIndicator(Modifier.fillMaxWidth()); Text("Finding the threads in your journal…", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        if (!state.loadingReview && reflection == null) item {
            EmptyState(if (response?.selectedCount == 0) "A reflection starts with a moment." else "Your reflection isn't ready yet.",
                response?.message ?: "Keep a few moments, then come back to see how they connect.", "Try again") { load(state.reviewPeriod, true) }
        }
        reflection?.let { review ->
            item { Text(review.opening, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            review.focus?.let { insight -> item { InsightCard(insight, response.entries, selected, featured = true) } }
            items(supporting) { insight -> InsightCard(insight, response.entries, selected) }
            if (review.question.isNotBlank()) item {
                OutlinedCard { Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("SOMETHING TO SIT WITH", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                    Text(review.question, style = MaterialTheme.typography.titleLarge)
                } }
            }
            if (!state.preview) item { TextButton(onClick = { load(state.reviewPeriod, true) }) { Icon(Icons.Default.Refresh, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text("Prepare a fresh reflection") } }
        }
    }
}

@Composable
private fun InsightCard(insight: Insight, entries: List<Moment>, selected: (Moment) -> Unit, featured: Boolean = false) {
    var expanded by rememberSaveable(insight.title) { mutableStateOf(false) }
    Card(colors = CardDefaults.cardColors(containerColor = if (featured) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(insight.title, style = MaterialTheme.typography.titleLarge)
            Text(insight.takeaway, style = MaterialTheme.typography.bodyLarge)
            TextButton(onClick = { expanded = !expanded }) { Text(if (expanded) "Hide the source moments" else "See the source moments") }
            if (expanded) {
                Text(insight.meaning, color = MaterialTheme.colorScheme.onSurfaceVariant)
                insight.sourceIds.mapNotNull { id -> entries.find { it.id == id } }.forEach { moment ->
                    OutlinedCard(onClick = { selected(moment) }, modifier = Modifier.fillMaxWidth()) {
                        Text(moment.memory?.title?.ifBlank { null } ?: moment.content.take(100), Modifier.padding(16.dp), style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
    }
}

@Composable
fun SettingsScreen(state: JournalUiState, appearance: (String) -> Unit, signOut: () -> Unit) {
    var confirmSignOut by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        PageHeading("Your space", "Make it yours.")
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
            Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(Icons.Default.Person, null, tint = MaterialTheme.colorScheme.primary)
                Text(if (state.preview) "Exploring August" else state.device.session?.user?.email.orEmpty(), style = MaterialTheme.typography.titleMedium)
                Text(if (state.preview) "You're viewing a sample journal. Connect your August server to start your own." else "Your saved moments follow this account.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Appearance", style = MaterialTheme.typography.titleMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("system" to "System", "light" to "Light", "dark" to "Dark").forEach { (value, title) -> FilterChip(selected = state.device.appearance == value, onClick = { appearance(value) }, label = { Text(title) }) }
            }
        }
        HorizontalDivider()
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Connected journal", style = MaterialTheme.typography.titleMedium)
            Text(if (state.preview) "Sample data · no server requests" else state.device.connection?.server.orEmpty(), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Your writing & privacy", style = MaterialTheme.typography.titleMedium)
            Text("Drafts, sessions, and cached moments are encrypted on this device. Saved writing is processed by your August server and its AI provider.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        OutlinedButton(onClick = { if (state.preview) signOut() else confirmSignOut = true }, modifier = Modifier.fillMaxWidth().height(52.dp)) {
            Icon(Icons.AutoMirrored.Filled.ExitToApp, null, Modifier.size(20.dp)); Spacer(Modifier.width(10.dp)); Text(if (state.preview) "Connect my journal" else "Sign out")
        }
        Text("August for Android · ${BuildConfig.VERSION_NAME}\nBuilt with Kotlin & Jetpack Compose", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if (confirmSignOut) AlertDialog(onDismissRequest = { confirmSignOut = false }, title = { Text("Sign out of August?") },
        text = { Text("Your draft stays encrypted on this device for this account. Cached moments will be cleared.") },
        confirmButton = { TextButton(onClick = { confirmSignOut = false; signOut() }) { Text("Sign out") } },
        dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text("Cancel") } })
}
