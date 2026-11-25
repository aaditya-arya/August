package app.august.nativejournal.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import android.app.Activity

private val LightColors = lightColorScheme(
    primary = Color(0xFF5855D6), onPrimary = Color.White,
    primaryContainer = Color(0xFFE6E4FF), onPrimaryContainer = Color(0xFF211B61),
    secondary = Color(0xFF52665E), secondaryContainer = Color(0xFFD7EDE1),
    tertiary = Color(0xFF996537), tertiaryContainer = Color(0xFFFFDDBB),
    background = Color(0xFFFAF9FD), surface = Color(0xFFFAF9FD),
    surfaceContainer = Color(0xFFF0EFF7), surfaceContainerLow = Color(0xFFF5F3FA),
    surfaceContainerHigh = Color(0xFFEAE7F1), onSurface = Color(0xFF1C1B21),
    onSurfaceVariant = Color(0xFF625F6D), outlineVariant = Color(0xFFDDD9E5),
)
private val DarkColors = darkColorScheme(
    primary = Color(0xFFC5C0FF), onPrimary = Color(0xFF2D286E),
    primaryContainer = Color(0xFF403C8E), onPrimaryContainer = Color(0xFFE6E4FF),
    secondary = Color(0xFFB2CEBF), secondaryContainer = Color(0xFF354C41),
    tertiary = Color(0xFFE8BE92), tertiaryContainer = Color(0xFF573D20),
    background = Color(0xFF131218), surface = Color(0xFF131218),
    surfaceContainer = Color(0xFF211F27), surfaceContainerLow = Color(0xFF1B1921),
    surfaceContainerHigh = Color(0xFF2B2832), onSurface = Color(0xFFE9E5EF),
    onSurfaceVariant = Color(0xFFC7C1D0), outlineVariant = Color(0xFF48434F),
)

@Composable
fun AugustTheme(appearance: String, content: @Composable () -> Unit) {
    val dark = when (appearance) { "dark" -> true; "light" -> false; else -> isSystemInDarkTheme() }
    val view = LocalView.current
    if (!view.isInEditMode) SideEffect {
        (view.context as? Activity)?.window?.let { window ->
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = !dark
                isAppearanceLightNavigationBars = !dark
            }
        }
    }
    MaterialTheme(colorScheme = if (dark) DarkColors else LightColors, typography = Typography(
        headlineLarge = TextStyle(fontSize = 32.sp, lineHeight = 38.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-.6).sp),
        headlineSmall = TextStyle(fontSize = 25.sp, lineHeight = 32.sp, fontWeight = FontWeight.Medium, letterSpacing = (-.3).sp),
        titleLarge = TextStyle(fontSize = 22.sp, lineHeight = 28.sp, fontWeight = FontWeight.SemiBold),
        titleMedium = TextStyle(fontSize = 16.sp, lineHeight = 23.sp, fontWeight = FontWeight.SemiBold),
        bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 26.sp),
        bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 22.sp),
        bodySmall = TextStyle(fontSize = 12.sp, lineHeight = 18.sp),
    ), content = content)
}
