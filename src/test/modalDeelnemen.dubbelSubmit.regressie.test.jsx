/**
 * modalDeelnemen.dubbelSubmit.regressie.test.jsx
 *
 * Regressietest voor A17: bezigRef-guard in ModalDeelnemen.
 *
 * Scenario: gebruiker klikt snel tweemaal op "Meedoen →" vóórdat de eerste
 * async round-trip is voltooid. Zonder guard worden twee INSERT-aanroepen
 * naar Supabase gedaan (duplicate key violation). Met de bezigRef-guard
 * wordt de tweede aanroep direct geblokkeerd.
 *
 * Bestandsextensie .jsx (niet .js) — Vitest/Rollup transformeert JSX-syntax
 * alleen in bestanden met .jsx of .tsx extensie via de Vite react-plugin.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ModalDeelnemen from '../components/ModalDeelnemen'

// Minimale mock voor useFocusTrap — geen DOM-afhankelijkheden nodig
vi.mock('../hooks/useFocusTrap', () => ({ useFocusTrap: () => {} }))
// logMelding importeert posthog-js dat niet beschikbaar is in jsdom
vi.mock('../utils/logMelding', () => ({ logMelding: vi.fn() }))

describe('ModalDeelnemen — A17 dubbele-submit-guard', () => {
  let onDeelnemen
  let resolveDeelnemen

  beforeEach(() => {
    // onDeelnemen geeft een Promise terug die we handmatig resolven
    onDeelnemen = vi.fn(() => new Promise(resolve => { resolveDeelnemen = resolve }))
  })

  function renderModal(props = {}) {
    return render(
      <ModalDeelnemen
        potjeNaam="Testpotje"
        deelnemers={[]}
        onDeelnemen={onDeelnemen}
        onAnnuleer={vi.fn()}
        {...props}
      />
    )
  }

  it('roept onDeelnemen precies één keer aan bij snelle dubbele klik', async () => {
    renderModal()
    const input = screen.getByLabelText('Jouw naam')
    const knop = screen.getByRole('button', { name: /meedoen/i })

    await userEvent.type(input, 'Jan')

    // Eerste klik — start de async operatie
    fireEvent.click(knop)
    // Tweede klik direct daarna — moet geblokkeerd worden door bezigRef
    fireEvent.click(knop)

    // Resolve de promise pas ná beide kliks
    resolveDeelnemen()

    await waitFor(() => {
      expect(onDeelnemen).toHaveBeenCalledTimes(1)
    })
  })

  it('knop is disabled tijdens laden', async () => {
    renderModal()
    const input = screen.getByLabelText('Jouw naam')
    const knop = screen.getByRole('button', { name: /meedoen/i })

    await userEvent.type(input, 'Piet')
    fireEvent.click(knop)

    // Tijdens het laden moet de knop disabled zijn
    expect(knop).toBeDisabled()

    resolveDeelnemen()
    await waitFor(() => expect(knop).not.toBeDisabled())
  })

  it('staat nieuwe submit toe nadat de vorige is afgerond', async () => {
    renderModal()
    const input = screen.getByLabelText('Jouw naam')
    const knop = screen.getByRole('button', { name: /meedoen/i })

    await userEvent.type(input, 'Lisa')
    fireEvent.click(knop)
    resolveDeelnemen()

    await waitFor(() => expect(onDeelnemen).toHaveBeenCalledTimes(1))

    // Tweede klik ná afronding — moet wél doorgelaten worden
    onDeelnemen.mockImplementation(() => new Promise(resolve => { resolveDeelnemen = resolve }))
    fireEvent.click(knop)
    resolveDeelnemen()

    await waitFor(() => expect(onDeelnemen).toHaveBeenCalledTimes(2))
  })

  it('reset bezigRef na een fout zodat opnieuw proberen mogelijk is', async () => {
    const foutmelding = new Error('Netwerk fout')
    onDeelnemen = vi.fn()
      .mockRejectedValueOnce(foutmelding)
      .mockResolvedValueOnce(undefined)

    renderModal()
    const input = screen.getByLabelText('Jouw naam')
    const knop = screen.getByRole('button', { name: /meedoen/i })

    await userEvent.type(input, 'Anna')

    // Eerste klik — geeft fout
    fireEvent.click(knop)
    await waitFor(() => expect(onDeelnemen).toHaveBeenCalledTimes(1))

    // Tweede klik na de fout — moet wél doorgelaten worden
    fireEvent.click(knop)
    await waitFor(() => expect(onDeelnemen).toHaveBeenCalledTimes(2))
  })
})
