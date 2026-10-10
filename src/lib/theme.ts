/**
 * Light/dark choice. 'system' follows the phone's setting. The choice is a
 * per-device convenience, so it lives in localStorage; if that's unavailable
 * (private mode) the app simply follows the system.
 *
 * index.html runs the same resolution inline before first paint, so there is
 * no flash of the wrong theme -- keep the two in step.
 */

export type ThemePreference = 'system' | 'light' | 'dark'

const KEY = 'theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

// Matches --bg in theme.css; drives the status bar / browser chrome colour.
const CHROME = { light: '#F5EEE1', dark: '#1F2430' }

export function getThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function setThemePreference(pref: ThemePreference) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    // Not persisted, but still applied for this session.
  }
  applyTheme(pref)
}

function applyTheme(pref: ThemePreference) {
  const dark = pref === 'dark' || (pref === 'system' && media.matches)
  const theme = dark ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CHROME[theme])
}

/** Keeps 'system' in step when the phone switches between light and dark. */
export function watchSystemTheme() {
  media.addEventListener('change', () => {
    if (getThemePreference() === 'system') applyTheme('system')
  })
}

export const isDarkTheme = () => document.documentElement.dataset.theme === 'dark'
