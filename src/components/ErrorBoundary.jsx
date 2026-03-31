import { Component } from 'react'
import * as Sentry from '@sentry/react'

/**
 * ErrorBoundary — vangt onverwachte React-crashes op applicatieniveau op.
 *
 * Waarom een class component:
 *   React vereist componentDidCatch en getDerivedStateFromError — deze lifecycle-
 *   methoden zijn alleen beschikbaar in class components. Hooks bieden geen
 *   equivalent.
 *
 * Gedrag:
 *   - Witte scherm bij crash → vervangen door een leesbare foutpagina
 *   - Fout wordt gelogd naar Sentry (incl. componentStack voor debugging)
 *   - "Ververs de pagina"-knop geeft de gebruiker een directe uitweg
 *   - "Terug naar home"-knop navigeert naar / zonder page reload
 *
 * Gebruik in App.jsx:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 * WCAG 2.4.2: document.title wordt aangepast zodat screenreaders de foutstatus
 *   onmiddellijk aankondigen.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { heeftFout: false, foutBericht: '' }
  }

  static getDerivedStateFromError(error) {
    return {
      heeftFout: true,
      foutBericht: error?.message || 'Onbekende fout',
    }
  }

  componentDidCatch(error, info) {
    // Log naar Sentry met componentStack voor snelle root-cause analyse
    Sentry.captureException(error, {
      contexts: {
        react: { componentStack: info.componentStack },
      },
    })
  }

  handleVerversen() {
    window.location.reload()
  }

  handleTerug() {
    window.location.href = '/'
  }

  render() {
    if (!this.state.heeftFout) {
      return this.props.children
    }

    // WCAG 2.4.2: paginatitel aanpassen zodat screenreaders de foutstatus melden
    document.title = 'Er ging iets mis — Digipot'

    return (
      <div className="pagina">
        <div className="kaart" style={{ textAlign: 'center', padding: '40px 24px' }}>

          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>

          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 12 }}>
            Er ging iets mis
          </h1>

          <p style={{ fontSize: '0.875rem', color: 'var(--grijs-600)', marginBottom: 24 }}>
            De pagina is vastgelopen. Ververs de pagina om verder te gaan.
            Als het probleem aanhoudt, probeer het later opnieuw.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              className="knop knop-primair"
              onClick={this.handleVerversen}
            >
              🔄 Ververs de pagina
            </button>
            <button
              className="knop knop-secundair"
              onClick={this.handleTerug}
            >
              ← Terug naar home
            </button>
          </div>

        </div>
      </div>
    )
  }
}

export default ErrorBoundary
