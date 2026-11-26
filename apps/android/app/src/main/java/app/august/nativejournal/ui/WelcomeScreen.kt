package app.august.nativejournal.ui

import android.content.Intent
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.net.toUri
import app.august.nativejournal.BuildConfig
import app.august.nativejournal.JournalUiState
import app.august.nativejournal.data.normalizeServer

@Composable
fun WelcomeScreen(state: JournalUiState, addressChanged: () -> Unit, checkConnection: (String) -> Unit,
                  signIn: (String) -> Unit, preview: () -> Unit) {
    val server = state.device.connection?.server.orEmpty()
    var address by rememberSaveable(server) { mutableStateOf(server) }
    val context = LocalContext.current
    val blocked = state.busy || state.checkingConnection
    val ready = state.checkedServer != null && state.connectionGoogleEnabled
    val openBrowser = {
        runCatching {
            val origin = normalizeServer(address, BuildConfig.DEBUG)
            context.startActivity(Intent(Intent.ACTION_VIEW, origin.toUri()))
        }.onFailure { Toast.makeText(context, it.message ?: "A browser could not be opened.", Toast.LENGTH_LONG).show() }
        Unit
    }
    Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding().verticalScroll(rememberScrollState())
        .padding(horizontal = 24.dp, vertical = 28.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.primary, modifier = Modifier.size(44.dp)) {
                Box(contentAlignment = Alignment.Center) { Text("A", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onPrimary) }
            }
            Column { Text("August", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("A little more perspective", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("A place for\nwhat matters.", fontSize = 40.sp, lineHeight = 46.sp, letterSpacing = (-1).sp, fontWeight = FontWeight.Bold)
            Text("Your moments, ideas, and small discoveries. Together in a journal that grows with you.", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Surface(shape = RoundedCornerShape(28.dp), color = MaterialTheme.colorScheme.primaryContainer) {
            Row(Modifier.fillMaxWidth().padding(22.dp), horizontalArrangement = Arrangement.spacedBy(18.dp), verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = CircleShape, color = MaterialTheme.colorScheme.surface.copy(alpha = .7f), modifier = Modifier.size(56.dp)) {
                    Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.Edit, null, tint = MaterialTheme.colorScheme.primary) }
                }
                Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text("Small moments. Bigger picture.", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                    Text("Write freely. Reflect gently. Find your way back.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
                }
            }
        }
        OutlinedCard(shape = RoundedCornerShape(24.dp), colors = CardDefaults.outlinedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Surface(shape = CircleShape, color = MaterialTheme.colorScheme.surfaceContainerHigh, modifier = Modifier.size(32.dp)) {
                        Box(contentAlignment = Alignment.Center) { Text("1", style = MaterialTheme.typography.labelLarge) }
                    }
                    Column { Text("Connect your journal", style = MaterialTheme.typography.titleMedium)
                        Text("Use the address shown on your computer.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
                OutlinedTextField(value = address, onValueChange = { address = it; addressChanged() }, label = { Text("Server address") },
                    placeholder = { Text("http://192.168.x.x:3000") }, singleLine = true, enabled = !blocked,
                    isError = state.connectionError != null,
                    supportingText = { Text(if (address.contains("10.0.2.2")) "That's an emulator address. On a phone, use your PC's Wi-Fi address." else "Keep your phone and PC on the same Wi-Fi.") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri), modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp))
                val checkInteraction = remember { MutableInteractionSource() }
                FilledTonalButton(onClick = { checkConnection(address) }, enabled = address.isNotBlank() && !blocked,
                    interactionSource = checkInteraction,
                    modifier = Modifier.fillMaxWidth().height(48.dp).pressScale(checkInteraction), shape = RoundedCornerShape(14.dp)) {
                    if (state.checkingConnection) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    else Icon(if (ready) Icons.Default.CheckCircle else Icons.Default.Refresh, null, Modifier.size(18.dp))
                    Spacer(Modifier.width(10.dp))
                    Text(if (state.checkingConnection) "Checking your server…" else if (ready) "Check again" else "Check connection")
                }
                if (state.checkingConnection) TextButton(onClick = addressChanged, modifier = Modifier.align(Alignment.End)) { Text("Cancel") }
            }
        }
        AnimatedVisibility(
            visible = state.connectionError != null,
            enter = expandVertically(spring(stiffness = Spring.StiffnessMediumLow)) + fadeIn(),
            exit = shrinkVertically(spring(stiffness = Spring.StiffnessMediumLow)) + fadeOut(),
        ) {
            state.connectionError?.let { message ->
                Surface(shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.errorContainer,
                    modifier = Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite }) {
                    Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Let's check the connection", style = MaterialTheme.typography.titleSmall)
                        Text(message, style = MaterialTheme.typography.bodyMedium)
                        TextButton(onClick = openBrowser) { Text("Open address in browser") }
                    }
                }
            }
        }
        AnimatedVisibility(
            visible = state.connectionMessage != null,
            enter = expandVertically(spring(stiffness = Spring.StiffnessMediumLow)) + fadeIn(),
            exit = shrinkVertically(spring(stiffness = Spring.StiffnessMediumLow)) + fadeOut(),
        ) {
            state.connectionMessage?.let { message ->
                Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.secondaryContainer, RoundedCornerShape(18.dp)).padding(16.dp)
                    .semantics { liveRegion = LiveRegionMode.Polite }, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(if (ready) Icons.Default.CheckCircle else Icons.Default.Info, null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSecondaryContainer)
                    Text(message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSecondaryContainer)
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("2  ·  Make it yours", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            val signInInteraction = remember { MutableInteractionSource() }
            Button(onClick = { signIn(address) }, enabled = ready && !blocked, interactionSource = signInInteraction,
                modifier = Modifier.fillMaxWidth().height(56.dp).pressScale(signInInteraction), shape = RoundedCornerShape(18.dp)) {
                if (state.busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                else Text("G", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                Spacer(Modifier.width(12.dp)); Text(if (state.busy) "Opening Google…" else "Continue with Google")
            }
            Text("Your Google account keeps your saved journal together across devices.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        TextButton(onClick = preview, enabled = !blocked, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Explore a sample journal") }
    }
}
