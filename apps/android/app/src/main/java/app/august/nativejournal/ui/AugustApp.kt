package app.august.nativejournal.ui

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
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
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
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
                    BackHandler(state.destination != Destination.Moments) { model.navigate(Destination.Moments) }
                    Scaffold(
                        topBar = {
                            TopAppBar(
                                title = {
                                    Text(when (state.destination) {
                                        Destination.Moments, Destination.Tasks -> "August"
                                        Destination.Write -> "New moment"
                                        Destination.Review -> "Your review"
                                        Destination.Graph -> "Connections"
                                        Destination.Settings -> "Settings"
                                    }, style = MaterialTheme.typography.titleLarge)
                                },
                                navigationIcon = {
                                    if (writing) IconButton(onClick = { model.navigate(Destination.Moments) }) {
                                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back to journal")
                                    }
                                },
                                actions = {
                                    if (state.preview) SuggestionChip(
                                        onClick = { model.navigate(Destination.Settings) }, label = { Text("Sample journal") },
                                    ) else if (state.destination == Destination.Moments) {
                                        IconButton(onClick = model::refreshMoments, enabled = !state.loadingMoments) {
                                            Icon(Icons.Default.Refresh, "Refresh moments")
                                        }
                                    }
                                    Spacer(Modifier.width(10.dp))
                                },
                                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
                            )
                        },
                        bottomBar = { if (!writing) JournalNav(state.destination, model::navigate) },
                        snackbarHost = { SnackbarHost(snackbar) },
                    ) { padding ->
                        Box(Modifier.fillMaxSize().padding(padding)) {
                            val pages = remember { listOf(Destination.Moments, Destination.Tasks, Destination.Review, Destination.Graph, Destination.Settings) }
                            if (writing) {
                                WriteScreen(state, edit = model::edit, save = model::save)
                            } else {
                                val pager = rememberPagerState(initialPage = pages.indexOf(state.destination), pageCount = { pages.size })
                                LaunchedEffect(state.destination) {
                                    val index = pages.indexOf(state.destination)
                                    if (pager.currentPage != index) pager.scrollToPage(index)
                                }
                                LaunchedEffect(pager) {
                                    snapshotFlow { pager.settledPage }.drop(1).collect { index ->
                                        if (pages[index] != model.state.value.destination) model.navigate(pages[index])
                                    }
                                }
                                HorizontalPager(state = pager, modifier = Modifier.fillMaxSize(), key = { pages[it].name }) { index ->
                                    val destination = pages[index]
                                    tabs.SaveableStateProvider(destination.name) {
                                        when (destination) {
                                            Destination.Moments -> MomentsScreen(
                                                state, selected = { selectedMoment = it }, write = { model.navigate(Destination.Write) },
                                                retry = model::refreshMoments, dismissReceipt = model::dismissSaveReceipt, openTasks = model::openTasks,
                                            )
                                            Destination.Write -> WriteScreen(state, edit = model::edit, save = model::save)
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
private fun JournalNav(destination: Destination, navigate: (Destination) -> Unit) {
    val tabs = listOf(
        Triple(Destination.Moments, "Journal", Icons.Default.Home),
        Triple(Destination.Tasks, "Tasks", Icons.Default.Check),
        Triple(Destination.Review, "Review", Icons.Default.DateRange),
        Triple(Destination.Graph, "Graph", Icons.Default.Share),
        Triple(Destination.Settings, "Settings", Icons.Default.Settings),
    )
    Box(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 14.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
        Surface(
            Modifier.widthIn(max = 520.dp).fillMaxWidth(), shape = RoundedCornerShape(30.dp),
            color = MaterialTheme.colorScheme.surfaceContainerLow, shadowElevation = 5.dp,
        ) {
            Row(Modifier.fillMaxWidth().selectableGroup().padding(horizontal = 5.dp, vertical = 4.dp)) {
                tabs.forEach { (target, label, icon) ->
                    val selected = target == destination
                    Column(
                        Modifier.weight(1f).clip(RoundedCornerShape(22.dp))
                            .selectable(selected, role = Role.Tab, onClick = { navigate(target) })
                            .padding(vertical = 5.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = if (selected) MaterialTheme.colorScheme.primaryContainer else androidx.compose.ui.graphics.Color.Transparent,
                        ) {
                            Icon(icon, null, Modifier.padding(horizontal = 14.dp, vertical = 5.dp).size(19.dp),
                                tint = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Text(label, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }
}
