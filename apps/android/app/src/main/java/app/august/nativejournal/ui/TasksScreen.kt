package app.august.nativejournal.ui

import android.Manifest
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.core.content.ContextCompat
import app.august.nativejournal.JournalUiState
import app.august.nativejournal.data.JournalTask
import app.august.nativejournal.tasks.TaskRuntime
import app.august.nativejournal.tasks.TaskWidget
import java.time.*
import java.util.UUID
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasksScreen(state: JournalUiState, refresh: () -> Unit, complete: (JournalTask, Boolean) -> Unit,
                edit: (JournalTask, String, String?) -> Unit, add: () -> Unit, reminders: (Boolean) -> Unit) {
    var grid by rememberSaveable { mutableStateOf(true) }
    var filter by rememberSaveable { mutableStateOf("open") }
    var editing by remember { mutableStateOf<JournalTask?>(null) }
    var now by remember { mutableLongStateOf(Instant.now().epochSecond) }
    LaunchedEffect(Unit) { while (true) { delay(60_000); now = Instant.now().epochSecond } }
    val haptics = LocalHapticFeedback.current
    val finished = state.tasks.count { it.completed }
    val progress by animateFloatAsState(if (state.tasks.isEmpty()) 0f else finished.toFloat() / state.tasks.size, label = "Task progress")
    val visible = remember(state.tasks, filter) { state.tasks.filter { filter == "all" || it.completed == (filter == "completed") }.sortedWith(compareBy({ it.completed }, { it.dueAt ?: "9999" }, { it.createdAt })) }
    LazyVerticalGrid(columns = GridCells.Fixed(if (grid) 2 else 1), modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            val palette = MaterialTheme.colorScheme
            Column(
                Modifier.fillMaxWidth().background(
                    Brush.linearGradient(listOf(palette.primaryContainer, palette.tertiaryContainer)),
                    RoundedCornerShape(28.dp),
                ).padding(22.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text("${state.tasks.size - finished} to do", style = MaterialTheme.typography.headlineMedium, color = palette.onPrimaryContainer)
                        Text("$finished done", style = MaterialTheme.typography.bodyMedium, color = palette.onPrimaryContainer)
                    }
                    Button(onClick = add) {
                        Icon(Icons.Default.Add, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Add task")
                    }
                }
                LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth())
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                LazyRow(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(listOf("open" to "To do", "completed" to "Completed", "all" to "All")) { (value, label) ->
                        FilterChip(selected = filter == value, onClick = { filter = value }, label = { Text(label) })
                    }
                }
                IconButton(onClick = { grid = !grid }, modifier = Modifier.semantics { contentDescription = if (grid) "Switch to list view" else "Switch to grid view" }) {
                    if (grid) Icon(Icons.AutoMirrored.Filled.List, null) else GridIcon()
                }
                IconButton(onClick = refresh, enabled = !state.loadingTasks && !state.preview) { Icon(Icons.Default.Refresh, "Refresh tasks") }
            }
        }
        if (state.loadingTasks) item(span = { GridItemSpan(maxLineSpan) }) { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        state.tasksError?.let { message -> item(span = { GridItemSpan(maxLineSpan) }) { RequestError("Couldn't sync tasks", message, refresh) } }
        if (visible.isEmpty() && !state.loadingTasks && state.tasksError == null) item(span = { GridItemSpan(maxLineSpan) }) {
            EmptyState(if (filter == "completed") "No completed tasks yet" else "You're caught up",
                if (state.tasks.isEmpty()) "Add a task here, or keep writing in your journal to pick up tasks as you go." else "Switch filters to see your other tasks.")
        }
        items(visible, key = { it.id }) { task ->
            val overdue = !task.completed && task.dueAt?.let { runCatching { Instant.parse(it).epochSecond < now }.getOrDefault(false) } == true
            val palette = MaterialTheme.colorScheme
            Card(Modifier.fillMaxWidth().animateItem(), shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = when {
                    task.completed -> palette.surfaceContainer
                    overdue -> palette.errorContainer
                    task.dueAt != null -> palette.secondaryContainer
                    else -> palette.surfaceContainerLow
                })) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        IconButton(onClick = { haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove); complete(task, !task.completed) }, enabled = task.id !in state.updatingTasks) {
                            AnimatedContent(targetState = task.completed, label = "Task check") { done ->
                                if (task.id in state.updatingTasks) CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
                                else if (done) Icon(Icons.Default.CheckCircle, "Reopen ${task.title}", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(28.dp))
                                else TaskCircle(task.title)
                            }
                        }
                        IconButton(onClick = { editing = task }, enabled = task.id !in state.updatingTasks) { Icon(Icons.Default.Edit, "Edit ${task.title}", Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                    Text(task.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold,
                        textDecoration = if (task.completed) TextDecoration.LineThrough else TextDecoration.None)
                    val due = task.dueAt?.let { momentDate(it, "MMM d · h:mm a") } ?: "No deadline"
                    Text(if (overdue) "Overdue · $due" else due, style = MaterialTheme.typography.labelMedium,
                        color = if (overdue) palette.onErrorContainer else palette.onSurfaceVariant)
                }
            }
        }
        if (!state.preview) item(span = { GridItemSpan(maxLineSpan) }) { TaskTools(state, reminders) }
    }
    editing?.let { task ->
        TaskEditor(task, close = { editing = null }, save = { title, due, _ ->
            edit(task, title, due)
            editing = null
        })
    }
}

