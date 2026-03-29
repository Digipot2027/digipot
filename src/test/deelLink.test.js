/**
 * deelLink — volledige tests van alle codepaden
 *
 * De functie heeft 4 uitvoerpaden die zonder mocking niet testbaar zijn:
 *   1. Mobiel + navigator.share succesvol → onSucces('native')
 *   2. Mobiel + navigator.share AbortError → stil negeren
 *   3. Mobiel + navigator.share andere error → clipboard fallback
 *   4. Desktop + clipboard.writeText succesvol → onSucces('kopie')
 *   5. Desktop + clipboard faalt → execCommand fallback → onSucces('kopie')
 *   6. Desktop + clipboard faalt + execCommand faalt → onFout()
 *
 * Mocking-strategie:
 *   - navigator.share: Object.defineProperty (niet configureerbaar in jsdom)
 *   - navigator.userAgent: vi.stubGlobal of Object.defineProperty
 *   - navigator.clipboard: direct toewijzen (jsdom staat dit toe)
 *   - document.execCommand: vi.spyOn
 *   - window.location.href: vi.stubGlobal
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { deelLink } from '../utils/deelLink'

// Vaste test-URL — window.location.href in jsdom
const TEST_URL = 'http://localhost:3000/potje/abc-123'
const POTJE_NAAM = 'Vakantie Spanje'

// Helper: zet userAgent naar mobiel of desktop
function zetUserAgent(waarde) {
  Object.defineProperty(navigator, 'userAgent', {
    value: waarde,
    configurable: true,
    writable: true,
  })
}

// Helper: verwijder navigator.share (desktop zonder share-API)
function verwijderShare() {
  Object.defineProperty(navigator, 'share', {
    value: undefined,
    configurable: true,
    writable: true,
  })
}

// Helper: zet navigator.share als mock-functie (mobiel met share-API)
function zetShare(mockFn) {
  Object.defineProperty(navigator, 'share', {
    value: mockFn,
    configurable: true,
    writable: true,
  })
}

beforeEach(() => {
  // Standaard: desktop userAgent, geen share-API
  zetUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
  verwijderShare()

  // window.location.href stabiel houden in jsdom
  Object.defineProperty(window, 'location', {
    value: { href: TEST_URL },
    configurable: true,
    writable: true,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Desktop: clipboard.writeText ─────────────────────────────────────────────

describe('deelLink — desktop: clipboard API beschikbaar', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('kopieert de huidige URL naar klembord', async () => {
    await deelLink(POTJE_NAAM, vi.fn(), vi.fn())
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(TEST_URL)
  })

  it('roept onSucces("kopie") aan na succesvol kopiëren', async () => {
    const onSucces = vi.fn()
    await deelLink(POTJE_NAAM, onSucces, vi.fn())
    expect(onSucces).toHaveBeenCalledWith('kopie')
  })

  it('roept onFout NIET aan bij succes', async () => {
    const onFout = vi.fn()
    await deelLink(POTJE_NAAM, vi.fn(), onFout)
    expect(onFout).not.toHaveBeenCalled()
  })
})

// ─── Desktop: clipboard faalt → execCommand fallback ─────────────────────────

describe('deelLink — desktop: clipboard faalt, execCommand slaagt', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard niet beschikbaar')),
      },
    })
    // jsdom definieert execCommand niet standaard in Vitest 3.x — eerst definiëren
    if (!document.execCommand) {
      document.execCommand = () => true
    }
    vi.spyOn(document, 'execCommand').mockReturnValue(true)
  })

  it('valt terug op execCommand("copy")', async () => {
    await deelLink(POTJE_NAAM, vi.fn(), vi.fn())
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })

  it('roept onSucces("kopie") aan via execCommand-pad', async () => {
    const onSucces = vi.fn()
    await deelLink(POTJE_NAAM, onSucces, vi.fn())
    expect(onSucces).toHaveBeenCalledWith('kopie')
  })

  it('roept onFout NIET aan als execCommand slaagt', async () => {
    const onFout = vi.fn()
    await deelLink(POTJE_NAAM, vi.fn(), onFout)
    expect(onFout).not.toHaveBeenCalled()
  })

  it('maakt een textarea aan en verwijdert die daarna weer', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const removeSpy = vi.spyOn(document.body, 'removeChild')
    await deelLink(POTJE_NAAM, vi.fn(), vi.fn())
    expect(appendSpy).toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalled()
  })
})

// ─── Desktop: clipboard faalt + execCommand faalt → onFout ───────────────────

describe('deelLink — desktop: clipboard én execCommand falen', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('niet beschikbaar')),
      },
    })
    if (!document.execCommand) {
      document.execCommand = () => { throw new Error('execCommand mislukt') }
    }
    vi.spyOn(document, 'execCommand').mockImplementation(() => {
      throw new Error('execCommand mislukt')
    })
  })

  it('roept onFout() aan als beide methoden falen', async () => {
    const onFout = vi.fn()
    await deelLink(POTJE_NAAM, vi.fn(), onFout)
    expect(onFout).toHaveBeenCalled()
  })

  it('roept onSucces NIET aan als beide methoden falen', async () => {
    const onSucces = vi.fn()
    await deelLink(POTJE_NAAM, onSucces, vi.fn())
    expect(onSucces).not.toHaveBeenCalled()
  })
})

// ─── Mobiel: native share slaagt ─────────────────────────────────────────────

describe('deelLink — mobiel: native share slaagt', () => {
  beforeEach(() => {
    zetUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    zetShare(vi.fn().mockResolvedValue(undefined))
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('roept navigator.share aan met de juiste payload', async () => {
    await deelLink(POTJE_NAAM, vi.fn(), vi.fn())
    expect(navigator.share).toHaveBeenCalledWith({
      title: `Digipot — ${POTJE_NAAM}`,
      text: `Doe mee aan het potje "${POTJE_NAAM}"`,
      url: TEST_URL,
    })
  })

  it('roept onSucces("native") aan na native share', async () => {
    const onSucces = vi.fn()
    await deelLink(POTJE_NAAM, onSucces, vi.fn())
    expect(onSucces).toHaveBeenCalledWith('native')
  })

  it('roept clipboard.writeText NIET aan bij native share', async () => {
    await deelLink(POTJE_NAAM, vi.fn(), vi.fn())
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('roept onFout NIET aan bij succes', async () => {
    const onFout = vi.fn()
    await deelLink(POTJE_NAAM, vi.fn(), onFout)
    expect(onFout).not.toHaveBeenCalled()
  })
})

// ─── Mobiel: gebruiker annuleert (AbortError) ─────────────────────────────────

describe('deelLink — mobiel: AbortError wordt stil genegeerd', () => {
  beforeEach(() => {
    zetUserAgent('Mozilla/5.0 (Android 13; Mobile; rv:109.0)')
    const abortError = new DOMException('Share geannuleerd', 'AbortError')
    zetShare(vi.fn().mockRejectedValue(abortError))
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('roept onFout NIET aan bij AbortError', async () => {
    const onFout = vi.fn()
    await deelLink(POTJE_NAAM, vi.fn(), onFout)
    expect(onFout).not.toHaveBeenCalled()
  })

  it('roept onSucces NIET aan bij AbortError', async () => {
    const onSucces = vi.fn()
    await deelLink(POTJE_NAAM, onSucces, vi.fn())
    expect(onSucces).not.toHaveBeenCalled()
  })

  it('valt NIET terug op clipboard bij AbortError', async () => {
    await deelLink(POTJE_NAAM, vi.fn(), vi.fn())
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })
})

// ─── Mobiel: native share mislukt met andere error → clipboard fallback ────────

describe('deelLink — mobiel: native share mislukt → clipboard fallback', () => {
  beforeEach(() => {
    zetUserAgent('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)')
    zetShare(vi.fn().mockRejectedValue(new Error('Share API niet ondersteund')))
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('valt terug op clipboard.writeText na mislukte native share', async () => {
    await deelLink(POTJE_NAAM, vi.fn(), vi.fn())
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(TEST_URL)
  })

  it('roept onSucces("kopie") aan via clipboard-fallback', async () => {
    const onSucces = vi.fn()
    await deelLink(POTJE_NAAM, onSucces, vi.fn())
    expect(onSucces).toHaveBeenCalledWith('kopie')
  })
})

// ─── Callbacks zijn optioneel (geen crash bij ontbrekende callbacks) ──────────

describe('deelLink — optionele callbacks', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('crasht niet als onSucces undefined is', async () => {
    await expect(deelLink(POTJE_NAAM, undefined, vi.fn())).resolves.not.toThrow()
  })

  it('crasht niet als onFout undefined is', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('nee')),
      },
    })
    if (!document.execCommand) {
      document.execCommand = () => { throw new Error('ook nee') }
    }
    vi.spyOn(document, 'execCommand').mockImplementation(() => {
      throw new Error('ook nee')
    })
    await expect(deelLink(POTJE_NAAM, vi.fn(), undefined)).resolves.not.toThrow()
  })
})
