import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import App from './App.jsx'
import './index.css'
import { TEKSTGROOTTE_KEY } from './constants'
import { getItem } from './utils/storage'

// Tekstgrootte herstellen uit localStorage bij opstarten (WCAG 1.4.4)
// Bug-fix: was een literal string 'digipot_tekstgrootte' — nu via TEKSTGROOTTE_KEY + storage-abstractie.
const tekstgrootte = getItem(TEKSTGROOTTE_KEY) || 'normaal'
document.documentElement.setAttribute('data-tekstgrootte', tekstgrootte)

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE, // 'development' of 'production'
  enabled: import.meta.env.PROD, // alleen in productie loggen
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  tracesSampleRate: 0.2, // 20% van sessies tracen (gratis tier)
  sendDefaultPii: false, // geen persoonlijke data sturen
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
