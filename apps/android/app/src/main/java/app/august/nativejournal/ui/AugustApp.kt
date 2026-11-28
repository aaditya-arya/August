package app.august.nativejournal.ui

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkHorizontally
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.august.nativejournal.Destination
import app.august.nativejournal.JournalViewModel
import app.august.nativejournal.data.Moment
import app.august.nativejournal.data.SaveResponse
import app.august.nativejournal.data.accountKey

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AugustApp(model: JournalViewModel) {
    val state by model.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }
    val haptics = LocalHapticFeedback.current
    var selectedMoment by remember { mutableStateOf<Moment?>(null) }
    val account = state.device.accountKey()
    LaunchedEffect(account, state.preview) { selectedMoment = null }
    LaunchedEffect(state.message) { state.message?.let { snackbar.showSnackbar(it); model.consumeMessage() } }
    LaunchedEffect(state.completedTask) {
        state.completedTask?.let { task ->
            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
            if (snackbar.showSnackbar("One more thing, done.", actionLabel = "Undo") == SnackbarResult.ActionPerformed) {
                model.completeTask(task, false)
            }
            model.clearTaskNotice()
        }
    }

    AugustTheme(state.device.appearance) {
        Surface(Modifier.fillMaxSize()) {
            when {
                state.booting -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                state.device.session == null && !state.preview -> WelcomeScreen(
                    state = state, addressChanged = model::connectionEdited, checkConnection = model::checkConnection,
                    signIn = { address -> model.signIn(address) { url -> CustomTabsIntent.Builder().build().launchUrl(context, url.toUri()) } },
                    preview = model::preview,
                )
                else -> key(account, state.preview) {
                    val tabs = rememberSaveableStateHolder()
                    val writing = state.destination == Destination.Write
                    val pages = remember { listOf(Destination.Moments, Destination.Tasks, Destination.Review, Destination.Graph, Destination.Settings) }
                    val pager = rememberPagerState(
                        initialPage = pages.indexOf(state.destination).coerceAtLeast(0),
                        pageCount = { pages.size },
                    )
                    val canSwipe by remember(writing) { derivedStateOf { !writing && pager.currentPage != 3 } }
                    var arrivedTab by remember { mutableStateOf<Destination?>(null) }
                    LaunchedEffect(state.destination) {
                        val index = pages.indexOf(state.destination)
                        if (index >= 0 && pager.currentPage != index) {
                            pager.animateScrollToPage(index, animationSpec = spring(stiffness = Spring.StiffnessMediumLow))
                        }
                    }
                    LaunchedEffect(pager) {
                        snapshotFlow { pager.settledPage }.drop(1).distinctUntilChanged().collect { index ->
                            if (!writing && pages[index] != model.state.value.destination) model.navigate(pages[index])
                        }
                    }
                    BackHandler(state.destination != Destination.Moments) { model.navigate(Destination.Moments) }
                    Box(Modifier.fillMaxSize()) {
                        Scaffold(
                            topBar = {
                                TopAppBar(
                                    title = {
                                        AnimatedContent(
                                            targetState = state.destination,
                                            transitionSpec = { fadeIn(tween(160)) togetherWith fadeOut(tween(100)) },
                                            label = "TopBarTitle",
                                        ) { destination ->
                                            when (destination) {
                                                Destination.Moments, Destination.Tasks -> Text(
                                                    "August",
                                                    style = MaterialTheme.typography.headlineSmall.copy(
                                                        fontFamily = FontFamily.Serif,
                                                        fontStyle = FontStyle.Italic,
                                                    ),
                                                )
                                                Destination.Write -> Text("New moment", style = MaterialTheme.typography.titleLarge)
                                                Destination.Review -> Text("Your review", style = MaterialTheme.typography.titleLarge)
                                                Destination.Graph -> Text("Connections", style = MaterialTheme.typography.titleLarge)
                                                Destination.Settings -> Text("Settings", style = MaterialTheme.typography.titleLarge)
                                            }
                                        }
                                    },
                                    navigationIcon = {
                                        androidx.compose.animation.AnimatedVisibility(
                                            visible = writing,
                                            enter = fadeIn(tween(180)) + expandHorizontally(),
                                            exit = fadeOut(tween(120)) + shrinkHorizontally(),
                                        ) {
                                            IconButton(
                                                onClick = { haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove); model.navigate(Destination.Moments) },
                                            ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back to journal") }
                                        }
                                    },
                                    actions = {
                                        if (state.preview) SuggestionChip(
                                            onClick = { model.navigate(Destination.Settings) }, label = { Text("Sample journal") },
                                        ) else androidx.compose.animation.AnimatedVisibility(
                                            visible = state.destination == Destination.Moments,
                                            enter = fadeIn(tween(160)),
                                            exit = fadeOut(tween(120)),
                                        ) {
                                            IconButton(
                                                onClick = { haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove); model.refreshMoments(force = true) },
                                                enabled = !state.loadingMoments,
                                            ) { Icon(Icons.Default.Refresh, "Refresh moments") }
                                        }
                                        Spacer(Modifier.width(10.dp))
                                    },
                                    colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
                                )
                            },
                            bottomBar = {
                                androidx.compose.animation.AnimatedVisibility(
                                    visible = !writing,
                                    enter = slideInVertically(spring(stiffness = Spring.StiffnessMediumLow)) { it } + fadeIn(tween(140)),
                                    exit = slideOutVertically(spring(stiffness = Spring.StiffnessMedium)) { it } + fadeOut(tween(100)),
                                ) {
                                    JournalNav(
                                        destination = state.destination,
                                        arrivedTab = arrivedTab,
                                        navigate = model::navigate,
                                    )
                                }
                            },
                            snackbarHost = { SnackbarHost(snackbar) },
                        ) { padding ->
                            Box(Modifier.fillMaxSize().padding(padding)) {
                                HorizontalPager(
                                    state = pager,
                                    beyondViewportPageCount = 1,
                                    userScrollEnabled = canSwipe,
                                    modifier = Modifier.fillMaxSize(),
                                    key = { pages[it].name },
                                ) { index ->
                                    val destination = pages[index]
                                    tabs.SaveableStateProvider(destination.name) {
                                        when (destination) {
                                            Destination.Moments -> MomentsScreen(
                                                state, selected = { selectedMoment = it }, write = { model.navigate(Destination.Write) },
                                                retry = { model.refreshMoments(force = true) }, dismissReceipt = model::dismissSaveReceipt, openTasks = model::openTasks,
                                            )
                                            Destination.Write -> Unit
                                            Destination.Review -> ReviewScreen(state, load = model::loadReview, selected = { selectedMoment = it })
                                            Destination.Tasks -> TasksScreen(
                                                state, refresh = { model.refreshTasks(restart = true) }, complete = model::completeTask, edit = model::editTask,
                                                add = model::openTaskForm, reminders = model::taskReminders, write = { model.navigate(Destination.Write) },
                                            )
                                            Destination.Graph -> ConnectionsScreen(state, refresh = model::loadGraph, selectedMoment = { selectedMoment = it })
                                            Destination.Settings -> SettingsScreen(
                                                state, appearance = model::appearance, signOut = model::signOut,
                                                checkServices = model::checkServices, sync = { model.syncFromCloud(force = true) },
                                            )
                                        }
                                    }
                                }
                                androidx.compose.animation.AnimatedVisibility(
                                    visible = writing,
                                    enter = slideInHorizontally(spring(stiffness = Spring.StiffnessMediumLow)) { it } + fadeIn(tween(180)),
                                    exit = slideOutHorizontally(spring(stiffness = Spring.StiffnessMedium)) { it } + fadeOut(tween(140)),
                                    modifier = Modifier.fillMaxSize(),
                                ) {
                                    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                                        WriteScreen(state, edit = model::edit, save = model::save)
                                    }
                                }
                            }
                        }
                        if (!writing) {
                            SavedPassageFlightOverlay(
                                savedNote = state.savedNote,
                                onArrive = { arrivedTab = it },
                            )
                        }
                    }
                }
            }
            if (state.taskFormOpen && (state.device.session != null || state.preview)) {
                TaskEditor(busy = state.creatingTask, saveError = state.taskFormError,
                    close = model::closeTaskForm, save = model::createTask)
            }
            selectedMoment?.let { moment ->
                ModalBottomSheet(
                    onDismissRequest = { selectedMoment = null },
                    sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
                ) {
                    MomentDetail(moment, share = {
                        val share = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, moment.content)
                        }
                        context.startActivity(Intent.createChooser(share, "Share moment"))
                    })
                }
            }
            state.error?.let { message -> AlertDialog(
                onDismissRequest = model::dismissError,
                title = { Text("Couldn't finish that") }, text = { Text(message) },
                confirmButton = { TextButton(onClick = model::dismissError) { Text("Got it") } },
            ) }
            if (state.incomingShare != null && (state.device.session != null || state.preview)) AlertDialog(
                onDismissRequest = model::dismissShare, title = { Text("Keep this in your journal?") },
                text = { Text("Add the shared text to your current draft. You can edit it before saving.") },
                confirmButton = { TextButton(onClick = model::acceptShare, enabled = !state.saving) { Text("Add to draft") } },
                dismissButton = { TextButton(onClick = model::dismissShare) { Text("Cancel") } },
            )
        }
    }
}

