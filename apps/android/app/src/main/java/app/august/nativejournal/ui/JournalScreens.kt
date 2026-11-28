package app.august.nativejournal.ui

import android.content.Intent
import androidx.core.net.toUri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.august.nativejournal.BuildConfig
import app.august.nativejournal.JournalUiState
import app.august.nativejournal.data.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
fun MomentsScreen(
    state: JournalUiState, selected: (Moment) -> Unit, write: () -> Unit, retry: () -> Unit,
    dismissReceipt: () -> Unit, openTasks: () -> Unit,
) {
    var query by rememberSaveable { mutableStateOf("") }
    var category by rememberSaveable { mutableStateOf<String?>(null) }
    var searching by rememberSaveable { mutableStateOf(false) }
    val categories = remember(state.moments) { state.moments.map { it.category }.distinct().sorted() }
    val filtered = remember(state.moments, query, category) {
        state.moments.filter { moment -> (category == null || category == moment.category) &&
            (query.isBlank() || listOf(moment.content, moment.memory?.title.orEmpty(), categoryLabel(moment.category), moment.tags.joinToString(" ")).any { it.contains(query.trim(), ignoreCase = true) }) }
    }
    val list = rememberLazyListState()
    LaunchedEffect(state.savedNote?.noteId) {
        if (state.savedNote != null) list.scrollToItem(1)
    }
    LazyColumn(state = list, contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 8.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { JournalDashboard(state, write, openTasks) }
        state.savedNote?.let { receipt -> item(key = "receipt:${receipt.noteId}") { NoteReceipt(receipt, state, dismissReceipt, openTasks) } }
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("Recent moments", Modifier.weight(1f), style = plannerTitle())
                IconButton(onClick = { searching = !searching; if (!searching) { query = ""; category = null } }) {
                    Icon(if (searching) Icons.Default.Close else Icons.Default.Search, if (searching) "Hide search" else "Search moments")
                }
            }
        }
        if (searching) item {
            OutlinedTextField(query, { query = it }, modifier = Modifier.fillMaxWidth(), placeholder = { Text("Find a moment, person, or idea") },
                leadingIcon = { Icon(Icons.Default.Search, null) }, trailingIcon = { if (query.isNotEmpty()) IconButton(onClick = { query = "" }) { Icon(Icons.Default.Close, "Clear search") } },
                singleLine = true, shape = RoundedCornerShape(28.dp))
        }
        if (searching && categories.isNotEmpty()) item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item { FilterChip(selected = category == null, onClick = { category = null }, label = { Text("All moments") }) }
                items(categories) { value -> FilterChip(selected = category == value, onClick = { category = if (category == value) null else value }, label = { Text(categoryLabel(value)) }) }
            }
        }
        if (state.loadingMoments) item { LoadingCard("Opening your journal", "Your saved moments will appear here.") }
        state.momentsError?.let { message -> item { RequestError("Couldn't load your journal", message, retry) } }
        if (filtered.isEmpty() && !state.loadingMoments && state.momentsError == null) item {
            EmptyState(if (state.moments.isEmpty()) "Start with something small." else "No matching moments",
                if (state.moments.isEmpty()) "A sentence is enough. Your journal grows one moment at a time." else "Try a different word or category.",
                if (state.moments.isEmpty()) "Write your first moment" else null, write)
        }
        filtered.groupBy { momentDay(it.eventTimestamp) }.forEach { (day, moments) ->
            item(key = "day:$day") { Text(day, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.animateItem().padding(top = 8.dp)) }
            items(moments, key = { it.id }) { moment -> MomentCard(moment, modifier = Modifier.animateItem()) { selected(moment) } }
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
    var prompts by rememberSaveable { mutableStateOf(false) }
    val mode = modes[modeIndex]
    Column(Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp).padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Spacer(Modifier.height(4.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Start anywhere.", style = MaterialTheme.typography.headlineLarge, modifier = Modifier.weight(1f))
            FilterChip(selected = prompts, onClick = { prompts = !prompts }, label = { Text("Prompts") })
        }
        if (!state.preview && state.draft.isBlank()) {
            Text("Write a thought or a plan. August picks up tasks, reminders, and events when you save.",
                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        AnimatedVisibility(
            visible = prompts,
            enter = expandVertically(spring(stiffness = Spring.StiffnessMediumLow)) + fadeIn(),
            exit = shrinkVertically(spring(stiffness = Spring.StiffnessMediumLow)) + fadeOut(),
        ) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(modes.indices.toList()) { index -> FilterChip(selected = index == modeIndex, onClick = { modeIndex = index; promptIndex = 0 }, label = { Text(modes[index].name) }) }
            }
        }
        val editorMinHeight by animateDpAsState(
            targetValue = if (prompts) 230.dp else 290.dp,
            animationSpec = spring(stiffness = Spring.StiffnessMediumLow),
            label = "editorMinHeight",
        )
        OutlinedTextField(state.draft, edit, modifier = Modifier.fillMaxWidth().heightIn(min = editorMinHeight),
            enabled = !state.saving, placeholder = { Text(mode.hint, style = MaterialTheme.typography.bodyLarge) },
            textStyle = MaterialTheme.typography.bodyLarge.copy(fontSize = 18.sp, lineHeight = 30.sp), shape = RoundedCornerShape(24.dp),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            if (state.draft.isNotBlank() && !state.preview) Text(if (state.draftStored) "Draft saved on device" else "Saving draft…", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        val saveInteraction = remember { MutableInteractionSource() }
        Button(onClick = save, enabled = state.draft.isNotBlank() && !state.saving, interactionSource = saveInteraction,
            modifier = Modifier.fillMaxWidth().height(56.dp).pressScale(saveInteraction), shape = RoundedCornerShape(16.dp)) {
            if (state.saving) { CircularProgressIndicator(Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp); Spacer(Modifier.width(12.dp)) }
            Text(if (state.saving) "Saving your moment…" else "Save moment")
        }
        AnimatedVisibility(
            visible = prompts,
            enter = expandVertically(spring(stiffness = Spring.StiffnessMediumLow)) + fadeIn(),
            exit = shrinkVertically(spring(stiffness = Spring.StiffnessMediumLow)) + fadeOut(),
        ) {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer)) {
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
}

@Composable
fun ReviewScreen(state: JournalUiState, load: (String, Boolean) -> Unit, selected: (Moment) -> Unit) {
    val response = state.review
    val reflection = response?.review
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        item { Text("See the bigger picture.", style = MaterialTheme.typography.displayMedium) }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(listOf("7" to "7 days", "30" to "30 days", "all" to "All time")) { (period, title) ->
                    FilterChip(selected = state.reviewPeriod == period, onClick = { load(period, false) }, label = { Text(title) })
                }
            }
        }
        if (state.loadingReview) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        state.reviewError?.let { message -> item { RequestError("Couldn't prepare your review", message) { load(state.reviewPeriod, true) } } }
        if (response != null && response.selectedCount > 0) item {
            Text("${response.selectedCount} saved ${if (response.selectedCount == 1) "moment" else "moments"}", style = MaterialTheme.typography.headlineSmall)
        }
        if (state.loadingReflection) item {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                Text("Preparing your reflection", style = MaterialTheme.typography.bodyMedium)
            }
        }
        val reflectionError = state.reflectionError ?: response?.message?.takeIf { reflection == null && response.selectedCount > 0 }
        reflectionError?.let { message ->
            item { RequestError("Reflection unavailable", message) { load(state.reviewPeriod, true) } }
        }
        if (!state.loadingReview && response?.selectedCount == 0) item {
            val switchToAll = state.reviewPeriod != "all"
            EmptyState("No moments in this period", if (switchToAll) "You can look back at your full journal." else "Saved moments will appear here.",
                if (switchToAll) "Review all time" else null) { load("all", false) }
        }
        reflection?.let { review ->
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(review.opening, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    response.message?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                }
            }
            review.focus?.let { insight -> item { InsightCard(insight, response.entries, selected, featured = true) } }
            listOf("Progress" to review.progress, "Experiences" to review.experiences, "Lessons" to review.lessons, "Patterns" to review.patterns).forEach { (title, insights) ->
                if (insights.isNotEmpty()) item { Text(title, style = MaterialTheme.typography.titleLarge) }
                items(insights) { insight -> InsightCard(insight, response.entries, selected) }
            }
            review.nextStep?.let { insight ->
                item { Text("A next step", style = MaterialTheme.typography.titleLarge) }
                item { InsightCard(insight, response.entries, selected) }
            }
            if (review.question.isNotBlank()) item {
                OutlinedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("SOMETHING TO SIT WITH", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                    Text(review.question, style = MaterialTheme.typography.titleLarge)
                } }
            }
            if (!state.preview) item { TextButton(onClick = { load(state.reviewPeriod, true) }) { Icon(Icons.Default.Refresh, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text("Prepare a fresh reflection") } }
        }
        if (response?.intentions?.isNotEmpty() == true) {
            item { Text("Things you're carrying forward", style = MaterialTheme.typography.titleLarge) }
            items(response.intentions) { intention ->
                Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("${intention.kind.replaceFirstChar { it.uppercase() }} · ${intention.status.replaceFirstChar { it.uppercase() }}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                        Text(intention.title, style = MaterialTheme.typography.titleMedium)
                        if (intention.reflection.isNotBlank()) Text(intention.reflection)
                        if (intention.gap.isNotBlank()) Text(intention.gap, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (intention.nextStep.isNotBlank()) Text(intention.nextStep, style = MaterialTheme.typography.bodyLarge)
                        intention.deadline?.let { Text("Target: $it", style = MaterialTheme.typography.labelMedium) }
                        SourceMoments(intention.sourceIds, response.entries, selected)
                    }
                }
            }
        }
        if (reflection == null && response?.entries?.isNotEmpty() == true) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Your saved moments", style = MaterialTheme.typography.titleLarge)
                }
            }
            items(response.entries, key = { "source:${it.id}" }) { moment -> MomentCard(moment) { selected(moment) } }
        }
    }
}

