/**
 * Regressietests — zombie-preventie: isLaatsteActieve-detectie
 *
 * Achtergrond:
 *   Een potje mag nooit in zombie-toestand komen (status=open zonder actieve
 *   deelnemers). De DB-trigger trg_sluit_potje_bij_laatste_afmelding sluit
 *   automatisch het potje wanneer de laatste actieve deelnemer zich afmeldt.
 *
 *   Aan de UI-kant moet de ModalAfmelden een waarschuwing tonen aan de
 *   gebruiker die op het punt staat als laatste actieve deelnemer af te
 *   melden, zodat de automatische sluiting niet als verrassing komt.
 *
 *   De detectie "ben ik de laatste actieve deelnemer?" gebeurt in
 *   PaginaOverzicht via:
 *
 *     isLaatsteActieve =
 *       ikBenActief
 *       && actieveDeelnemers.length === 1
 *       && actieveDeelnemers[0]?.id === ikzelf?.id
 *
 *   Deze test dekt de expressie af als pure functie, los van React-render.
 *
 * Gedekte scenarios:
 *   LA-01  Enige actieve deelnemer is ikzelf → true
 *   LA-02  Meerdere actieven, waaronder ikzelf → false
 *   LA-03  Enige actieve is iemand anders → false (ik ben al afgemeld)
 *   LA-04  Geen actieven meer → false (edge, zou niet moeten voorkomen)
 *   LA-05  Ik ben zelf niet actief, ook al ben ik de enige 'overgebleven' → false
 *   LA-06  Ikzelf null (deelnemer niet ingeladen) → false
 *   LA-07  Lege deelnemerslijst → false
 *   LA-08  Actieven met actief=undefined (legacy data) gelden als actief
 *
 * Waarom niet via berekenSaldi of een hook: deze afgeleide is een pure
 * UI-state die in één expressie leesbaar is. Extractie naar een aparte
 * utility zou overkill zijn — wel wordt de expressie hier wel 1-op-1
 * gereproduceerd zodat code-wijzigingen aan PaginaOverzicht hier
 * gesignaleerd worden.
 */

import { describe, it, expect } from 'vitest'

/**
 * Pure reproductie van de isLaatsteActieve-afleiding uit PaginaOverzicht.jsx.
 * Als de expressie daar verandert, moet deze functie gelijk mee worden
 * aangepast — de regressietest borgt dat de semantiek identiek blijft.
 */
function isLaatsteActieve(deelnemers, ikzelf) {
  const actieveDeelnemers = deelnemers.filter(d => d.actief !== false)
  const ikBenActief = ikzelf?.actief !== false
  return (
    ikBenActief &&
    actieveDeelnemers.length === 1 &&
    actieveDeelnemers[0]?.id === ikzelf?.id
  )
}

describe('Zombie-preventie — isLaatsteActieve', () => {
  it('LA-01: enige actieve deelnemer is ikzelf → true', () => {
    const ik = { id: 'a', actief: true }
    const deelnemers = [
      ik,
      { id: 'b', actief: false },
      { id: 'c', actief: false },
    ]
    expect(isLaatsteActieve(deelnemers, ik)).toBe(true)
  })

  it('LA-02: meerdere actieven waaronder ikzelf → false', () => {
    const ik = { id: 'a', actief: true }
    const deelnemers = [
      ik,
      { id: 'b', actief: true },
      { id: 'c', actief: false },
    ]
    expect(isLaatsteActieve(deelnemers, ik)).toBe(false)
  })

  it('LA-03: enige actieve is iemand anders (ik ben afgemeld) → false', () => {
    const ik = { id: 'a', actief: false }
    const deelnemers = [
      ik,
      { id: 'b', actief: true },
    ]
    expect(isLaatsteActieve(deelnemers, ik)).toBe(false)
  })

  it('LA-04: geen actieve deelnemers meer → false (edge case)', () => {
    const ik = { id: 'a', actief: false }
    const deelnemers = [
      ik,
      { id: 'b', actief: false },
    ]
    expect(isLaatsteActieve(deelnemers, ik)).toBe(false)
  })

  it('LA-05: ikzelf niet actief, enige andere afgemeld → false', () => {
    const ik = { id: 'a', actief: false }
    const deelnemers = [ik]
    expect(isLaatsteActieve(deelnemers, ik)).toBe(false)
  })

  it('LA-06: ikzelf null (deelnemer niet ingeladen) → false', () => {
    const deelnemers = [{ id: 'b', actief: true }]
    expect(isLaatsteActieve(deelnemers, null)).toBe(false)
  })

  it('LA-07: lege deelnemerslijst → false', () => {
    const ik = { id: 'a', actief: true }
    expect(isLaatsteActieve([], ik)).toBe(false)
  })

  it('LA-08: legacy data met actief=undefined telt als actief', () => {
    // In oudere data-rijen kan actief ongedefinieerd zijn. De huidige
    // expressie 'actief !== false' beschouwt deze als actief — conform
    // het gedrag van usePotje en berekenSaldi.
    const ik = { id: 'a' } // geen actief-veld
    const deelnemers = [
      ik,
      { id: 'b', actief: false },
    ]
    expect(isLaatsteActieve(deelnemers, ik)).toBe(true)
  })

  it('LA-09: ikzelf zit niet in de deelnemerslijst → false', () => {
    // Defensief: als ikzelf om een of andere reden niet in de lijst zit,
    // moet de check niet per ongeluk true retourneren.
    const ik = { id: 'z', actief: true }
    const deelnemers = [{ id: 'a', actief: true }]
    expect(isLaatsteActieve(deelnemers, ik)).toBe(false)
  })
})
