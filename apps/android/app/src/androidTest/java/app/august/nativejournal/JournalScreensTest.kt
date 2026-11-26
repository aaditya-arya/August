package app.august.nativejournal

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.august.nativejournal.ui.*
import app.august.nativejournal.data.ReviewResponse
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class JournalScreensTest {
    @get:Rule val compose = createComposeRule()

    @Test fun failedReviewShowsItsErrorAndRetriesTheSelectedPeriod() {
        var retried = false
        compose.setContent { MaterialTheme {
            ReviewScreen(JournalUiState(booting = false, reviewPeriod = "30", reviewError = "The AI key is missing."),
                load = { period, refresh -> retried = period == "30" && refresh }, selected = {})
        } }
        compose.onNodeWithText("The AI key is missing.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Try again").performScrollTo().performClick()
        compose.runOnIdle { assertTrue(retried) }
        compose.onNodeWithText("Your reflection isn't ready yet.").assertDoesNotExist()
    }

    @Test fun reviewEvidenceOpensTheOriginalMoment() {
        var selectedId: String? = null
        compose.setContent { MaterialTheme {
            ReviewScreen(JournalUiState(booting = false, review = PreviewJournal.review), load = { _, _ -> }, selected = { selectedId = it.id })
        } }
        compose.onAllNodesWithText("Why this reflection?").onFirst().performScrollTo().performClick()
        compose.onAllNodesWithText("Open source moment").onFirst().performScrollTo().performClick()
        compose.runOnIdle { assertNotNull(selectedId) }
    }

    @Test fun graphFailureIsNotPresentedAsAnEmptyJournal() {
        var retried = false
        compose.setContent { MaterialTheme {
            ConnectionsScreen(JournalUiState(booting = false, graphError = "Storage setup is incomplete."), refresh = { retried = true }, selectedMoment = {})
        } }
        compose.onNodeWithText("Storage setup is incomplete.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Try again").performScrollTo().performClick()
        compose.runOnIdle { assertTrue(retried) }
        compose.onNodeWithText("Connections grow as you write.").assertDoesNotExist()
    }

    private val verticalList = SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange)

    @Test fun unavailableAiStillLetsTheUserReadTheirSavedMoments() {
        var selectedId: String? = null
        val firstTitle = PreviewJournal.moments.first().memory!!.title
        compose.setContent { MaterialTheme {
            ReviewScreen(JournalUiState(booting = false, review = ReviewResponse("unavailable", message = "The AI reflection is unavailable.",
                entries = PreviewJournal.moments, selectedCount = PreviewJournal.moments.size)), load = { _, _ -> }, selected = { selectedId = it.id })
        } }
        compose.onNode(verticalList).performScrollToNode(hasText("Your saved moments"))
        compose.onNodeWithText("Your saved moments").assertIsDisplayed()
        compose.onNode(verticalList).performScrollToNode(hasText(firstTitle))
        compose.onNodeWithText(firstTitle).performClick()
        compose.runOnIdle { assertEquals(PreviewJournal.moments.first().id, selectedId) }
    }

    @Test fun populatedConnectionsLetsUserSelectAndOpenFullMoment() {
        var selectedId: String? = null
        val firstTitle = PreviewJournal.moments.first().memory!!.title
        compose.setContent { MaterialTheme {
            ConnectionsScreen(JournalUiState(booting = false, moments = PreviewJournal.moments, graph = PreviewJournal.graph),
                refresh = {}, selectedMoment = { selectedId = it.id })
        } }
        compose.onNodeWithText("${PreviewJournal.graph.nodes.size} moments · ${PreviewJournal.graph.links.size} connections").assertIsDisplayed()
        compose.onNode(verticalList).performScrollToNode(hasText(firstTitle))
        compose.onNodeWithText(firstTitle).performClick()
        compose.onNode(verticalList).performScrollToNode(hasText("Open full moment"))
        compose.onAllNodesWithText("Open full moment").onFirst().performClick()
        compose.runOnIdle { assertEquals(PreviewJournal.moments.first().id, selectedId) }
    }
}
