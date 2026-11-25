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

enum class Destination { Moments, Write, Review, Graph, Settings }

data class JournalUiState(
    val booting: Boolean = true,
    val device: DeviceState = DeviceState(),
    val destination: Destination = Destination.Moments,
    val draft: String = "",
    val draftStored: Boolean = true,
    val moments: List<Moment> = emptyList(),
    val review: ReviewResponse? = null,
    val graph: GraphResponse? = null,
    val reviewPeriod: String = "7",
    val busy: Boolean = false,
    val saving: Boolean = false,
    val loadingMoments: Boolean = false,
    val loadingReview: Boolean = false,
    val loadingGraph: Boolean = false,
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
    private val repository = JournalRepository(EncryptedDeviceStorage(application), AugustHttp(), BuildConfig.DEBUG)
    private val mutable = MutableStateFlow(JournalUiState())
    val state = mutable.asStateFlow()
    private val initialized = CompletableDeferred<Unit>()
    private var draftJob: Job? = null
    private var reviewJob: Job? = null
    private var graphJob: Job? = null
    private var momentJob: Job? = null
    private var reviewRequest = 0
    private var graphRequest = 0
    private var connectionJob: Job? = null

    init {
        viewModelScope.launch {
            try {
                repository.initialize()
                mutable.update { it.copy(booting = false) }
                initialized.complete(Unit)
                repository.state.collect { device ->
                    val changed = mutable.value.device.accountKey() != device.accountKey()
                    if (changed) {
                        momentJob?.cancel(); reviewJob?.cancel(); graphJob?.cancel()
                        reviewRequest++; graphRequest++
                    }
                    mutable.update { current ->
                        if (changed) current.copy(device = device,
                            draft = device.drafts[device.accountKey()]?.content.orEmpty(), draftStored = true,
                            moments = device.cachedMoments[device.accountKey()].orEmpty(), review = null, graph = null,
                            destination = Destination.Moments, preview = false, loadingMoments = false, loadingReview = false, loadingGraph = false)
                        else current.copy(device = device)
                    }
                    if (changed && device.session != null) refreshMoments()
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
        if (destination == Destination.Review && state.value.review == null && !state.value.preview) loadReview()
        if (destination == Destination.Graph && state.value.graph == null && !state.value.preview) loadGraph()
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
        if (state.value.busy) return
        if (state.value.checkedServer == null || !state.value.connectionGoogleEnabled) {
            mutable.update { it.copy(connectionError = "Check your server connection before signing in.") }
            return
        }
        mutable.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                initialized.await()
                check(normalizeServer(server, BuildConfig.DEBUG) == state.value.checkedServer) { "The address changed. Check the connection again." }
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
                mutable.update { it.copy(draft = "", draftStored = true, review = null, graph = null,
                    destination = Destination.Moments, message = "Moment saved · ${saved.extractedCount} ${if (saved.extractedCount == 1) "memory" else "memories"} kept") }
                refreshMoments()
            } catch (error: Exception) { report(error) }
            finally { mutable.update { it.copy(saving = false) } }
        }
    }

    fun refreshMoments() {
        if (state.value.loadingMoments || state.value.preview) return
        val key = state.value.device.accountKey() ?: return
        mutable.update { it.copy(loadingMoments = true) }
        momentJob = viewModelScope.launch {
            try { val moments = repository.moments(); if (key == repository.state.value.accountKey()) mutable.update { it.copy(moments = moments) } }
            catch (error: Exception) { report(error) }
            finally { if (key == repository.state.value.accountKey()) mutable.update { it.copy(loadingMoments = false) } }
        }
    }

    fun loadReview(period: String = state.value.reviewPeriod, refresh: Boolean = false) {
        reviewJob?.cancel()
        val request = ++reviewRequest
        mutable.update { it.copy(reviewPeriod = period, loadingReview = true, review = null) }
        reviewJob = viewModelScope.launch {
            try { val review = repository.review(period, refresh); if (request == reviewRequest) mutable.update { it.copy(review = review) } }
            catch (error: Exception) { report(error) }
            finally { if (request == reviewRequest) mutable.update { it.copy(loadingReview = false) } }
        }
    }

    fun loadGraph() {
        graphJob?.cancel()
        val request = ++graphRequest
        mutable.update { it.copy(loadingGraph = true) }
        graphJob = viewModelScope.launch {
            try { val graph = repository.graph(); if (request == graphRequest) mutable.update { it.copy(graph = graph) } }
            catch (error: Exception) { report(error) }
            finally { if (request == graphRequest) mutable.update { it.copy(loadingGraph = false) } }
        }
    }

    fun appearance(value: String) { viewModelScope.launch { try { repository.appearance(value) } catch (error: Exception) { report(error) } } }

    fun signOut() {
        draftJob?.cancel(); reviewJob?.cancel(); graphJob?.cancel(); momentJob?.cancel()
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
            destination = Destination.Moments, error = null) }
    }

    private fun report(error: Exception) {
        if (error is CancellationException) throw error
        mutable.update { it.copy(error = error.message ?: "Something went wrong. Please try again.") }
    }
}
