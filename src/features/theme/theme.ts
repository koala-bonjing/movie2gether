export interface AccentTheme {
  id: string;
  name: string;
  accent: string;
  accent2?: string;
}

export const ACCENT_THEMES: readonly AccentTheme[] = [
  { id: 'rose', name: 'Rose', accent: '#E8A0BF', accent2: '#F2C57C' },
  { id: 'amber', name: 'Amber', accent: '#F2C57C', accent2: '#E8A0BF' },
  { id: 'mint', name: 'Mint', accent: '#7BD3A8', accent2: '#F2C57C' },
  { id: 'violet', name: 'Violet', accent: '#B388FF', accent2: '#7BD3A8' },
] as const;

export const DEFAULT_THEME_ID = 'rose';
const THEME_STORAGE_KEY = 'duet:accent-theme';

export function getStoredThemeId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME_ID;
    }
    return DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function applyTheme(themeId: string): AccentTheme {
  const theme = ACCENT_THEMES.find((t) => t.id === themeId) || ACCENT_THEMES[0]!;
  if (typeof document !== 'undefined') {
    document.documentElement?.style?.setProperty('--accent', theme.accent);
    if (theme.accent2) {
      document.documentElement?.style?.setProperty('--accent-2', theme.accent2);
    }
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme.id);
    } catch {
      // storage unavailable
    }
  }
  return theme;
}
