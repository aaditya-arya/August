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
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.FontFamily
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
import java.time.format.DateTimeFormatter
import java.util.UUID
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasksScreen(
    state: JournalUiState, refresh: () -> Unit, complete: (JournalTask, Boolean) -> Unit,
    edit: (JournalTask, String, String?) -> Unit, add: () -> Unit, reminders: (Boolean) -> Unit,
    write: () -> Unit,
) {
    var layout by rememberSaveable { mutableStateOf("grid") }
    var filter by rememberSaveable { mutableStateOf("open") }
    var dayFilter by rememberSaveable { mutableStateOf<Long?>(null) }
    var editing by remember { mutableStateOf<JournalTask?>(null) }
    var now by remember { mutableLongStateOf(Instant.now().epochSecond) }
    LaunchedEffect(Unit) { while (true) { delay(60_000); now = Instant.now().epochSecond } }
    val today = Instant.ofEpochSecond(now).atZone(ZoneId.systemDefault()).toLocalDate()
    val finished = state.tasks.count { it.completed }
    val progress by animateFloatAsState(
        if (state.tasks.isEmpty()) 0f else finished.toFloat() / state.tasks.size, label = "Task progress",
    )
    val visible = remember(state.tasks, filter, dayFilter) {
        state.tasks.filter { task ->
            val matchesStatus = when (filter) {
                "completed" -> task.completed
                "reminders" -> !task.completed && task.kind == "reminder"
                "all" -> true
                else -> !task.completed
            }
            val matchesDay = dayFilter == null || task.dueAt?.let {
                runCatching { Instant.parse(it).atZone(ZoneId.systemDefault()).toLocalDate().toEpochDay() }.getOrNull()
            } == dayFilter
            matchesStatus && matchesDay
        }.sortedWith(compareBy({ it.completed }, { it.dueAt ?: "9999" }, { it.createdAt }))
    }
    LazyVerticalGrid(
        columns = GridCells.Fixed(if (layout == "grid") 2 else 1), modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 8.dp, bottom = 22.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(13.dp),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Column(Modifier.weight(1f)) {
                    Text("Your plans", style = plannerTitle())
                    Text("${state.tasks.size - finished} open · $finished done",
                        style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                FilledIconButton(onClick = add, modifier = Modifier.size(49.dp).semantics { contentDescription = "Add task" }) {
                    Icon(Icons.Default.Add, null)
                }
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            PlannerWeek(today, dayFilter) { dayFilter = if (dayFilter == it) null else it }
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                LinearProgressIndicator(progress = { progress }, modifier = Modifier.weight(1f).height(5.dp).clip(RoundedCornerShape(4.dp)))
                TextButton(onClick = { dayFilter = null }, enabled = dayFilter != null) {
                    Text(if (dayFilter == null) "All dates" else "Clear date")
                }
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(listOf("open" to "To do", "reminders" to "Reminders", "completed" to "Done", "all" to "All")) { (value, label) ->
                    FilterChip(selected = filter == value, onClick = { filter = value }, label = { Text(label) })
                }
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(if (filter == "completed") "Completed" else "Up next", Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
                IconButton(onClick = { layout = if (layout == "grid") "list" else "grid" }) {
                    if (layout == "grid") Icon(Icons.AutoMirrored.Filled.List, "Switch to list view")
                    else Box(Modifier.semantics { contentDescription = "Switch to grid view" }) { GridIcon() }
                }
                FilledTonalIconButton(onClick = { layout = if (layout == "focus") "grid" else "focus" }) {
                    Icon(Icons.Default.PlayArrow, if (layout == "focus") "Exit focus view" else "Focus view")
                }
                IconButton(onClick = refresh, enabled = !state.loadingTasks && !state.preview) {
                    Icon(Icons.Default.Refresh, "Refresh tasks")
                }
            }
        }
        if (state.loadingTasks) item(span = { GridItemSpan(maxLineSpan) }) { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        state.tasksError?.let { message -> item(span = { GridItemSpan(maxLineSpan) }) { RequestError("Couldn't sync tasks", message, refresh) } }
        if (visible.isEmpty() && !state.loadingTasks && state.tasksError == null) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                EmptyState(
                    if (dayFilter != null) "Nothing due that day" else if (filter == "completed") "No completed tasks yet" else "Nothing on this list",
                    if (state.tasks.isEmpty()) "Write naturally in your journal. August picks up tasks and reminders when you save."
                    else "Try another filter to see your other tasks.",
                    if (state.tasks.isEmpty()) "Write in journal" else null, write,
                )
            }
        } else if (layout == "focus" && visible.isNotEmpty()) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                TaskDeck(visible, state.updatingTasks, now, complete) { editing = it }
            }
        } else {
            items(visible, key = { it.id }) { task ->
                PlannerCard(task, task.id in state.updatingTasks, now, false, Modifier.animateItem(), complete) { editing = task }
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
private fun PlannerWeek(today: LocalDate, selected: Long?, choose: (Long) -> Unit) {
    val days = remember(today) { (-1L..5L).map(today::plusDays) }
    LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        items(days, key = { it.toEpochDay() }) { date ->
            val active = date.toEpochDay() == selected
            val palette = MaterialTheme.colorScheme
            Surface(
                onClick = { choose(date.toEpochDay()) }, shape = RoundedCornerShape(17.dp),
                color = if (active) palette.primary else palette.surfaceContainerLow,
                contentColor = if (active) palette.onPrimary else palette.onSurface,
                modifier = Modifier.widthIn(min = 45.dp).semantics {
                    contentDescription = date.format(DateTimeFormatter.ofPattern("EEEE, MMMM d"))
                },
            ) {
                Column(
                    Modifier.padding(horizontal = 6.dp, vertical = 9.dp), horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Text(date.format(DateTimeFormatter.ofPattern("EEE")), style = MaterialTheme.typography.labelSmall)
                    Text(date.dayOfMonth.toString(), style = MaterialTheme.typography.titleMedium)
                    Box(Modifier.size(4.dp).clip(RoundedCornerShape(2.dp))
                        .background(if (date == today) LocalContentColor.current else androidx.compose.ui.graphics.Color.Transparent))
                }
            }
        }
    }
}

@Composable
private fun TaskDeck(
    tasks: List<JournalTask>, updating: Set<String>, now: Long,
    complete: (JournalTask, Boolean) -> Unit, edit: (JournalTask) -> Unit,
) {
    val pager = rememberPagerState(pageCount = { tasks.size })
    val scope = rememberCoroutineScope()
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        HorizontalPager(
            state = pager, contentPadding = PaddingValues(end = if (tasks.size > 1) 22.dp else 0.dp),
            pageSpacing = 10.dp, key = { tasks[it].id },
        ) { index ->
            val task = tasks[index]
            PlannerCard(task, task.id in updating, now, true, Modifier.graphicsLayer {
                val distance = kotlin.math.abs(pager.currentPage - index + pager.currentPageOffsetFraction).coerceIn(0f, 1f)
                scaleX = 1f - .09f * distance
                scaleY = scaleX
                rotationZ = -3f * distance
                alpha = 1f - .22f * distance
            }.heightIn(min = 250.dp), complete) { edit(task) }
        }
        if (tasks.size > 1) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { scope.launch { pager.animateScrollToPage(pager.currentPage - 1) } }, enabled = pager.currentPage > 0) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Previous task")
            }
            Text("${pager.currentPage + 1} of ${tasks.size}", style = MaterialTheme.typography.labelMedium)
            IconButton(onClick = { scope.launch { pager.animateScrollToPage(pager.currentPage + 1) } }, enabled = pager.currentPage < tasks.lastIndex) {
                Icon(Icons.AutoMirrored.Filled.ArrowForward, "Next task")
            }
        }
    }
}

