package app.august.nativejournal.ui

import android.content.Intent
import androidx.core.net.toUri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.august.nativejournal.BuildConfig
import app.august.nativejournal.JournalUiState
import app.august.nativejournal.data.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
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
    PullToRefreshBox(
        isRefreshing = state.loadingMoments && state.moments.isNotEmpty() && !state.preview,
        onRefresh = { if (!state.preview) retry() },
        modifier = Modifier.fillMaxSize(),
    ) {
        LazyColumn(state = list, modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 8.dp, bottom = 24.dp),
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
            if (state.loadingMoments && state.moments.isEmpty()) item { LoadingCard("Opening your journal", "Your saved moments will appear here.") }
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
}

private val sentenceRegex = Regex("""[^.!?\n]+(?:[.!?]+|\n)""")
private val cancelledRegex = Regex("""\b(cancelled|canceled|skipped|skipping|someday|might buy|wish i had)\b""", RegexOption.IGNORE_CASE)
private val eventRegex = Regex("""\b(meeting|appointment|conference|dentist|doctor|interview|flight|dinner with)\b""", RegexOption.IGNORE_CASE)
private val datedEventRegex = Regex("""\b(tomorrow|next\s+(?:mon|tue|wed|thu|fri|sat|sun)\w*)\b.*\b(\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?)|at\s+\d)""", RegexOption.IGNORE_CASE)
private val workRegex = Regex("""\b(remind me|need to|have to|must|working on|building a|finish|submit|pay the|call the|deadline|due\s+(?:by|on|tomorrow))\b""", RegexOption.IGNORE_CASE)
private val feelingRegex = Regex("""\b(feel|felt|feeling|happy|sad|grateful|anxious|lonely|proud|overwhelmed|calm|peaceful|rushed|stressed|relieved|excited|angry|hurt|loved|missed|quiet walk|heart)\b""", RegexOption.IGNORE_CASE)

private class PassageHighlightTransformation(private val dark: Boolean) : VisualTransformation {
    override fun filter(text: AnnotatedString): TransformedText {
        val raw = text.text
        if (raw.isEmpty()) return TransformedText(text, OffsetMapping.Identity)
        val annotated = buildAnnotatedString {
            append(raw)
            sentenceRegex.findAll(raw).forEach { match ->
                val line = match.value.trim()
                if (line.isEmpty()) return@forEach
                val end = match.range.first + match.value.trimEnd('\n', '\r').length
                if (end <= match.range.first) return@forEach
                val cancelled = cancelledRegex.containsMatchIn(line)
                val color = when {
                    !cancelled && (eventRegex.containsMatchIn(line) || datedEventRegex.containsMatchIn(line)) ->
                        if (dark) Color(0x4D7AB8FF) else Color(0xFFBCD9FF)
                    !cancelled && workRegex.containsMatchIn(line) ->
                        if (dark) Color(0x4D7CC8F8) else Color(0xFFC3E5F8)
                    feelingRegex.containsMatchIn(line) ->
                        if (dark) Color(0x4DE89AB5) else Color(0xFFFFD0DF)
                    else -> null
                }
                color?.let { addStyle(SpanStyle(background = it), match.range.first, end) }
            }
        }
        return TransformedText(annotated, OffsetMapping.Identity)
    }
}

@Composable
fun WriteScreen(state: JournalUiState, edit: (String) -> Unit, save: () -> Unit) {
    val palette = MaterialTheme.colorScheme
    val dark = palette.background.red < 0.5f
    val highlighter = remember(dark) { PassageHighlightTransformation(dark) }
    Column(Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp).padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Text("Your page", style = MaterialTheme.typography.displaySmall.copy(fontFamily = FontFamily.Serif))
        OutlinedTextField(
            state.draft, edit,
            modifier = Modifier.fillMaxWidth().heightIn(min = 330.dp),
            enabled = !state.saving,
            placeholder = { Text("Start anywhere...", style = MaterialTheme.typography.bodyLarge) },
            textStyle = MaterialTheme.typography.bodyLarge.copy(fontSize = 21.sp, lineHeight = 33.sp, fontFamily = FontFamily.Serif),
            visualTransformation = highlighter,
            shape = RoundedCornerShape(22.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = palette.surfaceContainerLow,
                unfocusedContainerColor = palette.surfaceContainerLow,
                focusedBorderColor = palette.primary,
                unfocusedBorderColor = palette.outlineVariant,
            ),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            if (state.draft.isNotBlank() && !state.preview) Text(if (state.draftStored) "Draft saved on device" else "Saving draft…", style = MaterialTheme.typography.labelSmall, color = palette.onSurfaceVariant)
        }
        Button(
            onClick = save,
            enabled = state.draft.isNotBlank() && !state.saving,
            modifier = Modifier.fillMaxWidth().height(54.dp),
            shape = RoundedCornerShape(16.dp),
        ) {
            if (state.saving) { CircularProgressIndicator(Modifier.size(20.dp), color = palette.onPrimary, strokeWidth = 2.dp); Spacer(Modifier.width(12.dp)) }
            Text(if (state.saving) "Saving your moment…" else "Save moment")
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
        OutlinedCard(
            onClick = { selected(moment) },
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Open source moment", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                Text(moment.memory?.title?.ifBlank { null } ?: moment.content.take(100), style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
fun SettingsScreen(
    state: JournalUiState,
    appearance: (String) -> Unit,
    signOut: () -> Unit,
    checkServices: () -> Unit,
    sync: () -> Unit = {},
) {
    var confirmSignOut by remember { mutableStateOf(false) }
    val server = state.device.connection?.server.orEmpty()
    val syncing = state.loadingMoments || state.loadingTasks
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        if (BuildConfig.DEBUG && !state.preview) AppUpdateCard()
        Card(
            shape = RoundedCornerShape(20.dp),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
        ) {
            Column(Modifier.fillMaxWidth().padding(22.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
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
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Connected journal", style = MaterialTheme.typography.titleMedium)
            Text(if (state.preview) "Sample data · no server requests" else server, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (!state.preview && server.isNotBlank() && server != PUBLIC_JOURNAL) {
                Text(
                    "Connected to a custom server instead of $PUBLIC_JOURNAL. Sign in to the same server on desktop to sync.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (!state.preview) {
                OutlinedButton(onClick = sync, enabled = !syncing, shape = RoundedCornerShape(14.dp)) {
                    Icon(Icons.Default.Refresh, null, Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(if (syncing) "Syncing…" else "Sync now")
                }
            }
        }
        if (!state.preview) {
            Card(
                Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
            ) {
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
                    OutlinedButton(onClick = checkServices, enabled = !state.loadingServices, shape = RoundedCornerShape(14.dp)) { Text("Check services") }
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Your writing & privacy", style = MaterialTheme.typography.titleMedium)
            Text("Drafts, sessions, and cached moments are encrypted on this device. Saved writing is processed by your August server and its AI provider.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        OutlinedButton(
            onClick = { if (state.preview) signOut() else confirmSignOut = true },
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) {
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
