package app.august.nativejournal.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.VectorConverter
import androidx.compose.animation.core.spring
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.core.graphics.toColorInt
import app.august.nativejournal.JournalUiState
import app.august.nativejournal.data.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun ConnectionsScreen(state: JournalUiState, refresh: () -> Unit, selectedMoment: (Moment) -> Unit) {
    var category by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    val zoomAnim = remember { Animatable(1f) }
    val panAnim = remember { Animatable(Offset.Zero, Offset.VectorConverter) }
    val scope = rememberCoroutineScope()
    val graph = state.graph ?: GraphResponse()
    val momentsById = remember(state.moments) { state.moments.associateBy { it.id } }
    val categories = remember(graph) { graph.nodes.map { it.group }.distinct().sorted() }
    val eligible = remember(graph, category) { graph.nodes.filter { category == null || category == it.group } }
    var placed by remember { mutableStateOf<List<PlacedNode>>(emptyList()) }
    LaunchedEffect(eligible, graph.links) {
        placed = withContext(Dispatchers.Default) { layoutGraph(eligible, graph.links) }
        zoomAnim.snapTo(1f); panAnim.snapTo(Offset.Zero)
    }
    val selected = placed.find { it.node.id == selectedId }?.node
    val edgeColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = .22f)
    val selectedColor = MaterialTheme.colorScheme.onSurface
    val textMeasurer = rememberTextMeasurer()
    val labelStyle = MaterialTheme.typography.labelSmall.copy(color = MaterialTheme.colorScheme.onSurface)
    val visibleIds = remember(placed) { placed.map { it.node.id }.toSet() }
    val visibleLinks = remember(graph.links, visibleIds) { graph.links.filter { it.source in visibleIds && it.target in visibleIds } }
    LaunchedEffect(categories) { if (category != null && category !in categories) category = null }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { PageHeading("Follow a thought", "Everything connects.", "Explore the shared subjects and meanings in your journal.") }
        if (state.loadingGraph) item { LoadingCard("Loading your connections", "Finding the links between your saved moments.") }
        state.graphError?.let { message -> item { RequestError("Couldn't load connections", message, refresh) } }
        if (!state.loadingGraph && graph.nodes.isEmpty() && state.graphError == null) item {
            EmptyState("Connections grow as you write.", "Keep a few moments to discover the threads between them.", "Refresh connections", refresh)
        }
        if (graph.nodes.isNotEmpty()) item {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("${graph.nodes.size} moments · ${graph.links.size} connections", style = MaterialTheme.typography.titleMedium)
                Text(if (graph.links.isEmpty()) "Your moments are here. Links appear when saved moments share tags or meaning."
                    else "Tap a dot to explore a moment. Pinch to zoom or drag to move.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (categories.isNotEmpty()) item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item { FilterChip(selected = category == null, onClick = { category = null; selectedId = null }, label = { Text("All threads") }) }
                items(categories) { value -> FilterChip(selected = category == value, onClick = { category = value; selectedId = null }, label = { Text(categoryLabel(value)) }) }
            }
        }
        if (placed.isNotEmpty()) item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                Canvas(Modifier.fillMaxWidth().height(360.dp).background(MaterialTheme.colorScheme.surfaceContainerLow)
                    .semantics { contentDescription = "Graph of ${placed.size} journal moments. Pinch to zoom, drag to explore, or use the accessible moment list below." }
                    .pointerInput(placed) {
                        detectTransformGestures { _, movement, scale, _ ->
                            scope.launch {
                                zoomAnim.snapTo((zoomAnim.value * scale).coerceIn(.75f, 4f))
                                panAnim.snapTo(panAnim.value + movement)
                            }
                        }
                    }
                    .pointerInput(placed) { detectTapGestures { tap ->
                        val zoom = zoomAnim.value
                        val pan = panAnim.value
                        val center = Offset(size.width / 2f, size.height / 2f)
                        selectedId = placed.minByOrNull { position ->
                            val point = (Offset(position.x * size.width, position.y * size.height) - center) * zoom + center + pan
                            (point - tap).getDistance()
                        }?.takeIf { position ->
                            val point = (Offset(position.x * size.width, position.y * size.height) - center) * zoom + center + pan
                            (point - tap).getDistance() <= 32.dp.toPx()
                        }?.node?.id
                    } }) {
                    val zoom = zoomAnim.value
                    val pan = panAnim.value
                    fun point(node: PlacedNode) = (Offset(node.x * size.width, node.y * size.height) - center) * zoom + center + pan
                    val byId = placed.associateBy { it.node.id }
                    clipRect {
                        visibleLinks.forEach { edge ->
                            val a = byId[edge.source]; val b = byId[edge.target]
                            if (a != null && b != null) drawLine(if (edge.source == selectedId || edge.target == selectedId) selectedColor.copy(alpha = .6f) else edgeColor,
                                point(a), point(b), strokeWidth = (1 + edge.weight).toFloat() * density)
                        }
                        placed.forEach { node ->
                            val color = runCatching { Color(node.node.color.toColorInt()) }.getOrDefault(Color(0xFF5855D6))
                            if (node.node.id == selectedId) drawCircle(selectedColor, 14.dp.toPx(), point(node))
                            drawCircle(color, if (node.node.id == selectedId) 10.dp.toPx() else 8.dp.toPx(), point(node))
                        }
                        placed.filter { placed.size <= 16 || it.node.id == selectedId }.forEach { node ->
                            val label = momentsById[node.node.id]?.memory?.title?.takeIf { it.isNotBlank() } ?: node.node.name
                            val measured = textMeasurer.measure(label, style = labelStyle, maxLines = 1, overflow = TextOverflow.Ellipsis,
                                constraints = Constraints(maxWidth = 110.dp.roundToPx()))
                            drawText(measured, topLeft = point(node) + Offset(-measured.size.width / 2f, 16.dp.toPx()))
                        }
                    }
                }
            }
        }
        if (placed.isNotEmpty()) item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("${placed.size} of ${eligible.size} shown", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = { scope.launch { zoomAnim.animateTo((zoomAnim.value / 1.35f).coerceIn(.75f, 4f), spring(stiffness = Spring.StiffnessMediumLow)) } }) { Text("−") }
                    TextButton(onClick = { scope.launch { zoomAnim.animateTo((zoomAnim.value * 1.35f).coerceIn(.75f, 4f), spring(stiffness = Spring.StiffnessMediumLow)) } }) { Text("+") }
                    TextButton(onClick = {
                        scope.launch { zoomAnim.animateTo(1f, spring(stiffness = Spring.StiffnessMediumLow)) }
                        scope.launch { panAnim.animateTo(Offset.Zero, spring(stiffness = Spring.StiffnessMediumLow)) }
                    }) { Text("Reset view") }
                }
            }
        }
        selected?.let { node -> item {
            Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(categoryLabel(node.group), style = MaterialTheme.typography.labelMedium)
                    Text(node.name, style = MaterialTheme.typography.titleMedium)
                    if (node.tags.isNotEmpty()) Text(node.tags.joinToString("  ") { "#$it" }, style = MaterialTheme.typography.bodySmall)
                    momentsById[node.id]?.let { moment ->
                        FilledTonalButton(onClick = { selectedMoment(moment) }, shape = RoundedCornerShape(14.dp)) { Text("Open full moment") }
                    }
                }
            }
        } }
        if (placed.isNotEmpty()) item { Text("Explore the moments", style = MaterialTheme.typography.titleLarge) }
        items(placed, key = { it.node.id }) { position ->
            OutlinedCard(
                onClick = { selectedId = position.node.id },
                shape = RoundedCornerShape(20.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                modifier = Modifier.animateItem().fillMaxWidth(),
            ) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(categoryLabel(position.node.group), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                    Text(momentsById[position.node.id]?.memory?.title?.takeIf { it.isNotBlank() } ?: position.node.name,
                        maxLines = if (selectedId == position.node.id) Int.MAX_VALUE else 2, overflow = TextOverflow.Ellipsis)
                    AnimatedVisibility(
                        visible = selectedId == position.node.id && momentsById[position.node.id] != null,
                        enter = expandVertically(spring(stiffness = Spring.StiffnessMediumLow)) + fadeIn(),
                        exit = shrinkVertically(spring(stiffness = Spring.StiffnessMediumLow)) + fadeOut(),
                    ) {
                        momentsById[position.node.id]?.let { moment ->
                            TextButton(onClick = { selectedMoment(moment) }) { Text("Open full moment") }
                        }
                    }
                }
            }
        }
        if (placed.isNotEmpty() && !state.preview) item { TextButton(onClick = refresh) { Text("Refresh connections") } }
    }
}
