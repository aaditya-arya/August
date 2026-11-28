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
    primary = Color(0xFFAA4967), onPrimary = Color(0xFFFFFEFD),
    primaryContainer = Color(0xFFF4E4E9), onPrimaryContainer = Color(0xFF5E2135),
    secondary = Color(0xFF356788), onSecondary = Color(0xFFFFFEFD),
    secondaryContainer = Color(0xFFE3F0FA), onSecondaryContainer = Color(0xFF193C54),
    tertiary = Color(0xFF6B53A1), onTertiary = Color(0xFFFFFEFD),
    tertiaryContainer = Color(0xFFEEEAFA), onTertiaryContainer = Color(0xFF332459),
    error = Color(0xFFB83B4B), onError = Color.White,
    errorContainer = Color(0xFFFCE6E9), onErrorContainer = Color(0xFF6E1D27),
    background = Color(0xFFFAF8F5), onBackground = Color(0xFF302C2A),
    surface = Color(0xFFFAF8F5), onSurface = Color(0xFF302C2A),
    surfaceContainerLow = Color(0xFFFFFEFD),
    surfaceContainer = Color(0xFFF3EFEB),
    surfaceContainerHigh = Color(0xFFEBE4DC),
    onSurfaceVariant = Color(0xFF77716D),
    outline = Color(0xFFD9CEC4), outlineVariant = Color(0xFFE7DFD8),
)
private val DarkColors = darkColorScheme(
    primary = Color(0xFFE5A0B5), onPrimary = Color(0xFF2E111B),
    primaryContainer = Color(0xFF38222B), onPrimaryContainer = Color(0xFFF7D7E1),
    secondary = Color(0xFF9ACCF0), onSecondary = Color(0xFF102838),
    secondaryContainer = Color(0xFF1D2D3B), onSecondaryContainer = Color(0xFFD5E9FA),
    tertiary = Color(0xFFC5B6F2), onTertiary = Color(0xFF231842),
    tertiaryContainer = Color(0xFF28223A), onTertiaryContainer = Color(0xFFE5DEFA),
    error = Color(0xFFF28B99), onError = Color(0xFF420D15),
    errorContainer = Color(0xFF4D1D24), onErrorContainer = Color(0xFFFFD9DE),
    background = Color(0xFF121314), onBackground = Color(0xFFEEE8E0),
    surface = Color(0xFF121314), onSurface = Color(0xFFEEE8E0),
    surfaceContainerLow = Color(0xFF1D1E20),
    surfaceContainer = Color(0xFF171819),
    surfaceContainerHigh = Color(0xFF262629),
    onSurfaceVariant = Color(0xFFAAA39C),
    outline = Color(0xFF4A4649), outlineVariant = Color(0xFF343234),
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
