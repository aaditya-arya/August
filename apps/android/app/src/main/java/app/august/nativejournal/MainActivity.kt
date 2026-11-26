package app.august.nativejournal

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import app.august.nativejournal.ui.AugustApp

class MainActivity : ComponentActivity() {
    private val model: JournalViewModel by viewModels()
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { AugustApp(model) }
        if (savedInstanceState == null) receive(intent)
    }
    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); receive(intent) }
    override fun onStop() { model.flushDraft(); super.onStop() }
    override fun onResume() {
        super.onResume()
        if (model.state.value.device.session != null) {
            model.refreshTasks()
            app.august.nativejournal.tasks.TaskRuntime.update(this, model.state.value.device)
        }
    }
    private fun receive(intent: Intent?) {
        if (intent?.getBooleanExtra("open_tasks", false) == true) { model.openTasks(); intent.removeExtra("open_tasks") }
        if (intent?.action == Intent.ACTION_VIEW && intent.data?.scheme == "augustnative") {
            model.authCallback(intent.data.toString())
            intent.data = null
        }
        if (intent?.action == Intent.ACTION_SEND && intent.type == "text/plain") {
            val text = listOfNotNull(intent.getStringExtra(Intent.EXTRA_SUBJECT), intent.getStringExtra(Intent.EXTRA_TEXT)).distinct().joinToString("\n\n")
            model.receiveShare(text)
            intent.removeExtra(Intent.EXTRA_TEXT); intent.removeExtra(Intent.EXTRA_SUBJECT)
        }
    }
}
