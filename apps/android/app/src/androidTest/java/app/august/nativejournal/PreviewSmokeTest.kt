package app.august.nativejournal

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PreviewSmokeTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Test fun previewNavigatesAndLetsSomeoneTryWritingWithoutSendingData() {
        compose.waitUntil(5_000) { compose.onAllNodesWithText("Explore a sample journal").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Explore a sample journal").performScrollTo().performClick()
        compose.onNodeWithText("Sample journal").assertIsDisplayed()
        compose.onNodeWithText("What's on your mind?").assertIsDisplayed()
        compose.onNodeWithText("Review", useUnmergedTree = true).performClick()
        compose.onNodeWithText("See the bigger picture.").assertIsDisplayed()
        compose.onNodeWithText("Journal", useUnmergedTree = true).performClick()
        // The FAB enters after the pager and bottom-bar transition settle.
        compose.waitUntil(5_000) { compose.onAllNodesWithContentDescription("Write a moment").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithContentDescription("Write a moment").performClick()
        compose.onNodeWithText("Today, I keep coming back to…").performTextInput("My own words in the native editor")
        compose.onNodeWithText("Save moment").performScrollTo().performClick()
        compose.onNodeWithText("This is a sample journal. Connect your server to save your own moments.").assertIsDisplayed()
    }
}