@Composable
private fun JournalNav(
    destination: Destination,
    arrivedTab: Destination?,
    navigate: (Destination) -> Unit,
) {
    val tabs = remember {
        listOf(
            Triple(Destination.Moments, "Journal", Icons.Default.Home),
            Triple(Destination.Tasks, "Tasks", Icons.Default.Check),
            Triple(Destination.Review, "Review", Icons.Default.DateRange),
            Triple(Destination.Graph, "Graph", Icons.Default.Share),
            Triple(Destination.Settings, "Settings", Icons.Default.Settings),
        )
    }
    val haptics = LocalHapticFeedback.current
    val palette = MaterialTheme.colorScheme
    Surface(
        color = palette.surfaceContainer,
        tonalElevation = 0.dp,
        shadowElevation = 0.dp,
    ) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding()) {
            HorizontalDivider(thickness = 1.dp, color = palette.outlineVariant)
            Row(
                Modifier.fillMaxWidth().height(64.dp).padding(horizontal = 6.dp).selectableGroup(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                tabs.forEach { (target, label, icon) ->
                    val selected = target == destination
                    val arriving = arrivedTab == target
                    val pillColor by animateColorAsState(
                        targetValue = when {
                            arriving -> palette.primary.copy(alpha = 0.24f)
                            selected -> palette.primaryContainer
                            else -> Color.Transparent
                        },
                        animationSpec = tween(180),
                        label = "NavPillColor",
                    )
                    val contentColor = if (selected || arriving) palette.primary else palette.onSurfaceVariant
                    val interaction = remember { MutableInteractionSource() }
                    Column(
                        Modifier.weight(1f).fillMaxHeight()
                            .selectable(
                                selected = selected,
                                role = Role.Tab,
                                interactionSource = interaction,
                                indication = null,
                                onClick = {
                                    if (!selected) haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    navigate(target)
                                },
                            ),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Box(
                            Modifier.width(52.dp).height(30.dp).clip(RoundedCornerShape(15.dp)).background(pillColor),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(icon, null, Modifier.size(20.dp), tint = contentColor)
                        }
                        Spacer(Modifier.height(3.dp))
                        Text(
                            label,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                            color = contentColor,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }
    }
}

private data class FlightSpec(
    val label: String,
    val target: Destination,
    val tabIndex: Int,
    val bg: Color,
    val ink: Color,
    val delayMs: Int,
)

@Composable
private fun SavedPassageFlightOverlay(
    savedNote: SaveResponse?,
    onArrive: (Destination?) -> Unit,
) {
    var animatedNoteId by rememberSaveable { mutableStateOf<String?>(null) }
    var activeFlights by remember { mutableStateOf<List<FlightSpec>>(emptyList()) }

    LaunchedEffect(savedNote?.noteId) {
        val receipt = savedNote ?: return@LaunchedEffect
        if (receipt.noteId == animatedNoteId) return@LaunchedEffect
        animatedNoteId = receipt.noteId
        val items = buildList {
            receipt.tasks.take(2).forEach { task ->
                add(FlightSpec(task.title, Destination.Tasks, 1, Color(0xFFC3E5F8), Color(0xFF193C54), size * 210))
            }
            receipt.events.take(1).forEach { event ->
                add(FlightSpec(event.title, Destination.Tasks, 1, Color(0xFFBCD9FF), Color(0xFF193C54), size * 210))
            }
            val remaining = receipt.extractedCount - receipt.tasks.size - receipt.events.size
            if (remaining > 0 && size < 4) {
                add(FlightSpec("$remaining saved", Destination.Review, 2, Color(0xFFFFD0DF), Color(0xFF5E2135), size * 210))
            }
        }.take(4)
        if (items.isNotEmpty()) {
            activeFlights = items
            delay(1800)
            onArrive(null)
            activeFlights = emptyList()
        }
    }

    if (activeFlights.isEmpty()) return

    val density = LocalDensity.current
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val widthPx = with(density) { maxWidth.toPx() }
        val heightPx = with(density) { maxHeight.toPx() }
        val navY = heightPx - with(density) { 42.dp.toPx() }
        activeFlights.forEach { item ->
            val progress = remember(animatedNoteId, item.label, item.delayMs) { Animatable(0f) }
            LaunchedEffect(animatedNoteId, item.label, item.delayMs) {
                delay(item.delayMs.toLong())
                progress.animateTo(1f, tween(920, easing = FastOutSlowInEasing))
                onArrive(item.target)
            }
            val startX = widthPx * 0.16f
            val startY = heightPx * (0.28f + (item.delayMs / 210) * 0.045f)
            val endX = (widthPx / 5f) * (item.tabIndex + 0.5f) - with(density) { 54.dp.toPx() }
            val endY = navY
            val ctrlX = (startX + endX) * 0.5f + with(density) { 28.dp.toPx() }
            val ctrlY = minOf(startY, endY) - with(density) { 86.dp.toPx() }

            fun bezier(t: Float): Pair<Float, Float> {
                val u = 1f - t
                val x = u * u * startX + 2f * u * t * ctrlX + t * t * endX
                val y = u * u * startY + 2f * u * t * ctrlY + t * t * endY
                return x to y
            }

            listOf(0.14f, 0.07f).forEachIndexed { idx, lag ->
                Box(
                    Modifier
                        .size((14 + idx * 4).dp)
                        .graphicsLayer {
                            val p = (progress.value - lag).coerceIn(0f, 1f)
                            val (x, y) = bezier(p)
                            translationX = x + 28f
                            translationY = y + 8f
                            alpha = if (progress.value <= 0.02f || p >= 0.96f) 0f else (1f - idx * 0.25f) * 0.55f * (1f - p)
                            val s = 1f - p * 0.4f
                            scaleX = s
                            scaleY = s
                        }
                        .clip(CircleShape)
                        .background(item.bg),
                )
            }

            Surface(
                shape = RoundedCornerShape(999.dp),
                color = item.bg,
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.7f)),
                shadowElevation = 6.dp,
                modifier = Modifier
                    .widthIn(max = 180.dp)
                    .graphicsLayer {
                        val t = progress.value
                        val (x, y) = bezier(t)
                        translationX = x
                        translationY = y
                        val s = if (t < 0.18f) 0.88f + (t / 0.18f) * 0.2f else 1.08f - ((t - 0.18f) / 0.82f) * 0.82f
                        scaleX = s
                        scaleY = s
                        alpha = when {
                            t <= 0.02f -> 0f
                            t < 0.12f -> t / 0.12f
                            t > 0.82f -> (1f - t) / 0.18f
                            else -> 1f
                        }.coerceIn(0f, 1f)
                    },
            ) {
                Text(
                    item.label,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    color = item.ink,
                    style = MaterialTheme.typography.labelMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}
