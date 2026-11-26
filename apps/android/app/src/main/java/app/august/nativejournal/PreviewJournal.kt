package app.august.nativejournal

import app.august.nativejournal.data.*
import java.time.Instant
import java.time.temporal.ChronoUnit

/** Explicitly labelled sample data. Never sent to the user's backend. */
object PreviewJournal {
    private val now = Instant.now()
    val tasks = listOf(
        JournalTask("task-sample-1", "Build my portfolio website", "I want to create a website for the things I make.", now.plus(2, ChronoUnit.DAYS).toString(), updatedAt = now.toString(), createdAt = now.toString(), tags = listOf("website", "building")),
        JournalTask("task-sample-2", "Try the first product prototype", "I'm working on a small product and want to test the first version.", updatedAt = now.toString(), createdAt = now.toString(), tags = listOf("product")),
        JournalTask("task-sample-3", "Finish the settings screen", "Need to finish the app settings before tomorrow.", now.plus(1, ChronoUnit.DAYS).toString(), updatedAt = now.toString(), createdAt = now.toString()),
        JournalTask("task-sample-4", "Sketch the first screen", "I finished the first sketch.", completed = true, completedAt = now.toString(), updatedAt = now.toString(), createdAt = now.toString()),
    )
    val moments = listOf(
        Moment("sample-1", "Finally shipped the little project I kept putting off. It wasn't perfect, but seeing it out in the world felt better than another week of polishing.", "Milestone_HardWork", listOf("building", "creative work"), now.toString(), now.toString(), Memory("A small thing, finally out in the world")),
        Moment("sample-2", "A slow walk home, no headphones. The sky was turning pink and, for a few minutes, I didn't feel like I needed to be anywhere else.", "Quiet_Moment", listOf("walks", "rest"), now.minus(2, ChronoUnit.HOURS).toString(), now.toString(), Memory("The long way home")),
        Moment("sample-3", "I'd like to spend a weekend in the mountains. A notebook, a good book, and no particular plan.", "Wishlist", listOf("travel", "rest"), now.minus(1, ChronoUnit.DAYS).toString(), now.toString(), Memory("A weekend with a little more space")),
        Moment("sample-4", "Starting with ten minutes made the work feel possible. I don't always need a better plan. Sometimes I need a smaller beginning.", "Perspective_Lesson", listOf("building", "creative work"), now.minus(2, ChronoUnit.DAYS).toString(), now.toString(), Memory("A smaller beginning")),
    )
    val graph = GraphResponse(moments.mapIndexed { index, item -> GraphNode(item.id, item.memory!!.title, item.category, listOf("#5855D6", "#347C64", "#B57036", "#A34C71")[index], item.tags) }, listOf(
        GraphLink("sample-1", "sample-4", .85, "explicit_tag"), GraphLink("sample-2", "sample-3", .85, "explicit_tag"),
    ))
    val review = ReviewResponse("ready", review = Reflection(
        "A few moments from a sample journal, connected by what mattered.",
        focus = Insight("You gave an idea a place in the world.", "Your note about a smaller beginning connects to the project you later shipped.", "Keep the next beginning small enough to try.", listOf("sample-4", "sample-1")),
        experiences = listOf(Insight("There was room to slow down.", "You recorded a quiet walk, and a wish for an unhurried weekend.", "A little open space seems worth keeping, too.", listOf("sample-2", "sample-3"))),
        question = "What would you like to make a little more room for?",
    ), entries = moments, selectedCount = moments.size)
}
