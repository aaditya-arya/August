package app.august.nativejournal.ui

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
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
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.august.nativejournal.Destination
import app.august.nativejournal.JournalViewModel
import app.august.nativejournal.data.Moment
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
                    Scaffold(
                        topBar = {
                            TopAppBar(
                                title = {
                                    AnimatedContent(
                                        targetState = state.destination,
                                        transitionSpec = { fadeIn(tween(180)) togetherWith fadeOut(tween(110)) },
                                        label = "TopBarTitle",
                                    ) { destination ->
                                        Text(when (destination) {
                                            Destination.Moments, Destination.Tasks -> "August"
                                            Destination.Write -> "New moment"
                                            Destination.Review -> "Your review"
                                            Destination.Graph -> "Connections"
                                            Destination.Settings -> "Settings"
                                        }, style = MaterialTheme.typography.titleLarge)
                                    }
                                },
                                navigationIcon = {
                                    androidx.compose.animation.AnimatedVisibility(
                                        visible = writing,
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
                                    if (state.preview) SuggestionChip(
                                        onClick = { model.navigate(Destination.Settings) }, label = { Text("Sample journal") },
                                    ) else androidx.compose.animation.AnimatedVisibility(
                                        visible = state.destination == Destination.Moments,
                                        enter = fadeIn(tween(160)),
                                        exit = fadeOut(tween(120)),
                                    ) {
                                        val refreshInteraction = remember { MutableInteractionSource() }
                                        IconButton(
                                            onClick = { haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove); model.refreshMoments() },
                                            enabled = !state.loadingMoments,
                                            interactionSource = refreshInteraction,
                                            modifier = Modifier.pressScale(refreshInteraction, targetScale = 0.90f),
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
                                enter = slideInVertically(spring(stiffness = Spring.StiffnessMediumLow)) { it } + fadeIn(tween(160)),
                                exit = slideOutVertically(spring(stiffness = Spring.StiffnessMedium)) { it } + fadeOut(tween(120)),
                            ) {
                                JournalNav(
                                    destination = state.destination,
                                    currentPage = pager.currentPage,
                                    pageOffset = pager.currentPageOffsetFraction,
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
                                userScrollEnabled = !writing && pager.currentPage != 3,
                                modifier = Modifier.fillMaxSize(),
                                key = { pages[it].name },
                            ) { index ->
                                val destination = pages[index]
                                tabs.SaveableStateProvider(destination.name) {
                                    when (destination) {
                                        Destination.Moments -> MomentsScreen(
                                            state, selected = { selectedMoment = it }, write = { model.navigate(Destination.Write) },
                                            retry = model::refreshMoments, dismissReceipt = model::dismissSaveReceipt, openTasks = model::openTasks,
                                        )
                                        Destination.Write -> Unit
                                        Destination.Review -> ReviewScreen(state, load = model::loadReview, selected = { selectedMoment = it })
                                        Destination.Tasks -> TasksScreen(
                                            state, refresh = { model.refreshTasks() }, complete = model::completeTask, edit = model::editTask,
                                            add = model::openTaskForm, reminders = model::taskReminders, write = { model.navigate(Destination.Write) },
                                        )
                                        Destination.Graph -> ConnectionsScreen(state, refresh = model::loadGraph, selectedMoment = { selectedMoment = it })
                                        Destination.Settings -> SettingsScreen(state, appearance = model::appearance, signOut = model::signOut, checkServices = model::checkServices)
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
    currentPage: Int,
    pageOffset: Float,
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
    val currentDestination by rememberUpdatedState(destination)
    val currentNavigate by rememberUpdatedState(navigate)
    val position = (currentPage + pageOffset).coerceIn(0f, (tabs.size - 1).toFloat())
    Box(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
        Surface(
            Modifier.widthIn(max = 520.dp).fillMaxWidth(), shape = RoundedCornerShape(32.dp),
            color = MaterialTheme.colorScheme.surfaceContainerLow,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.55f)),
            shadowElevation = 6.dp,
        ) {
            BoxWithConstraints(
                Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 5.dp)
                    .pointerInput(tabs.size) {
                        detectHorizontalDragGestures(
                            onHorizontalDrag = { change, _ ->
                                change.consume()
                                val index = ((change.position.x / size.width.coerceAtLeast(1)) * tabs.size).toInt().coerceIn(0, tabs.lastIndex)
                                if (tabs[index].first != currentDestination) {
                                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    currentNavigate(tabs[index].first)
                                }
                            },
                        )
                    },
            ) {
                val tabWidth = maxWidth / tabs.size
                Box(
                    Modifier.offset(x = tabWidth * position)
                        .width(tabWidth)
                        .height(50.dp)
                        .padding(horizontal = 3.dp)
                        .clip(RoundedCornerShape(24.dp))
                        .background(MaterialTheme.colorScheme.primaryContainer),
                )
                Row(Modifier.fillMaxWidth().selectableGroup()) {
                    tabs.forEach { (target, label, icon) ->
                        val selected = target == destination
                        val iconScale by animateFloatAsState(
                            targetValue = if (selected) 1.12f else 1f,
                            animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium),
                            label = "NavIconScale",
                        )
                        Column(
                            Modifier.weight(1f).height(50.dp).clip(RoundedCornerShape(24.dp))
                                .selectable(selected, role = Role.Tab, onClick = {
                                    if (!selected) haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    navigate(target)
                                }),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center,
                        ) {
                            Icon(
                                icon, null,
                                Modifier.size(19.dp).graphicsLayer { scaleX = iconScale; scaleY = iconScale },
                                tint = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.height(2.dp))
                            Text(
                                label,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                                color = if (selected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }
        }
    }
}