@Composable
private fun PlannerCard(
    task: JournalTask, updating: Boolean, now: Long, focused: Boolean, modifier: Modifier,
    complete: (JournalTask, Boolean) -> Unit, edit: () -> Unit,
) {
    val palette = MaterialTheme.colorScheme
    val haptics = LocalHapticFeedback.current
    val reminder = task.kind == "reminder"
    val overdue = !reminder && !task.completed &&
        task.dueAt?.let { runCatching { Instant.parse(it).epochSecond < now }.getOrDefault(false) } == true
    val tint = when {
        task.completed -> palette.surfaceContainer
        overdue -> palette.errorContainer
        reminder -> palette.tertiaryContainer
        task.dueAt != null -> palette.secondaryContainer
        else -> palette.primaryContainer
    }
    Box(modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp))
        .background(Brush.linearGradient(listOf(palette.surfaceContainerLow, tint)))) {
        Canvas(Modifier.matchParentSize()) {
            val center = Offset(size.width, size.height * .87f)
            repeat(4) { index ->
                drawCircle(palette.primary.copy(alpha = .10f), size.width * (.13f + .12f * index), center, style = Stroke(1.dp.toPx()))
            }
        }
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(if (reminder) "Reminder" else "Task", style = MaterialTheme.typography.labelLarge, color = palette.onSurfaceVariant)
            Text(task.title, style = if (focused) plannerTitle() else MaterialTheme.typography.titleLarge.copy(fontFamily = FontFamily.Serif),
                fontWeight = FontWeight.SemiBold, textDecoration = if (task.completed) TextDecoration.LineThrough else TextDecoration.None)
            if (focused && task.title != task.content) {
                Text(task.content, maxLines = 3, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                    style = MaterialTheme.typography.bodyMedium, color = palette.onSurfaceVariant)
            }
            val due = task.dueAt?.let { momentDate(it, "MMM d · h:mm a") } ?: if (reminder) "No time set" else "No deadline"
            Text(if (overdue) "Overdue · $due" else due, style = MaterialTheme.typography.labelMedium, color = palette.onSurfaceVariant)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                FilledTonalIconButton(onClick = {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    complete(task, !task.completed)
                }, enabled = !updating) {
                    AnimatedContent(targetState = task.completed, label = "Task check") { done ->
                        if (updating) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
                        else if (done) Icon(Icons.Default.CheckCircle, "Reopen ${task.title}")
                        else TaskCircle(task.title)
                    }
                }
                IconButton(onClick = edit, enabled = !updating) {
                    Icon(Icons.Default.Edit, "Edit ${task.title}", Modifier.size(18.dp), tint = palette.onSurfaceVariant)
                }
            }
        }
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
                Text(if (allowed) "Reminders at their set time. Task alerts one day and one hour before deadlines."
                    else "Enable notifications for tasks and reminders.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
    ModalBottomSheet(onDismissRequest = close, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        TaskForm(task, busy, saveError, close = close, save = save)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun TaskForm(task: JournalTask? = null, busy: Boolean = false, saveError: String? = null,
                      autoFocus: Boolean = false, close: () -> Unit, save: (String, String?, String) -> Unit) {
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
    val focus = remember { FocusRequester() }
    LaunchedEffect(autoFocus) { if (autoFocus) focus.requestFocus() }
        Column(Modifier.fillMaxWidth().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 22.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(if (task == null) "New task" else "Edit task", Modifier.weight(1f), style = MaterialTheme.typography.displaySmall)
                IconButton(onClick = close, enabled = !busy) { Icon(Icons.Default.Close, "Close task form") }
            }
            OutlinedTextField(title, { title = it.take(140); error = null }, enabled = !busy, singleLine = true,
                label = { Text("Task title") }, placeholder = { Text("What needs doing?") },
                modifier = Modifier.fillMaxWidth().focusRequester(focus))
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
    if (showDate) {
        val picker = rememberDatePickerState(initialSelectedDateMillis = (day ?: LocalDate.now()).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli())
        DatePickerDialog(onDismissRequest = { showDate = false }, confirmButton = { TextButton(onClick = { picker.selectedDateMillis?.let { dateValue = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toEpochDay() }; showDate = false }) { Text("Choose date") } }, dismissButton = { TextButton(onClick = { showDate = false }) { Text("Cancel") } }) { DatePicker(picker) }
    }
    if (showTime) {
        val picker = rememberTimePickerState(initialHour = time.hour, initialMinute = time.minute)
        AlertDialog(onDismissRequest = { showTime = false }, title = { Text("Choose a time") }, text = { TimeInput(picker) }, confirmButton = { TextButton(onClick = { minutes = picker.hour * 60 + picker.minute; showTime = false }) { Text("Choose time") } }, dismissButton = { TextButton(onClick = { showTime = false }) { Text("Cancel") } })
    }
}