@Composable
private fun TaskCircle(title: String) {
    val color = MaterialTheme.colorScheme.primary
    Canvas(Modifier.size(28.dp).semantics { contentDescription = "Complete $title" }) { drawCircle(color, radius = size.minDimension / 2 - 2.dp.toPx(), style = Stroke(2.dp.toPx())) }
}

@Composable
private fun GridIcon() {
    val color = MaterialTheme.colorScheme.onSurfaceVariant
    Canvas(Modifier.size(20.dp)) { for (x in 0..1) for (y in 0..1) drawRoundRect(color, Offset(x * size.width * .56f, y * size.height * .56f), Size(size.width * .4f, size.height * .4f), CornerRadius(3.dp.toPx())) }
}

@Composable
private fun TaskTools(state: JournalUiState, reminders: (Boolean) -> Unit) {
    val context = LocalContext.current
    var allowed by remember { mutableStateOf(TaskRuntime.canNotify(context)) }
    var expanded by rememberSaveable { mutableStateOf(false) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) allowed = TaskRuntime.canNotify(context) }
        lifecycle.addObserver(observer); onDispose { lifecycle.removeObserver(observer) }
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        allowed = TaskRuntime.canNotify(context)
        if (granted && allowed) { reminders(true); TaskRuntime.update(context, state.device.copy(taskRemindersEnabled = true)) }
    }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        TextButton(onClick = { expanded = !expanded }, modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.Notifications, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp))
            Text("Reminders & widget", Modifier.weight(1f))
            Text(if (expanded) "Hide" else if (allowed && state.device.taskRemindersEnabled) "On" else "Set up", style = MaterialTheme.typography.labelMedium)
        }
        if (expanded) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f)) {
                Text("Deadline reminders", style = MaterialTheme.typography.titleSmall)
                Text(if (allowed) "One day and one hour before. Android may delay delivery to save battery." else "Enable notifications to get deadline reminders.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (allowed) Switch(checked = state.device.taskRemindersEnabled, onCheckedChange = reminders)
            else TextButton(onClick = {
                if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) permission.launch(Manifest.permission.POST_NOTIFICATIONS)
                else context.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
            }) { Text("Enable") }
        }
        TextButton(onClick = {
            val manager = AppWidgetManager.getInstance(context)
            if (manager.isRequestPinAppWidgetSupported) manager.requestPinAppWidget(ComponentName(context, TaskWidget::class.java), null, null)
            else Toast.makeText(context, "Long press your home screen, choose Widgets, then August Tasks.", Toast.LENGTH_LONG).show()
        }) { Icon(Icons.Default.Add, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text("Add home-screen widget") }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun TaskEditor(task: JournalTask? = null, busy: Boolean = false, saveError: String? = null,
                        close: () -> Unit, save: (String, String?, String) -> Unit) {
    val retryKey = rememberSaveable(task?.id) { UUID.randomUUID().toString() }
    var title by rememberSaveable(task?.id) { mutableStateOf(task?.title.orEmpty()) }
    val original = remember(task?.id) { task?.dueAt?.let { runCatching { Instant.parse(it).atZone(ZoneId.systemDefault()) }.getOrNull() } }
    var dateValue by rememberSaveable(task?.id) { mutableStateOf(original?.toLocalDate()?.toEpochDay()) }
    var minutes by rememberSaveable(task?.id) { mutableIntStateOf(original?.toLocalTime()?.let { it.hour * 60 + it.minute } ?: 540) }
    val day = dateValue?.let(LocalDate::ofEpochDay)
    val time = LocalTime.of(minutes / 60, minutes % 60)
    var showDate by remember { mutableStateOf(false) }
    var showTime by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    ModalBottomSheet(onDismissRequest = close, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().imePadding().verticalScroll(rememberScrollState()).padding(start = 24.dp, end = 24.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(if (task == null) "New task" else "Edit task", Modifier.weight(1f), style = MaterialTheme.typography.headlineMedium)
                IconButton(onClick = close, enabled = !busy) { Icon(Icons.Default.Close, "Close task form") }
            }
            OutlinedTextField(title, { title = it.take(140); error = null }, enabled = !busy, singleLine = true,
                label = { Text("Task title") }, placeholder = { Text("What needs doing?") }, modifier = Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedButton(onClick = { showDate = true }, enabled = !busy) { Text(day?.toString() ?: "Add deadline") }
                if (day != null) {
                    OutlinedButton(onClick = { showTime = true }, enabled = !busy) { Text(time.toString()) }
                    IconButton(onClick = { dateValue = null }, enabled = !busy) { Icon(Icons.Default.Close, "Remove deadline") }
                }
            }
            (error ?: saveError)?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
            Button(enabled = !busy && title.isNotBlank(), modifier = Modifier.fillMaxWidth().height(54.dp), onClick = {
                val local = day?.atTime(time)
                if (local != null && ZoneId.systemDefault().rules.getValidOffsets(local).isEmpty()) {
                    error = "That time does not exist locally. Choose another time."
                } else save(title.trim(), local?.atZone(ZoneId.systemDefault())?.toInstant()?.toString(), retryKey)
            }) { Text(if (busy) "Saving…" else if (task == null) "Add task" else "Save task") }
        }
    }
    if (showDate) {
        val picker = rememberDatePickerState(initialSelectedDateMillis = (day ?: LocalDate.now()).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli())
        DatePickerDialog(onDismissRequest = { showDate = false }, confirmButton = { TextButton(onClick = { picker.selectedDateMillis?.let { dateValue = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toEpochDay() }; showDate = false }) { Text("Choose date") } }, dismissButton = { TextButton(onClick = { showDate = false }) { Text("Cancel") } }) { DatePicker(picker) }
    }
    if (showTime) {
        val picker = rememberTimePickerState(initialHour = time.hour, initialMinute = time.minute)
        AlertDialog(onDismissRequest = { showTime = false }, title = { Text("Choose a time") }, text = { TimeInput(picker) }, confirmButton = { TextButton(onClick = { minutes = picker.hour * 60 + picker.minute; showTime = false }) { Text("Choose time") } }, dismissButton = { TextButton(onClick = { showTime = false }) { Text("Cancel") } })
    }
}
