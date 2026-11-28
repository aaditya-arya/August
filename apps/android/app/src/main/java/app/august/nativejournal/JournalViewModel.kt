package app.august.nativejournal

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.august.nativejournal.data.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.SerializationException

enum class Destination { Moments, Write, Tasks, Review, Graph, Settings }

data class JournalUiState(
    val booting: Boolean = true,
    val device: DeviceState = DeviceState(),
    val destination: Destination = Destination.Moments,
    val draft: String = "",
    val draftStored: Boolean = true,
    val moments: List<Moment> = emptyList(),
    val review: ReviewResponse? = null,
    val graph: GraphResponse? = null,
    val tasks: List<JournalTask> = emptyList(),
    val loadingTasks: Boolean = false,
    val tasksError: String? = null,
    val updatingTasks: Set<String> = emptySet(),
    val completedTask: JournalTask? = null,
    val taskFormOpen: Boolean = false,
    val creatingTask: Boolean = false,
    val taskFormError: String? = null,
    val reviewPeriod: String = "7",
    val busy: Boolean = false,
    val saving: Boolean = false,
    val loadingMoments: Boolean = false,
    val loadingReview: Boolean = false,
    val loadingReflection: Boolean = false,
    val reflectionError: String? = null,
    val loadingGraph: Boolean = false,
    val momentsError: String? = null,
    val reviewError: String? = null,
    val graphError: String? = null,
    val serverStatus: ServerStatus? = null,
    val loadingServices: Boolean = false,
    val servicesError: String? = null,
    val error: String? = null,
    val message: String? = null,
    val preview: Boolean = false,
    val incomingShare: String? = null,
    val checkingConnection: Boolean = false,
    val checkedServer: String? = null,
    val connectionGoogleEnabled: Boolean = false,
    val connectionMessage: String? = null,
    val connectionError: String? = null,
)

class JournalViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = (application as AugustApplication).repository
    private val mutable = MutableStateFlow(JournalUiState())
    val state = mutable.asStateFlow()
    private val initialized = CompletableDeferred<Unit>()
    private var draftJob: Job? = null
    private var reviewJob: Job? = null
    private var graphJob: Job? = null
    private var momentJob: Job? = null
    private var servicesJob: Job? = null
    private var tasksJob: Job? = null
    private var reviewRequest = 0
    private var graphRequest = 0
    private var connectionJob: Job? = null
    private var tasksRequested = false
    private var quickAddRequested = false
    private var taskRead = 0

    init {
        viewModelScope.launch {
            try {
                repository.initialize()
                initialized.complete(Unit)
                repository.state.collect { device ->
                    val changed = mutable.value.device.accountKey() != device.accountKey()
                    val priorTasks = mutable.value.device.cachedTasks[device.accountKey()]
                    val tasksChanged = !changed && priorTasks.orEmpty() != device.cachedTasks[device.accountKey()].orEmpty()
                    if (changed) {
                        momentJob?.cancel(); reviewJob?.cancel(); graphJob?.cancel(); servicesJob?.cancel(); tasksJob?.cancel()
                        reviewRequest++; graphRequest++
                    }
                    if (tasksChanged) { reviewJob?.cancel(); reviewRequest++ }
                    mutable.update { current ->
                        if (changed) current.copy(device = device, booting = false,
                            draft = device.drafts[device.accountKey()]?.content.orEmpty(), draftStored = true,
                            moments = device.cachedMoments[device.accountKey()].orEmpty(), review = null, graph = null,
                            destination = if (tasksRequested && device.session != null) Destination.Tasks else Destination.Moments, preview = false, loadingMoments = false, loadingReview = false, loadingGraph = false,
                            momentsError = null, reviewError = null, reflectionError = null, loadingReflection = false,
                            graphError = null, serverStatus = null, servicesError = null, loadingServices = false,
                            taskFormOpen = quickAddRequested && device.session != null, creatingTask = false, taskFormError = null,
                            tasks = device.cachedTasks[device.accountKey()].orEmpty(), loadingTasks = false, tasksError = null, updatingTasks = emptySet(), completedTask = null)
                        else current.copy(device = device, booting = false, tasks = if (current.preview) current.tasks else device.cachedTasks[device.accountKey()].orEmpty(),
                            review = if (tasksChanged && current.destination != Destination.Review) null else current.review,
                            loadingReview = if (tasksChanged) false else current.loadingReview,
                            loadingReflection = if (tasksChanged) false else current.loadingReflection)
                    }
                    if (changed && device.session != null) { refreshMoments(); refreshTasks() }
                    if (device.session != null) { tasksRequested = false; quickAddRequested = false }
                    if (tasksChanged && state.value.destination == Destination.Review && !state.value.preview) loadReview()
                }
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                mutable.update { it.copy(booting = false, error = "Encrypted device data could not be restored. It has not been overwritten. Restart August to try again.") }
                initialized.completeExceptionally(error)
            }
        }
    }

    fun navigate(destination: Destination) {
        mutable.update { it.copy(destination = destination) }
        if (destination == Destination.Review && state.value.review == null && !state.value.preview && !state.value.loadingReview) loadReview()
        if (destination == Destination.Graph && state.value.graph == null && !state.value.preview && !state.value.loadingGraph) loadGraph()
        if (destination == Destination.Settings && state.value.serverStatus == null && !state.value.preview && !state.value.loadingServices) checkServices()
        if (destination == Destination.Tasks && !state.value.preview) refreshTasks()
    }

    fun openTasks(add: Boolean = false) {
        tasksRequested = true
        quickAddRequested = add
        if (state.value.device.session != null) {
            tasksRequested = false
            quickAddRequested = false
            navigate(Destination.Tasks)
            if (add) openTaskForm()
        }
    }

    fun openTaskForm() { mutable.update { it.copy(taskFormOpen = true, taskFormError = null) } }
    fun closeTaskForm() { if (!state.value.creatingTask) mutable.update { it.copy(taskFormOpen = false, taskFormError = null) } }

    fun createTask(title: String, dueAt: String?, retryKey: String) {
        if (state.value.creatingTask) return
        if (state.value.preview) {
            val now = java.time.Instant.now().toString()
            val task = JournalTask(retryKey, title, title, dueAt, updatedAt = now, createdAt = now)
            mutable.update { it.copy(tasks = it.tasks + task, taskFormOpen = false, message = "Task added to sample journal") }
            return
        }
        val key = state.value.device.accountKey() ?: return
        mutable.update { it.copy(creatingTask = true, taskFormError = null) }
        viewModelScope.launch {
            try {
                repository.createTask(title, dueAt, retryKey)
                if (key == repository.state.value.accountKey()) {
                    mutable.update { it.copy(taskFormOpen = false, message = "Task added") }
                    refreshMoments()
                }
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                if (key == repository.state.value.accountKey()) mutable.update { it.copy(taskFormError = requestMessage(error)) }
            } finally {
                if (key == repository.state.value.accountKey()) mutable.update { it.copy(creatingTask = false) }
            }
        }
    }

    fun dismissError() { mutable.update { it.copy(error = null) } }
    fun consumeMessage() { mutable.update { it.copy(message = null) } }

    fun connectionEdited() {
        connectionJob?.cancel()
        mutable.update { it.copy(checkingConnection = false, checkedServer = null, connectionMessage = null, connectionError = null, connectionGoogleEnabled = false) }
    }

    fun checkConnection(server: String) {
        if (state.value.busy || state.value.checkingConnection) return
        mutable.update { it.copy(checkingConnection = true, checkedServer = null, connectionError = null, connectionMessage = null) }
        connectionJob = viewModelScope.launch {
            try {
                initialized.await()
                val connection = repository.connect(server)
                mutable.update { it.copy(checkedServer = connection.server, connectionGoogleEnabled = connection.config.googleEnabled,
                    connectionMessage = if (connection.config.googleEnabled) "Connected. Your journal is ready for sign-in." else "Your server is reachable. Enable Google sign-in in Supabase to continue.") }
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                mutable.update { it.copy(connectionError = error.message ?: "Could not check your server.") }
            } finally { mutable.update { it.copy(checkingConnection = false) } }
        }
    }

    fun signIn(server: String, openBrowser: (String) -> Unit) {
        if (state.value.busy || state.value.checkingConnection) return
        mutable.update { it.copy(busy = true, error = null, connectionError = null) }
        viewModelScope.launch {
            try {
                initialized.await()
                val address = normalizeServer(server, BuildConfig.DEBUG)
                if (address != state.value.checkedServer || !state.value.connectionGoogleEnabled) {
                    val connection = repository.connect(address)
                    check(connection.config.googleEnabled) { "Google sign-in is unavailable on this server." }
                    mutable.update { it.copy(checkedServer = connection.server, connectionGoogleEnabled = true) }
                }
                openBrowser(repository.beginSignIn())
            }
            catch (error: Exception) {
                if (error is CancellationException) throw error
                mutable.update { it.copy(connectionError = error.message ?: "Could not open Google sign-in.") }
            }
            finally { mutable.update { it.copy(busy = false) } }
        }
    }

    fun authCallback(url: String) {
        viewModelScope.launch {
            try { initialized.await(); mutable.update { it.copy(busy = true, error = null) }; repository.completeSignIn(url) }
            catch (error: Exception) { report(error) }
            finally { mutable.update { it.copy(busy = false) } }
        }
    }

    fun edit(value: String) {
        mutable.update { it.copy(draft = value, draftStored = false) }
        if (state.value.preview) return
        draftJob?.cancel()
        val key = state.value.device.accountKey()
        draftJob = viewModelScope.launch {
            delay(300)
            persistDraft(value, key)
        }
    }

    private suspend fun persistDraft(value: String, key: String?) {
        if (repository.state.value.accountKey() != key || key == null) return
        try {
            repository.setDraft(value, key)
            if (state.value.draft == value) mutable.update { it.copy(draftStored = true) }
        } catch (error: Exception) { report(error) }
    }

    fun flushDraft() {
        if (state.value.preview || state.value.draftStored) return
        draftJob?.cancel()
        val current = state.value
        draftJob = viewModelScope.launch { persistDraft(current.draft, current.device.accountKey()) }
    }

    fun save() {
        if (state.value.saving || state.value.draft.isBlank()) return
        if (state.value.preview) { mutable.update { it.copy(message = "This is a sample journal. Connect your server to save your own moments.") }; return }
        val submitted = state.value.draft
        mutable.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            try {
                draftJob?.cancel()
                repository.setDraft(submitted)
                val saved = repository.save()
                reviewJob?.cancel(); graphJob?.cancel(); momentJob?.cancel()
                reviewRequest++; graphRequest++
                mutable.update { it.copy(draft = "", draftStored = true, review = null, graph = null,
                    loadingReview = false, loadingReflection = false, loadingGraph = false, loadingMoments = false,
                    reviewError = null, reflectionError = null, graphError = null,
                    destination = Destination.Moments, message = "Moment saved · ${saved.extractedCount} ${if (saved.extractedCount == 1) "memory" else "memories"} kept") }
                refreshMoments()
                refreshTasks(restart = true)
            } catch (error: Exception) { report(error) }
            finally { mutable.update { it.copy(saving = false) } }
        }
    }

    fun refreshMoments() {
        if (state.value.loadingMoments || state.value.preview) return
        val key = state.value.device.accountKey() ?: return
        mutable.update { it.copy(loadingMoments = true, momentsError = null) }
        momentJob = viewModelScope.launch {
            try { val moments = repository.moments(); if (key == repository.state.value.accountKey()) mutable.update { it.copy(moments = moments) } }
            catch (error: Exception) {
                if (error is CancellationException) throw error
                if (key == repository.state.value.accountKey()) mutable.update { it.copy(momentsError = requestMessage(error)) }
            }
            finally { if (key == repository.state.value.accountKey()) mutable.update { it.copy(loadingMoments = false) } }
        }
    }

    fun loadReview(period: String = state.value.reviewPeriod, refresh: Boolean = false) {
        if (state.value.preview) { mutable.update { it.copy(reviewPeriod = period) }; return }
        reviewJob?.cancel()
        val request = ++reviewRequest
        mutable.update { it.copy(reviewPeriod = period, loadingReview = true, loadingReflection = false, reviewError = null, reflectionError = null,
            review = if (it.reviewPeriod == period) it.review else null) }
        reviewJob = viewModelScope.launch {
            var hasSummary = false
            try {
                val summary = repository.review(period, refresh, summary = true)
                if (request != reviewRequest) return@launch
                hasSummary = true
                mutable.update { it.copy(
                    review = if (summary.review == null && !refresh && it.review?.review != null) it.review else summary,
                    loadingReview = false, loadingReflection = summary.status == "summary" && summary.selectedCount > 0,
                ) }
                if (summary.status != "summary" || summary.selectedCount == 0) return@launch
                val review = repository.review(period, refresh)
                if (request == reviewRequest) mutable.update { current ->
                    current.copy(review = if (review.review != null) review else current.review ?: summary,
                        reflectionError = review.message.takeIf { review.review == null })
                }
            }
            catch (error: Exception) {
                if (error is CancellationException) throw error
                if (request == reviewRequest) mutable.update {
                    if (hasSummary) it.copy(reflectionError = requestMessage(error))
                    else it.copy(reviewError = requestMessage(error))
                }
            }
            finally { if (request == reviewRequest) mutable.update { it.copy(loadingReview = false, loadingReflection = false) } }
        }
    }

    fun loadGraph() {
        if (state.value.preview) return
        graphJob?.cancel()
        val request = ++graphRequest
        mutable.update { it.copy(loadingGraph = true, graphError = null) }
        graphJob = viewModelScope.launch {
            try { val graph = repository.graph(); if (request == graphRequest) mutable.update { it.copy(graph = graph) } }
            catch (error: Exception) {
                if (error is CancellationException) throw error
                if (request == graphRequest) mutable.update { it.copy(graphError = requestMessage(error)) }
            }
            finally { if (request == graphRequest) mutable.update { it.copy(loadingGraph = false) } }
        }
    }

    fun checkServices() {
        if (state.value.preview || state.value.loadingServices) return
        val key = state.value.device.accountKey() ?: return
        mutable.update { it.copy(loadingServices = true, servicesError = null) }
        servicesJob = viewModelScope.launch {
            try {
                val result = repository.serverStatus()
                if (key == repository.state.value.accountKey()) mutable.update { it.copy(serverStatus = result) }
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                if (key == repository.state.value.accountKey()) mutable.update {
                    it.copy(servicesError = if (error is ApiFailure && error.status == 404)
                        "Server checks need the latest August web deployment. Your existing journal can still be opened."
                    else requestMessage(error))
                }
            } finally { if (key == repository.state.value.accountKey()) mutable.update { it.copy(loadingServices = false) } }
        }
    }

    fun appearance(value: String) { viewModelScope.launch { try { repository.appearance(value) } catch (error: Exception) { report(error) } } }

    fun refreshTasks(restart: Boolean = false) {
        if (state.value.preview || (state.value.loadingTasks && !restart)) return
        val key = state.value.device.accountKey() ?: return
        tasksJob?.cancel()
        val read = ++taskRead
        mutable.update { it.copy(loadingTasks = true, tasksError = null) }
        tasksJob = viewModelScope.launch {
            try { repository.tasks() }
            catch (error: Exception) {
                if (error is CancellationException) throw error
                if (read == taskRead && key == repository.state.value.accountKey()) mutable.update { it.copy(tasksError = requestMessage(error)) }
            } finally { if (read == taskRead && key == repository.state.value.accountKey()) mutable.update { it.copy(loadingTasks = false) } }
        }
    }

    fun completeTask(task: JournalTask, completed: Boolean) {
        if (task.id in state.value.updatingTasks) return
        if (state.value.preview) {
            mutable.update { it.copy(tasks = it.tasks.map { saved -> if (saved.id == task.id) saved.copy(completed = completed) else saved }, completedTask = if (completed) task else null) }
            return
        }
        val key = state.value.device.accountKey() ?: return
        mutable.update { it.copy(updatingTasks = it.updatingTasks + task.id, tasksError = null) }
        viewModelScope.launch {
            try {
                val saved = repository.completeTask(task.id, completed)
                if (key == repository.state.value.accountKey()) mutable.update { it.copy(completedTask = if (completed) saved else null, review = null) }
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                if (key == repository.state.value.accountKey()) mutable.update { it.copy(tasksError = requestMessage(error)) }
            } finally { if (key == repository.state.value.accountKey()) mutable.update { it.copy(updatingTasks = it.updatingTasks - task.id) } }
        }
    }

    fun editTask(task: JournalTask, title: String, dueAt: String?) {
        if (task.id in state.value.updatingTasks) return
        if (state.value.preview) { mutable.update { it.copy(tasks = it.tasks.map { saved -> if (saved.id == task.id) saved.copy(title = title, dueAt = dueAt) else saved }) }; return }
        val key = state.value.device.accountKey() ?: return
        mutable.update { it.copy(updatingTasks = it.updatingTasks + task.id, tasksError = null) }
        viewModelScope.launch {
            try { repository.editTask(task.id, title, dueAt, task.updatedAt) }
            catch (error: Exception) {
                if (error is CancellationException) throw error
                if (key == repository.state.value.accountKey()) mutable.update { it.copy(tasksError = requestMessage(error)) }
            } finally { if (key == repository.state.value.accountKey()) mutable.update { it.copy(updatingTasks = it.updatingTasks - task.id) } }
        }
    }
    fun clearTaskNotice() { mutable.update { it.copy(completedTask = null) } }
    fun taskReminders(enabled: Boolean) { viewModelScope.launch { try { repository.taskReminders(enabled) } catch (error: Exception) { report(error) } } }

    fun signOut() {
        draftJob?.cancel(); reviewJob?.cancel(); graphJob?.cancel(); momentJob?.cancel(); servicesJob?.cancel(); tasksJob?.cancel()
        if (state.value.preview) { mutable.update { JournalUiState(booting = false, device = repository.state.value) }; return }
        viewModelScope.launch {
            try {
                val current = state.value
                if (!current.draftStored) repository.setDraft(current.draft)
                repository.signOut()
            } catch (error: Exception) { report(error) }
        }
    }

    fun receiveShare(text: String) {
        if (text.isBlank()) return
        mutable.update { it.copy(incomingShare = text.take(200_000)) }
    }
    fun acceptShare() {
        if (state.value.saving) return
        val shared = state.value.incomingShare ?: return
        edit(listOf(state.value.draft, shared).filter { it.isNotBlank() }.joinToString("\n\n"))
        mutable.update { it.copy(incomingShare = null, destination = Destination.Write) }
    }
    fun dismissShare() { mutable.update { it.copy(incomingShare = null) } }

    fun preview() {
        val moments = PreviewJournal.moments
        mutable.update { it.copy(preview = true, moments = moments, graph = PreviewJournal.graph, review = PreviewJournal.review,
            tasks = PreviewJournal.tasks,
            destination = Destination.Moments, error = null) }
    }

    private fun report(error: Exception) {
        if (error is CancellationException) throw error
        mutable.update { it.copy(error = requestMessage(error)) }
    }
}

fun requestMessage(error: Exception): String = when (error) {
    is SerializationException -> "August couldn't read this server response. Check that the app and web deployment are up to date, then retry."
    else -> error.message ?: "Something went wrong. Please try again."
}
