import { useEffect } from 'react'

/**
 * Vangt toetsenbordfocus op binnen een modal of sheet.
 *
 * Gedrag:
 * - Escape → roept onSluiten() aan
 * - Tab → cirkelt door focusbare elementen binnen het panel
 * - Shift+Tab → cirkelt terug
 *
 * Vervangt de identieke, gekopieerde useEffect-blokken in:
 *   ModalAfmelden, ModalDeelnemen, ModalTransactie, ModalSluiten, DeelnemerDetailSheet
 *
 * WCAG 2.1.1 — alle functionaliteit bereikbaar via toetsenbord.
 * WCAG 2.4.3 — focusvolgorde behouden binnen modaldialoog.
 *
 * @param {React.RefObject} panelRef - Ref naar het modale paneel-element
 * @param {Function} onSluiten - Callback die de modal sluit (Escape-toets)
 * @param {Object} [opties]
 * @param {string} [opties.selector='input:not([disabled]), button:not([disabled])']
 *   CSS-selector voor focusbare elementen binnen het panel.
 *   Overschrijf alleen als het panel bijzondere elementen bevat (bijv. <a>, <select>).
 */
export function useFocusTrap(
  panelRef,
  onSluiten,
  { selector = 'input:not([disabled]), button:not([disabled])' } = {}
) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        onSluiten()
        return
      }

      if (e.key !== 'Tab') return

      const els = [...(panelRef.current?.querySelectorAll(selector) ?? [])]
      if (els.length < 2) return

      const first = els[0]
      const last = els[els.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [panelRef, onSluiten, selector])
}
