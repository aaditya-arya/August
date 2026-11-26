package app.august.nativejournal

import android.app.Application
import app.august.nativejournal.data.*
import app.august.nativejournal.tasks.TaskRuntime
import kotlinx.coroutines.*

class AugustApplication : Application() {
    val repository by lazy { JournalRepository(EncryptedDeviceStorage(this), AugustHttp(), BuildConfig.DEBUG) }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    override fun onCreate() {
        super.onCreate()
        scope.launch {
            try {
                repository.initialize()
                var previous: Triple<String?, List<JournalTask>, Boolean>? = null
                repository.state.collect { device ->
                    val next = Triple(device.accountKey(), device.cachedTasks[device.accountKey()].orEmpty(), device.taskRemindersEnabled)
                    if (next != previous) { previous = next; TaskRuntime.update(this@AugustApplication, device) }
                }
            } catch (_: Exception) { /* The app shows encrypted-storage recovery errors without overwriting data. */ }
        }
    }
}
