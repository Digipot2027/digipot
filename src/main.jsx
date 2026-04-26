import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'
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

// PostHog — gebruiksevent analytics (meldingfrequentie)
// EU-hosting: eu.i.posthog.com — geen dataoverdracht buiten EU.
// IP-masking aan: geen herleidbare persoonsgegevens opgeslagen.
// Alleen actief in productie.
if (import.meta.env.PROD) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST,
    // IP-masking: PostHog ontvangt geen IP-adressen
    person_profiles: 'never',         // geen persoonsprofielen aanmaken
    autocapture: false,               // geen automatische click/pageview events
    capture_pageview: false,          // pageviews loggen we niet
    capture_pageleave: false,         // pageleave events niet nodig
    disable_session_recording: true,  // geen sessie-opnames
    mask_all_text: true,              // alle tekst gemaskeerd als session recording ooit aan gaat
    loaded: (ph) => {
      // IP-masking via $ip property op identify — PostHog slaat geen IP op
      ph.register({ $ip: null })
    },
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
