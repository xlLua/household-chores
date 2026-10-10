import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted, Latin subset only (covers é, ë and the rest of Dutch), so the
// service worker precaches them and nothing is fetched from Google.
import '@fontsource/fleur-de-leah/latin-400.css'
import '@fontsource/eb-garamond/latin-500.css'
import '@fontsource/eb-garamond/latin-700.css'
import '@fontsource/nunito-sans/latin-400.css'
import '@fontsource/nunito-sans/latin-600.css'
import '@fontsource/nunito-sans/latin-700.css'
import './styles/theme.css'
import './styles/app.css'
import App from './App'
import { watchSystemTheme } from './lib/theme'

watchSystemTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
