package app.august.nativejournal

import android.Manifest
import android.app.NotificationManager
import android.appwidget.AppWidgetHost
import android.appwidget.AppWidgetHostView
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.graphics.Bitmap
import android.os.Build
import android.os.ParcelFileDescriptor
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.compose.setContent
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.foundation.layout.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.asAndroidBitmap
import android.os.Bundle
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.ListenableWorker
import androidx.work.testing.TestListenableWorkerBuilder
import androidx.work.workDataOf
import app.august.nativejournal.data.*
import app.august.nativejournal.tasks.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.encodeToString
import okhttp3.mockwebserver.*
import org.json.JSONObject
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import java.io.File
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

/** Entirely synthetic on-device backend; never uses Google or the user's Supabase. */
@RunWith(AndroidJUnit4::class)
class TasksIntegrationTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val repository get() = (context.applicationContext as AugustApplication).repository
    private val server = MockWebServer()
    private val saved = ConcurrentHashMap<String, JournalTask>()
    private val id = "11111111-1111-4111-8111-111111111111"
    private var connected = false
    private val reflectionStarted = java.util.concurrent.CountDownLatch(1)

    @Before fun connectSyntheticJournal() = runBlocking {
        repository.initialize()
        Assume.assumeTrue("Use a test emulator; existing signed-in accounts are left untouched.", repository.state.value.session == null)
        val now = Instant.now()
        saved[id] = JournalTask(id, "Build the test website", "I want to create a website.", now.plusSeconds(172800).toString(), updatedAt = now.toString(), createdAt = now.toString())
        saved["22222222-2222-4222-8222-222222222222"] = JournalTask("22222222-2222-4222-8222-222222222222", "Try a product prototype", "I am working on a new product.", updatedAt = now.toString(), createdAt = now.toString())
        server.start()
        val origin = server.url("/").toString().trimEnd('/')
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.requestUrl!!.encodedPath
                val body = when (path) {
                    "/api/auth/config" -> AugustJson.encodeToString(AuthConfig(origin, "public-test-key", true))
                    "/auth/v1/token" -> AugustJson.encodeToString(Session("synthetic-access", "synthetic-refresh", now.epochSecond + 3600, user = Account("task-integration-user", "tester@example.test")))
                    "/api/tasks" -> if (request.method == "PATCH") {
                        val update = JSONObject(request.body.readUtf8())
                        val taskId = update.getString("item_id")
                        val previous = saved[taskId] ?: return MockResponse().setResponseCode(404).setBody("""{"error":"Missing task"}""")
                        val next = previous.copy(completed = if (update.has("completed")) update.getBoolean("completed") else previous.completed,
                            title = if (update.has("title")) update.getString("title") else previous.title,
                            dueAt = if (update.has("due_at")) if (update.isNull("due_at")) null else update.getString("due_at") else previous.dueAt)
                        saved[taskId] = next
                        AugustJson.encodeToString(TaskMutation(next))
                    } else if (request.method == "POST") {
                        val data = JSONObject(request.body.readUtf8())
                        val key = checkNotNull(request.getHeader("Idempotency-Key"))
                        val task = saved.computeIfAbsent(key) {
                            val created = Instant.now().toString()
                            JournalTask(key, data.getString("title"), data.getString("title"),
                                data.optString("due_at").ifBlank { null }, updatedAt = created, createdAt = created)
                        }
                        AugustJson.encodeToString(TaskMutation(task))
                    } else AugustJson.encodeToString(TasksResponse(saved.values.sortedBy { it.id }))
                    "/api/items" -> """{"items":[]}"""
                    "/api/digest/synthesis" -> {
                        if (request.requestUrl?.queryParameter("summary") != "1") {
                            reflectionStarted.countDown()
                            return MockResponse().setBody("""{"status":"unavailable","message":"Synthetic Gemini outage"}""")
                                .setBodyDelay(2, java.util.concurrent.TimeUnit.SECONDS)
                        }
                        AugustJson.encodeToString(ReviewResponse("summary", selectedCount = 1, entries = listOf(
                            Moment("synthetic-moment", "I sent the first prototype.", "Milestone_HardWork",
                                eventTimestamp = now.toString(), createdAt = now.toString(), memory = Memory("The first prototype")),
                        )))
                    }
                    "/api/graph" -> """{"nodes":[],"links":[]}"""
                    else -> "{}"
                }
                return MockResponse().setHeader("Content-Type", "application/json").setBody(body)
            }
        }
        repository.connect(origin)
        repository.beginSignIn()
        val attempt = repository.state.value.authAttempt!!
        repository.completeSignIn("$AUTH_CALLBACK?native_state=${attempt.state}&code=synthetic-code")
        repository.tasks()
        connected = true
    }

    @After fun disconnect() = runBlocking {
        if (connected) { repository.signOut(); TaskRuntime.update(context, repository.state.value); server.shutdown() }
    }

    @Test fun signedInTaskGridCompletesAndUndoesWithoutLosingTheUndatedTask() {
        compose.waitUntil(15_000) { compose.onAllNodesWithText("Tasks", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Tasks", useUnmergedTree = true).performClick()
        compose.onNodeWithContentDescription("Complete Build the test website").performScrollTo().assertIsDisplayed()
        screenshot("tasks-grid.png")
        compose.onNodeWithContentDescription("Complete Build the test website").performClick()
        compose.waitUntil(10_000) { repository.state.value.cachedTasks.values.flatten().any { it.id == id && it.completed } }
        compose.onNodeWithText("One more thing, done.").assertIsDisplayed()
        compose.onNodeWithText("Undo").performClick()
        compose.waitUntil(10_000) { repository.state.value.cachedTasks.values.flatten().any { it.id == id && !it.completed } }
        assertTrue(repository.state.value.cachedTasks.values.flatten().any { it.dueAt == null })
    }

    @Test fun notificationsDeliverOnceAndCompletionCancelsThem() = runBlocking {
        if (Build.VERSION.SDK_INT >= 33) InstrumentationRegistry.getInstrumentation().uiAutomation.grantRuntimePermission(context.packageName, Manifest.permission.POST_NOTIFICATIONS)
        TaskRuntime.update(context, repository.state.value)
        compose.waitUntil(5_000) { TaskRuntime.canNotify(context) }
        val account = repository.state.value.accountKey()!!
        val task = saved[id]!!
        val data = workDataOf("account" to account, "task_id" to id, "due_at" to task.dueAt, "record" to "synthetic-reminder", "label" to "Due tomorrow")
        val worker = TestListenableWorkerBuilder<TaskReminderWorker>(context).setInputData(data).build()
        assertEquals(ListenableWorker.Result.success(), worker.doWork())
        val manager = context.getSystemService(NotificationManager::class.java)
        compose.waitUntil(5_000) { manager.activeNotifications.any { it.tag == TaskRuntime.CHANNEL } }
        assertEquals(1, manager.activeNotifications.count { it.tag == TaskRuntime.CHANNEL })
        TestListenableWorkerBuilder<TaskReminderWorker>(context).setInputData(data).build().doWork()
        assertEquals(1, repository.state.value.deliveredTaskReminders.count { it == "synthetic-reminder" })
        repository.completeTask(id, true)
        TaskRuntime.update(context, repository.state.value)
        compose.waitUntil(5_000) { manager.activeNotifications.none { it.tag == TaskRuntime.CHANNEL } }
        assertEquals(0, manager.activeNotifications.count { it.tag == TaskRuntime.CHANNEL })
        TestListenableWorkerBuilder<TaskReminderWorker>(context).setInputData(data).build().doWork()
        assertEquals(0, manager.activeNotifications.count { it.tag == TaskRuntime.CHANNEL })
    }

    @Test fun clearingADeadlineKeepsTheTaskOnTheBoard() {
        compose.waitUntil(15_000) { compose.onAllNodesWithText("Tasks", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Tasks", useUnmergedTree = true).performClick()
        compose.onNodeWithContentDescription("Edit Build the test website").performScrollTo().performClick()
        compose.onNodeWithContentDescription("Remove deadline").performClick()
        compose.onNodeWithText("Save task").performClick()
        compose.waitUntil(10_000) { saved[id]?.dueAt == null && repository.state.value.cachedTasks.values.flatten().any { it.id == id && it.dueAt == null } }
        assertFalse(saved[id]!!.completed)
    }

    @Test fun reviewShowsSavedWeekBeforeAndAfterTheAiRequestFails() {
        compose.waitUntil(15_000) { compose.onAllNodesWithText("Review", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Review", useUnmergedTree = true).performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("1 saved moment").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("The first prototype").assertIsDisplayed()
        compose.waitUntil(10_000) { reflectionStarted.count == 0L && compose.onAllNodesWithText("Reflection unavailable").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("The first prototype").performScrollTo().assertIsDisplayed()
    }

    @Test fun widgetDisplaysCachedTasksAndItsCheckButtonSavesCompletion() = withWidget { widget, manager, widgetId ->
        screenshot("tasks-widget.png")
        manager.updateAppWidgetOptions(widgetId, Bundle().apply { putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 180); putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 180) })
        TaskWidget.render(context, repository.state.value)
        compose.waitUntil(10_000) {
            var count = 0
            compose.runOnIdle { count = widget.findViewById<LinearLayout>(R.id.widget_tasks)?.childCount ?: 0 }
            count == 1
        }
        compose.runOnIdle {
            assertEquals("Build the test website", widget.findViewById<TextView>(R.id.widget_task_title).text.toString())
            widget.findViewById<ImageButton>(R.id.widget_task_check).performClick()
        }
        compose.waitUntil(10_000) { saved[id]?.completed == true }
        compose.waitUntil(10_000) { repository.state.value.cachedTasks.values.flatten().any { it.id == id && it.completed } }
    }

    @Test fun addingAnUndatedTaskUpdatesTheCompactWidgetImmediately() = withWidget(showApp = true) { widget, manager, widgetId ->
        manager.updateAppWidgetOptions(widgetId, Bundle().apply { putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 180) })
        compose.runOnIdle { assertTrue(widget.findViewById<TextView>(R.id.widget_add).hasOnClickListeners()) }
        compose.onNodeWithText("Tasks", useUnmergedTree = true).performClick()
        compose.onNodeWithText("Add task").performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("New task").fetchSemanticsNodes().isNotEmpty() }
        compose.onNode(hasSetTextAction() and hasText("Task title")).performTextInput("Send the design")
        screenshot("tasks-quick-add.png")
        compose.onAllNodesWithText("Add task").onLast().performClick()
        compose.waitUntil(10_000) { saved.values.any { it.title == "Send the design" } }
        compose.waitUntil(10_000) {
            var shown = false
            compose.runOnIdle {
                val rows = widget.findViewById<LinearLayout>(R.id.widget_tasks)
                shown = rows?.childCount == 1 &&
                    rows.getChildAt(0).findViewById<TextView>(R.id.widget_task_title).text.toString() == "Send the design"
            }
            shown
        }
        assertTrue(saved.values.single { it.title == "Send the design" }.dueAt == null)
    }

    private fun withWidget(showApp: Boolean = false, run: (AppWidgetHostView, AppWidgetManager, Int) -> Unit) {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand("appwidget grantbind --package ${context.packageName} --user 0")).use { it.readBytes() }
        val manager = AppWidgetManager.getInstance(context)
        val provider = ComponentName(context, TaskWidget::class.java)
        val host = AppWidgetHost(context, 41004)
        val widgetId = host.allocateAppWidgetId()
        try {
            assertTrue("Test launcher must be permitted to bind August's widget", manager.bindAppWidgetIdIfAllowed(widgetId, provider))
            lateinit var widget: AppWidgetHostView
            compose.runOnUiThread {
                host.startListening()
                widget = host.createView(context, widgetId, manager.getAppWidgetInfo(widgetId))
                compose.activity.setContent {
                    Box(Modifier.fillMaxSize()) {
                        AndroidView(factory = { widget }, modifier = Modifier.fillMaxWidth().height(320.dp))
                        // Keep the widget host attached while the app creates a task.
                        if (showApp) app.august.nativejournal.ui.AugustApp(androidx.lifecycle.viewmodel.compose.viewModel())
                    }
                }
            }
            manager.updateAppWidgetOptions(widgetId, Bundle().apply { putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 350); putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 350) })
            TaskWidget.render(context, repository.state.value)
            compose.waitUntil(10_000) {
                var count = 0
                compose.runOnIdle { count = widget.findViewById<LinearLayout>(R.id.widget_tasks)?.childCount ?: 0 }
                count > 0
            }
            run(widget, manager, widgetId)
        } finally { host.stopListening(); host.deleteAppWidgetId(widgetId) }
    }

    private fun screenshot(name: String) {
        val image = InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot() ?: compose.onRoot().captureToImage().asAndroidBitmap()
        File(context.getExternalFilesDir(null), name).outputStream().use { image.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