@Composable
private fun InsightCard(insight: Insight, entries: List<Moment>, selected: (Moment) -> Unit, featured: Boolean = false) {
    var expanded by rememberSaveable(insight.title) { mutableStateOf(false) }
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = if (featured) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(insight.title, style = MaterialTheme.typography.titleLarge)
            Text(insight.takeaway, style = MaterialTheme.typography.bodyLarge)
            TextButton(onClick = { expanded = !expanded }) { Text(if (expanded) "Hide details" else "Why this reflection?") }
            AnimatedVisibility(
                visible = expanded,
                enter = expandVertically(spring(stiffness = Spring.StiffnessMediumLow)) + fadeIn(),
                exit = shrinkVertically(spring(stiffness = Spring.StiffnessMediumLow)) + fadeOut(),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text(insight.meaning, color = if (featured) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant)
                    SourceMoments(insight.sourceIds, entries, selected)
                }
            }
        }
    }
}

@Composable
private fun SourceMoments(ids: List<String>, entries: List<Moment>, selected: (Moment) -> Unit) {
    ids.mapNotNull { id -> entries.find { it.id == id } }.forEach { moment ->
        val interaction = remember { MutableInteractionSource() }
        OutlinedCard(onClick = { selected(moment) }, interactionSource = interaction,
            modifier = Modifier.fillMaxWidth().pressScale(interaction, targetScale = 0.98f)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Open source moment", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                Text(moment.memory?.title?.ifBlank { null } ?: moment.content.take(100), style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
fun SettingsScreen(state: JournalUiState, appearance: (String) -> Unit, signOut: () -> Unit, checkServices: () -> Unit) {
    var confirmSignOut by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        if (BuildConfig.DEBUG && !state.preview) AppUpdateCard()
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
        if (!state.preview) {
            Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text("Server status", style = MaterialTheme.typography.titleLarge)
                    Text("Check the services behind your journal, reviews, and connections.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (state.loadingServices) LinearProgressIndicator(Modifier.fillMaxWidth())
                    state.serverStatus?.let { status ->
                        listOf("Journal" to status.journal, "Connections" to status.graph, "Reviews" to status.review).forEach { (label, check) ->
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("$label · ${if (check.ready) "Configured" else "Needs attention"}", style = MaterialTheme.typography.titleSmall,
                                    color = if (check.ready) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
                                Text(check.message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                    state.servicesError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    val checkInteraction = remember { MutableInteractionSource() }
                    OutlinedButton(onClick = checkServices, enabled = !state.loadingServices,
                        interactionSource = checkInteraction, modifier = Modifier.pressScale(checkInteraction)) { Text("Check services") }
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Your writing & privacy", style = MaterialTheme.typography.titleMedium)
            Text("Drafts, sessions, and cached moments are encrypted on this device. Saved writing is processed by your August server and its AI provider.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        val signOutInteraction = remember { MutableInteractionSource() }
        OutlinedButton(onClick = { if (state.preview) signOut() else confirmSignOut = true },
            interactionSource = signOutInteraction,
            modifier = Modifier.fillMaxWidth().height(52.dp).pressScale(signOutInteraction)) {
            Icon(Icons.AutoMirrored.Filled.ExitToApp, null, Modifier.size(20.dp)); Spacer(Modifier.width(10.dp)); Text(if (state.preview) "Connect my journal" else "Sign out")
        }
        Text("August for Android · ${BuildConfig.VERSION_NAME}\nBuilt with Kotlin & Jetpack Compose", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if (confirmSignOut) AlertDialog(onDismissRequest = { confirmSignOut = false }, title = { Text("Sign out of August?") },
        text = { Text("Your draft stays encrypted on this device for this account. Cached moments will be cleared.") },
        confirmButton = { TextButton(onClick = { confirmSignOut = false; signOut() }) { Text("Sign out") } },
        dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text("Cancel") } })
}

@Composable
private fun AppUpdateCard() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var checking by remember { mutableStateOf(false) }
    var release by remember { mutableStateOf<AppRelease?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("App updates", style = MaterialTheme.typography.titleLarge)
            Text(release?.let { "August ${it.version} is available" } ?: "Installed · ${BuildConfig.VERSION_NAME}",
                style = MaterialTheme.typography.bodyMedium)
            message?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            Button(onClick = {
                val update = release
                if (update != null) {
                    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, update.downloadUrl.toUri())) }
                        .onFailure { message = "Open the August website to download the update." }
                } else {
                    checking = true
                    message = null
                    scope.launch {
                        try {
                            release = availableAppUpdate()
                            if (release == null) message = "You're up to date."
                        } catch (error: Exception) {
                            if (error is CancellationException) throw error
                            message = "Couldn't check for an update. Try again."
                        } finally { checking = false }
                    }
                }
            }, enabled = !checking) {
                Text(if (checking) "Checking…" else if (release != null) "Download update" else "Check for updates")
            }
        }
    }
}
