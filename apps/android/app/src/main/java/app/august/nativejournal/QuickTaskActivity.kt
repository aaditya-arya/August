package app.august.nativejournal

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import app.august.nativejournal.ui.AugustTheme
import app.august.nativejournal.ui.TaskForm
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/** A small widget-owned window over the launcher, independent of journal navigation. */
class QuickTaskActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val bars = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
        enableEdgeToEdge(statusBarStyle = bars, navigationBarStyle = bars)
        val repository = (application as AugustApplication).repository
        setContent {
            val device by repository.state.collectAsStateWithLifecycle()
            var loading by remember { mutableStateOf(true) }
            var saving by remember { mutableStateOf(false) }
            var error by remember { mutableStateOf<String?>(null) }
            LaunchedEffect(Unit) {
                try { repository.initialize() }
                catch (failure: Exception) {
                    if (failure is CancellationException) throw failure
                    error = requestMessage(failure)
                }
                finally { loading = false }
            }
            BackHandler(saving) {}
            AugustTheme(device.appearance, styleSystemBars = false) {
                Box(Modifier.fillMaxSize()) {
                    Box(Modifier.matchParentSize().background(Color.Black.copy(alpha = .44f))
                        .clickable(enabled = !saving, onClick = { finish() })
                        .semantics { contentDescription = "Close quick add" })
                    Surface(
                        Modifier.align(Alignment.BottomCenter).fillMaxWidth().navigationBarsPadding().imePadding(),
                        shape = RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp),
                        color = MaterialTheme.colorScheme.surface,
                    ) {
                        when {
                            loading -> Box(Modifier.fillMaxWidth().padding(30.dp), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator()
                            }
                            device.session == null -> Column(Modifier.padding(26.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text("New task", style = MaterialTheme.typography.displaySmall)
                                Text(error ?: "Sign in to save tasks to your journal.")
                                Button(onClick = {
                                    startActivity(Intent(this@QuickTaskActivity, MainActivity::class.java))
                                    finish()
                                }) { Text("Open August") }
                            }
                            else -> TaskForm(busy = saving, saveError = error, autoFocus = true, close = { finish() }) { title, due, key ->
                                if (!saving) {
                                    saving = true
                                    error = null
                                    lifecycleScope.launch {
                                        try {
                                            repository.createTask(title, due, key)
                                            finish()
                                            Toast.makeText(applicationContext, "Task added", Toast.LENGTH_SHORT).show()
                                        } catch (failure: Exception) {
                                            if (failure is CancellationException) throw failure
                                            error = requestMessage(failure)
                                        } finally { saving = false }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
