import {
  DarkTheme,
  DefaultTheme,
  type Theme,
} from 'expo-router/react-navigation';

/**
 * The Ford tokens of `src/global.css` as values for code that cannot use
 * class names: the navigation theme, icon tints, status bars and animations.
 * React Native does not parse oklch, so these are the sRGB equivalents the
 * web theme (`libs/ui/styles.css`) records next to each token. If you change
 * a token in `global.css`, change it here too.
 */
export const THEME = {
  light: {
    background: '#ffffff',
    foreground: '#000000',
    card: '#ffffff',
    cardForeground: '#000000',
    popover: '#ffffff',
    popoverForeground: '#000000',
    primary: '#066fef',
    primaryHover: '#044ea7',
    primaryForeground: '#ffffff',
    secondary: '#f0f0f0',
    secondaryForeground: '#333333',
    muted: '#f0f0f0',
    mutedForeground: '#666666',
    accent: '#f0f0f0',
    accentForeground: '#000000',
    destructive: '#d93025',
    destructiveForeground: '#ffffff',
    border: '#e5e5e5',
    input: '#b2b2b2',
    ring: '#066fef',
    success: '#097a3a',
    warning: '#ba4e00',
    info: '#0068d0',
    radius: 12,
  },
  dark: {
    background: '#0f0f0f',
    foreground: '#f0f0f0',
    card: '#212121',
    cardForeground: '#f0f0f0',
    popover: '#212121',
    popoverForeground: '#f0f0f0',
    primary: '#066fef',
    primaryHover: '#044ea7',
    primaryForeground: '#ffffff',
    secondary: '#303030',
    secondaryForeground: '#e5e5e5',
    muted: '#303030',
    mutedForeground: '#b2b2b2',
    accent: '#303030',
    accentForeground: '#f0f0f0',
    destructive: '#f14e46',
    destructiveForeground: '#ffffff',
    border: 'rgba(255, 255, 255, 0.1)',
    input: 'rgba(255, 255, 255, 0.18)',
    ring: '#066fef',
    success: '#7cc948',
    warning: '#ffc622',
    info: '#0093f0',
    radius: 12,
  },
} as const;

/** Colours for `ThemeProvider` from `expo-router/react-navigation`. */
export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
};
