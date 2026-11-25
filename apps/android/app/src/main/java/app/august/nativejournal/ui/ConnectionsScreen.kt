package app.august.nativejournal.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.core.graphics.toColorInt
import app.august.nativejournal.JournalUiState
import app.august.nativejournal.data.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
fun ConnectionsScreen(state: JournalUiState, refresh: () -> Unit) {
    var category by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    var zoom by remember { mutableFloatStateOf(1f) }
    var pan by remember { mutableStateOf(Offset.Zero) }
    val graph = state.graph ?: GraphResponse()
    val categories = remember(graph) { graph.nodes.map { it.group }.distinct().sorted() }
    val eligible = remember(graph, category) { graph.nodes.filter { category == null || category == it.group } }
    var placed by remember { mutableStateOf<List<PlacedNode>>(emptyList()) }
    LaunchedEffect(eligible, graph.links) {
        placed = withContext(Dispatchers.Default) { layoutGraph(eligible, graph.links) }
        zoom = 1f; pan = Offset.Zero
    }
    val selected = placed.find { it.node.id == selectedId }?.node
    val edgeColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = .22f)
    val selectedColor = MaterialTheme.colorScheme.onSurface
    LazyColumn(contentPadding = PaddingValues(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        item { PageHeading("Follow a thought", "Everything connects.", "Explore the shared subjects and meanings in your journal.") }
        if (state.loadingGraph) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        if (!state.loadingGraph && graph.nodes.isEmpty()) item {
            EmptyState("Connections grow as you write.", "Keep a few moments to discover the threads between them.", "Refresh connections", refresh)
        }
        if (categories.isNotEmpty()) item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item { FilterChip(selected = category == null, onClick = { category = null; selectedId = null }, label = { Text("All threads") }) }
                items(categories) { value -> FilterChip(selected = category == value, onClick = { category = value; selectedId = null }, label = { Text(categoryLabel(value)) }) }
            }
        }
        if (placed.isNotEmpty()) item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                Canvas(Modifier.fillMaxWidth().height(340.dp)
                    .semantics { contentDescription = "Graph of ${placed.size} journal moments. Pinch to zoom, drag to explore, or use the accessible moment list below." }
                    .pointerInput(placed) { detectTransformGestures { _, movement, scale, _ -> zoom = (zoom * scale).coerceIn(.75f, 4f); pan += movement } }
                    .pointerInput(placed, zoom, pan) { detectTapGestures { tap ->
                        val center = Offset(size.width / 2f, size.height / 2f)
                        selectedId = placed.minByOrNull { position ->
                            val point = (Offset(position.x * size.width, position.y * size.height) - center) * zoom + center + pan
                            (point - tap).getDistance()
                        }?.takeIf { position ->
                            val point = (Offset(position.x * size.width, position.y * size.height) - center) * zoom + center + pan
                            (point - tap).getDistance() <= 32.dp.toPx()
                        }?.node?.id
                    } }) {
                    fun point(node: PlacedNode) = (Offset(node.x * size.width, node.y * size.height) - center) * zoom + center + pan
                    val byId = placed.associateBy { it.node.id }
                    graph.links.forEach { edge ->
                        val a = byId[edge.source]; val b = byId[edge.target]
                        if (a != null && b != null) drawLine(edgeColor, point(a), point(b), strokeWidth = (1 + edge.weight).toFloat() * density)
                    }
                    placed.forEach { node ->
                        val color = runCatching { Color(node.node.color.toColorInt()) }.getOrDefault(Color(0xFF5855D6))
                        if (node.node.id == selectedId) drawCircle(selectedColor, 14.dp.toPx(), point(node))
                        drawCircle(color, if (node.node.id == selectedId) 10.dp.toPx() else 7.dp.toPx(), point(node))
                    }
                }
            }
        }
        if (placed.isNotEmpty()) item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("${placed.size} of ${eligible.size} moments", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                TextButton(onClick = { zoom = 1f; pan = Offset.Zero }) { Text("Reset view") }
            }
        }
        selected?.let { node -> item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(categoryLabel(node.group), style = MaterialTheme.typography.labelMedium)
                    Text(node.name, style = MaterialTheme.typography.titleMedium)
                    Text(node.tags.joinToString("  ") { "#$it" }, style = MaterialTheme.typography.bodySmall)
                }
            }
        } }
        if (placed.isNotEmpty()) item { Text("Explore the moments", style = MaterialTheme.typography.titleLarge) }
        items(placed, key = { it.node.id }) { position ->
            OutlinedCard(onClick = { selectedId = position.node.id }, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(categoryLabel(position.node.group), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                    Text(position.node.name, maxLines = if (selectedId == position.node.id) Int.MAX_VALUE else 2)
                }
            }
        }
        if (placed.isNotEmpty() && !state.preview) item { TextButton(onClick = refresh) { Text("Refresh connections") } }
    }
}
