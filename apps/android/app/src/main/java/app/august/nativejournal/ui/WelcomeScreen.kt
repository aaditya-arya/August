package app.august.nativejournal.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import app.august.nativejournal.JournalUiState
import app.august.nativejournal.data.PUBLIC_JOURNAL

@Composable
fun WelcomeScreen(
    state: JournalUiState,
    addressChanged: () -> Unit,
    checkConnection: (String) -> Unit,
    signIn: (String) -> Unit,
    preview: () -> Unit,
) {
    val saved = state.device.connection?.server ?: PUBLIC_JOURNAL
    var custom by rememberSaveable { mutableStateOf(saved != PUBLIC_JOURNAL) }
    var address by rememberSaveable { mutableStateOf(saved) }
    val blocked = state.busy || state.checkingConnection
    val palette = MaterialTheme.colorScheme
    Column(
        Modifier.fillMaxSize().safeDrawingPadding().imePadding().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Text("August", style = MaterialTheme.typography.titleLarge)
        Column(
            Modifier.fillMaxWidth().background(
                Brush.linearGradient(listOf(palette.primaryContainer, palette.tertiaryContainer)),
                RoundedCornerShape(36.dp),
            ).padding(28.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Icon(Icons.Default.Edit, null, Modifier.size(34.dp), tint = palette.onPrimaryContainer)
            Text("Make time\nfor yourself.", style = MaterialTheme.typography.displayMedium, color = palette.onPrimaryContainer)
            Text("A journal for what’s on your mind.", style = MaterialTheme.typography.bodyLarge, color = palette.onPrimaryContainer)
        }
        if (custom) {
            OutlinedTextField(
                address, { address = it; addressChanged() }, label = { Text("Server address") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                singleLine = true, enabled = !blocked, modifier = Modifier.fillMaxWidth(),
            )
            TextButton(onClick = { checkConnection(address) }, enabled = address.isNotBlank() && !blocked) {
                Text(if (state.checkingConnection) "Checking…" else "Check connection")
            }
            state.connectionMessage?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
        }
        Button(
            onClick = { signIn(if (custom) address else PUBLIC_JOURNAL) },
            enabled = !blocked && (!custom || address.isNotBlank()),
            modifier = Modifier.fillMaxWidth().height(56.dp),
        ) {
            if (state.busy) {
                CircularProgressIndicator(Modifier.size(18.dp), color = palette.onPrimary, strokeWidth = 2.dp)
                Spacer(Modifier.width(10.dp))
            }
            Text(if (state.busy) "Opening Google…" else "Continue with Google")
        }
        state.connectionError?.let { Text(it, color = palette.error, style = MaterialTheme.typography.bodyMedium) }
        TextButton(onClick = preview, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Explore a sample journal") }
        TextButton(onClick = { custom = !custom; addressChanged() }, enabled = !blocked, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Text(if (custom) "Use the public journal" else "Use a different server")
        }
    }
}
