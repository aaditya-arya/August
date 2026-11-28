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
    primary = Color(0xFF155649), onPrimary = Color.White,
    primaryContainer = Color(0xFFD5EEE3), onPrimaryContainer = Color(0xFF11382F),
    secondary = Color(0xFF405A67), secondaryContainer = Color(0xFFDDEBF3),
    tertiary = Color(0xFF754D35), tertiaryContainer = Color(0xFFF6E1CD),
    background = Color(0xFFF3F4EF), surface = Color(0xFFF9FAF6),
    surfaceContainer = Color(0xFFE9ECE5), surfaceContainerLow = Color(0xFFFDFEFA),
    surfaceContainerHigh = Color(0xFFE0E6DF), onSurface = Color(0xFF151D1A),
    onSurfaceVariant = Color(0xFF4C5C54), outlineVariant = Color(0xFFCED8CF),
)
private val DarkColors = darkColorScheme(
    primary = Color(0xFF9FD5C5), onPrimary = Color(0xFF11382F),
    primaryContainer = Color(0xFF214C41), onPrimaryContainer = Color(0xFFDBF4EC),
    secondary = Color(0xFFB5D6E6), secondaryContainer = Color(0xFF243D48),
    tertiary = Color(0xFFF1CAA5), tertiaryContainer = Color(0xFF533A2A),
    background = Color(0xFF121B18), surface = Color(0xFF18211D),
    surfaceContainer = Color(0xFF222E28), surfaceContainerLow = Color(0xFF1B2721),
    surfaceContainerHigh = Color(0xFF303F37), onSurface = Color(0xFFEAF2EC),
    onSurfaceVariant = Color(0xFFBCCBC3), outlineVariant = Color(0xFF3F5349),
)

@Composable
fun AugustTheme(appearance: String, styleSystemBars: Boolean = true, content: @Composable () -> Unit) {
    val dark = when (appearance) { "dark" -> true; "light" -> false; else -> isSystemInDarkTheme() }
    val view = LocalView.current
    if (styleSystemBars && !view.isInEditMode) SideEffect {
        (view.context as? Activity)?.window?.let { window ->
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = !dark
                isAppearanceLightNavigationBars = !dark
            }
        }
    }
    MaterialTheme(colorScheme = if (dark) DarkColors else LightColors, typography = Typography(
        displayMedium = TextStyle(fontSize = 44.sp, lineHeight = 48.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-1.5).sp),
        displaySmall = TextStyle(fontSize = 34.sp, lineHeight = 39.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-.7).sp),
        headlineLarge = TextStyle(fontSize = 32.sp, lineHeight = 38.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-.6).sp),
        headlineMedium = TextStyle(fontSize = 30.sp, lineHeight = 36.sp, fontWeight = FontWeight.SemiBold),
        headlineSmall = TextStyle(fontSize = 25.sp, lineHeight = 32.sp, fontWeight = FontWeight.Medium, letterSpacing = (-.3).sp),
        titleLarge = TextStyle(fontSize = 22.sp, lineHeight = 28.sp, fontWeight = FontWeight.SemiBold),
        titleMedium = TextStyle(fontSize = 16.sp, lineHeight = 23.sp, fontWeight = FontWeight.SemiBold),
        bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 26.sp),
        bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 22.sp),
        bodySmall = TextStyle(fontSize = 12.sp, lineHeight = 18.sp),
    ), content = content)
}
