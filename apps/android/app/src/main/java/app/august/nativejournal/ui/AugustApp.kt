package app.august.nativejournal.ui

import android.content.Intent
import androidx.core.net.toUri
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.shrinkHorizontally
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsDraggedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.august.nativejournal.Destination
import app.august.nativejournal.JournalViewModel
import app.august.nativejournal.data.Moment
import kotlinx.coroutines.flow.distinctUntilChanged

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AugustApp(model: JournalViewModel) {
    val state by model.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }
    val completionHaptics = LocalHapticFeedback.current
    var selectedMoment by remember { mutableStateOf<Moment?>(null) }
    LaunchedEffect(state.device.accountKeyForUi(), state.preview) { selectedMoment = null }
    LaunchedEffect(state.message) { state.message?.let { snackbar.showSnackbar(it); model.consumeMessage() } }
    LaunchedEffect(state.completedTask) {
        state.completedTask?.let { task ->
            completionHaptics.performHapticFeedback(HapticFeedbackType.LongPress)
            if (snackbar.showSnackbar("One more thing, done.", actionLabel = "Undo", duration = SnackbarDuration.Short) == SnackbarResult.ActionPerformed) model.completeTask(task, false)
            model.clearTaskNotice()
        }
    }
    AugustTheme(state.device.appearance) {
        Surface(Modifier.fillMaxSize()) {
            when {
                state.booting -> Box(Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) { CircularProgressIndicator() }
                state.device.session == null && !state.preview -> WelcomeScreen(
                    state = state, addressChanged = model::connectionEdited, checkConnection = model::checkConnection,
                    signIn = { address -> model.signIn(address) { url -> CustomTabsIntent.Builder().build().launchUrl(context, url.toUri()) } },
                    preview = model::preview,
                )
                else -> {
                    val mainTabs = remember { listOf(Destination.Moments, Destination.Tasks, Destination.Review, Destination.Graph, Destination.Settings) }
                    val pagerState = rememberPagerState(
                        initialPage = mainTabs.indexOf(state.destination).coerceAtLeast(0),
                        pageCount = { mainTabs.size },
                    )
                    val haptics = LocalHapticFeedback.current
                    val currentDestination by rememberUpdatedState(state.destination)
                    val dragging by pagerState.interactionSource.collectIsDraggedAsState()
                    var userSwipe by remember { mutableStateOf(false) }
                    LaunchedEffect(dragging) { if (dragging) userSwipe = true }
                    LaunchedEffect(state.destination) {
                        userSwipe = false
                        val target = mainTabs.indexOf(state.destination)
                        if (target >= 0 && target != pagerState.currentPage) {
                            pagerState.animateScrollToPage(target, animationSpec = spring(stiffness = Spring.StiffnessMediumLow))
                        }
                    }
                    LaunchedEffect(pagerState) {
                        snapshotFlow { Triple(pagerState.settledPage, pagerState.isScrollInProgress, userSwipe) }.distinctUntilChanged().collect { (page, moving, swiped) ->
                            if (swiped && !moving) {
                                userSwipe = false
                                val destination = mainTabs[page]
                                if (currentDestination != Destination.Write && currentDestination != destination) model.navigate(destination)
                            }
                        }
                    }
                    BackHandler(state.destination != Destination.Moments) { model.navigate(Destination.Moments) }
                    Scaffold(
                        topBar = {
                            TopAppBar(
                                title = {
                                    AnimatedContent(
                                        targetState = state.destination,
                                        transitionSpec = { fadeIn(tween(180)) togetherWith fadeOut(tween(120)) },
                                        label = "Top bar title",
                                    ) { destination ->
                                        Text(when (destination) {
                                            Destination.Moments -> "August"
                                            Destination.Write -> "New moment"
                                            Destination.Tasks -> "Tasks"
                                            Destination.Review -> "Your review"
                                            Destination.Graph -> "Connections"
                                            Destination.Settings -> "Settings"
                                        }, style = MaterialTheme.typography.titleLarge)
                                    }
                                },
                                navigationIcon = {
                                    AnimatedVisibility(
                                        visible = state.destination == Destination.Write,
                                        enter = fadeIn(tween(180)) + expandHorizontally(),
                                        exit = fadeOut(tween(120)) + shrinkHorizontally(),
                                    ) {
                                        val backInteraction = remember { MutableInteractionSource() }
                                        IconButton(
                                            onClick = { haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove); model.navigate(Destination.Moments) },
                                            interactionSource = backInteraction,
                                            modifier = Modifier.pressScale(backInteraction, targetScale = 0.90f),
                                        ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back to journal") }
                                    }
                                },
                                actions = {
                                    if (state.preview) SuggestionChip(onClick = { model.navigate(Destination.Settings) }, label = { Text("Sample journal") })
                                    Spacer(Modifier.width(8.dp))
                                    AnimatedVisibility(visible = state.destination == Destination.Moments, enter = fadeIn(tween(160)), exit = fadeOut(tween(120))) {
                                        val refreshInteraction = remember { MutableInteractionSource() }
                                        IconButton(
                                            onClick = { haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove); model.refreshMoments() },
                                            enabled = !state.loadingMoments && !state.preview,
                                            interactionSource = refreshInteraction,
                                            modifier = Modifier.pressScale(refreshInteraction, targetScale = 0.90f),
                                        ) { Icon(Icons.Default.Refresh, "Refresh moments") }
                                    }
                                },
                                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
                            )
                        },
                        bottomBar = {
                            AnimatedVisibility(
                                visible = state.destination != Destination.Write,
                                enter = slideInVertically(spring(stiffness = Spring.StiffnessMediumLow)) { it } + fadeIn(tween(160)),
                                exit = slideOutVertically(spring(stiffness = Spring.StiffnessMedium)) { it } + fadeOut(tween(120)),
                            ) {
                                NavigationBar {
                                    val tabs = listOf(
                                        Triple(Destination.Moments, "Journal", Icons.AutoMirrored.Filled.List),
                                        Triple(Destination.Tasks, "Tasks", Icons.Default.Check),
                                        Triple(Destination.Review, "Review", Icons.Default.DateRange),
                                        Triple(Destination.Graph, "Graph", Icons.Default.Share),
                                        Triple(Destination.Settings, "Settings", Icons.Default.Person),
                                    )
                                    tabs.forEach { (destination, label, icon) ->
                                        val selected = state.destination == destination
                                        val iconScale by animateFloatAsState(
                                            targetValue = if (selected) 1.12f else 1f,
                                            animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium),
                                            label = "navIconScale",
                                        )
                                        NavigationBarItem(
                                            selected = selected,
                                            onClick = {
                                                if (!selected) haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                                model.navigate(destination)
                                            },
                                            icon = { Icon(icon, null, modifier = Modifier.graphicsLayer { scaleX = iconScale; scaleY = iconScale }) },
                                            label = { Text(label) },
                                        )
                                    }
                                }
                            }
                        },
                        floatingActionButton = {
                            AnimatedVisibility(
                                visible = state.destination == Destination.Moments,
                                enter = scaleIn(spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium)) + fadeIn(tween(160)),
                                exit = scaleOut(tween(140)) + fadeOut(tween(120)),
                            ) {
                                val fabInteraction = remember { MutableInteractionSource() }
                                ExtendedFloatingActionButton(
                                    onClick = { haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove); model.navigate(Destination.Write) },
                                    interactionSource = fabInteraction,
                                    modifier = Modifier.pressScale(fabInteraction, targetScale = 0.94f).semantics { contentDescription = "Write a moment" },
                                    icon = { Icon(Icons.Default.Edit, null) },
                                    text = { Text("Write a moment") },
                                )
                            }
                        },
                        snackbarHost = { SnackbarHost(snackbar) },
                    ) { padding ->
                        Column(Modifier.fillMaxSize().padding(padding)) {
                            if (state.preview) Text("Preview · sample entries, not your saved journal", style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                                modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.primaryContainer).padding(horizontal = 24.dp, vertical = 8.dp))
                            Box(Modifier.weight(1f).fillMaxWidth()) {
                                HorizontalPager(
                                    state = pagerState,
                                    beyondViewportPageCount = 1,
                                    userScrollEnabled = state.destination != Destination.Write && mainTabs[pagerState.currentPage] != Destination.Graph,
                                    modifier = Modifier.fillMaxSize(),
                                ) { page ->
                                    when (mainTabs[page]) {
                                        Destination.Moments -> MomentsScreen(state, selected = { selectedMoment = it }, write = { model.navigate(Destination.Write) },
                                            retry = model::refreshMoments, navigate = model::navigate)
                                        Destination.Review -> ReviewScreen(state, load = model::loadReview, selected = { selectedMoment = it })
                                        Destination.Tasks -> TasksScreen(state, refresh = model::refreshTasks, complete = model::completeTask, edit = model::editTask,
                                            write = { model.navigate(Destination.Write) }, reminders = model::taskReminders)
                                        Destination.Graph -> ConnectionsScreen(state, refresh = model::loadGraph, selectedMoment = { selectedMoment = it })
                                        Destination.Settings -> SettingsScreen(state, appearance = model::appearance, signOut = model::signOut, checkServices = model::checkServices)
                                        Destination.Write -> Unit
                                    }
                                }
                                androidx.compose.animation.AnimatedVisibility(
                                    visible = state.destination == Destination.Write,
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
                    }
                }
            }
            selectedMoment?.let { moment ->
                ModalBottomSheet(
                    onDismissRequest = { selectedMoment = null },
                    sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
                ) {
                    MomentDetail(moment, share = {
                        context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, moment.content) }, "Share moment"))
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

private fun app.august.nativejournal.data.DeviceState.accountKeyForUi() = "${connection?.server}|${session?.user?.id}"
