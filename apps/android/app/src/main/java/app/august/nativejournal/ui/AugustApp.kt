package app.august.nativejournal.ui

import android.content.Intent
import androidx.core.net.toUri
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.tween
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.august.nativejournal.Destination
import app.august.nativejournal.JournalViewModel
import app.august.nativejournal.data.Moment

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AugustApp(model: JournalViewModel) {
    val state by model.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }
    var selectedMoment by remember { mutableStateOf<Moment?>(null) }
    LaunchedEffect(state.device.accountKeyForUi(), state.preview) { selectedMoment = null }
    LaunchedEffect(state.message) { state.message?.let { snackbar.showSnackbar(it); model.consumeMessage() } }
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
                    BackHandler(state.destination != Destination.Moments) { model.navigate(Destination.Moments) }
                    Scaffold(
                        topBar = {
                            TopAppBar(
                                title = { Text(if (state.destination == Destination.Write) "New moment" else "August", style = MaterialTheme.typography.titleLarge) },
                                navigationIcon = {
                                    if (state.destination == Destination.Write) IconButton(onClick = { model.navigate(Destination.Moments) }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back to journal") }
                                },
                                actions = {
                                    if (state.preview) SuggestionChip(onClick = { model.navigate(Destination.Settings) }, label = { Text("Sample journal") })
                                    Spacer(Modifier.width(8.dp))
                                    if (state.destination == Destination.Moments) IconButton(onClick = model::refreshMoments, enabled = !state.loadingMoments && !state.preview) { Icon(Icons.Default.Refresh, "Refresh moments") }
                                },
                                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
                            )
                        },
                        bottomBar = {
                            if (state.destination != Destination.Write) NavigationBar {
                                val tabs = listOf(
                                    Triple(Destination.Moments, "Journal", Icons.AutoMirrored.Filled.List),
                                    Triple(Destination.Review, "Review", Icons.Default.DateRange),
                                    Triple(Destination.Graph, "Connections", Icons.Default.Share),
                                    Triple(Destination.Settings, "You", Icons.Default.Person),
                                )
                                tabs.forEach { (destination, label, icon) -> NavigationBarItem(
                                    selected = state.destination == destination,
                                    onClick = { model.navigate(destination) }, icon = { Icon(icon, null) }, label = { Text(label) },
                                ) }
                            }
                        },
                        floatingActionButton = {
                            if (state.destination == Destination.Moments) ExtendedFloatingActionButton(
                                onClick = { model.navigate(Destination.Write) }, icon = { Icon(Icons.Default.Edit, null) }, text = { Text("Write a moment") },
                            )
                        },
                        snackbarHost = { SnackbarHost(snackbar) },
                    ) { padding ->
                        Column(Modifier.fillMaxSize().padding(padding)) {
                            if (state.preview) Text("Preview · sample entries, not your saved journal", style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                                modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.primaryContainer).padding(horizontal = 24.dp, vertical = 8.dp))
                            AnimatedContent(targetState = state.destination, modifier = Modifier.weight(1f), label = "Journal navigation",
                                transitionSpec = { fadeIn(tween(180)) togetherWith fadeOut(tween(90)) }) { destination ->
                            when (destination) {
                                Destination.Moments -> MomentsScreen(state, selected = { selectedMoment = it }, write = { model.navigate(Destination.Write) })
                                Destination.Write -> WriteScreen(state, edit = model::edit, save = model::save)
                                Destination.Review -> ReviewScreen(state, load = model::loadReview, selected = { selectedMoment = it })
                                Destination.Graph -> ConnectionsScreen(state, refresh = model::loadGraph)
                                Destination.Settings -> SettingsScreen(state, appearance = model::appearance, signOut = model::signOut)
                            }
                            }
                        }
                    }
                }
            }
            selectedMoment?.let { moment ->
                ModalBottomSheet(onDismissRequest = { selectedMoment = null }) {
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
