package app.august.nativejournal.data

import kotlin.math.*

data class PlacedNode(val node: GraphNode, val x: Float, val y: Float)

/** Bounded, deterministic force layout. Run on Dispatchers.Default, never in drawing. */
fun layoutGraph(nodes: List<GraphNode>, links: List<GraphLink>): List<PlacedNode> {
    val visible = nodes.take(120)
    if (visible.isEmpty()) return emptyList()
    if (visible.size == 1) return listOf(PlacedNode(visible.first(), .5f, .5f))
    val positions = visible.mapIndexed { index, _ ->
        val angle = index * PI * (3 - sqrt(5.0))
        val radius = .34 * sqrt((index + 1.0) / visible.size)
        doubleArrayOf(.5 + cos(angle) * radius, .5 + sin(angle) * radius)
    }
    val byId = visible.mapIndexed { index, node -> node.id to index }.toMap()
    val bonds = links.mapNotNull { link -> byId[link.source]?.let { a -> byId[link.target]?.let { b -> a to b } } }
    repeat(100) { iteration ->
        val forces = Array(visible.size) { doubleArrayOf(0.0, 0.0) }
        for (a in visible.indices) for (b in a + 1 until visible.size) {
            val dx = positions[a][0] - positions[b][0]
            val dy = positions[a][1] - positions[b][1]
            val distance = max(.004, dx * dx + dy * dy)
            val force = .00012 / distance
            forces[a][0] += dx * force; forces[a][1] += dy * force
            forces[b][0] -= dx * force; forces[b][1] -= dy * force
        }
        bonds.forEach { (a, b) ->
            val dx = positions[b][0] - positions[a][0]
            val dy = positions[b][1] - positions[a][1]
            forces[a][0] += dx * .08; forces[a][1] += dy * .08
            forces[b][0] -= dx * .08; forces[b][1] -= dy * .08
        }
        positions.forEachIndexed { index, position ->
            val cooling = 1.0 - iteration / 125.0
            position[0] = (position[0] + (forces[index][0] + (.5 - position[0]) * .015).coerceIn(-.02, .02) * cooling).coerceIn(.07, .93)
            position[1] = (position[1] + (forces[index][1] + (.5 - position[1]) * .015).coerceIn(-.02, .02) * cooling).coerceIn(.07, .93)
        }
    }
    return visible.mapIndexed { index, node -> PlacedNode(node, positions[index][0].toFloat(), positions[index][1].toFloat()) }
}
