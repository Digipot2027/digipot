import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Globale mock voor posthog-js — posthog is niet beschikbaar in jsdom.
// Alle component-tests die logMelding (indirect) importeren hoeven dit
// niet zelf te mocken.
vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
    init: vi.fn(),
  },
}))

// Globale mock voor logMelding — no-op in de testomgeving.
vi.mock('../utils/logMelding', () => ({
  logMelding: vi.fn(),
}))
