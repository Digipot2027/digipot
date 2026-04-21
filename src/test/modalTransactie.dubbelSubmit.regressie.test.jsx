/**
 * modalTransactie.dubbelSubmit.regressie.test.jsx
 *
 * Regressietest voor A17: bezigRef-guard in ModalTransactie.
 *
 * Scenario: gebruiker klikt snel tweemaal op "Bevestigen →" vóórdat de eerste
 * async round-trip klaar is. Zonder guard worden twee identieke transacties
 * naar Supabase gestuurd. Met de bezigRef-guard wordt de tweede aanroep geblokkeerd.
 *
 * Bestandsextensie .jsx (niet .js) — Vitest/Rollup transformeert JSX-syntax
 * alleen in bestanden met .jsx of .tsx extensie via de Vite react-plugin.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ModalTransactie from '../components/ModalTransactie'

vi.mock('../hooks/useFocusTrap', () => ({ useFocusTrap: () => {} }))

describe('ModalTransactie — A17 dubbele-submit-guard', () => {
  let onBevestig
  let resolveBevestig

  beforeEach(() => {
    onBevestig = vi.fn(() => new Promise(resolve => { resolveBevestig = resolve }))
  })

  function renderModal(props = {}) {
    return render(
      <ModalTransactie
        type="storting"
        potSaldo={100}
        valuta="EUR"
        ikBenActief={true}
        onBevestig={onBevestig}
        onAnnuleer={vi.fn()}
        {...props}
      />
    )
  }

  it('roept onBevestig precies één keer aan bij snelle dubbele klik', async () => {
    renderModal()
    const input = screen.getByLabelText(/bedrag/i)
    const knop = screen.getByRole('button', { name: /bevestigen/i })

    await userEvent.type(input, '10')

    fireEvent.click(knop)
    fireEvent.click(knop)

    resolveBevestig()

    await waitFor(() => {
      expect(onBevestig).toHaveBeenCalledTimes(1)
    })
  })

  it('knop is disabled tijdens laden', async () => {
    renderModal()
    const input = screen.getByLabelText(/bedrag/i)
    const knop = screen.getByRole('button', { name: /bevestigen/i })

    await userEvent.type(input, '20')
    fireEvent.click(knop)

    expect(knop).toBeDisabled()

    resolveBevestig()
    await waitFor(() => expect(knop).not.toBeDisabled())
  })

  it('reset bezigRef na fout zodat opnieuw proberen mogelijk is', async () => {
    onBevestig = vi.fn()
      .mockRejectedValueOnce(new Error('DB fout'))
      .mockResolvedValueOnce(undefined)

    renderModal()
    const input = screen.getByLabelText(/bedrag/i)
    const knop = screen.getByRole('button', { name: /bevestigen/i })

    await userEvent.type(input, '15')

    fireEvent.click(knop)
    await waitFor(() => expect(onBevestig).toHaveBeenCalledTimes(1))

    // Na de fout: opnieuw proberen moet lukken
    fireEvent.click(knop)
    await waitFor(() => expect(onBevestig).toHaveBeenCalledTimes(2))
  })

  it('werkt ook voor het type betaling', async () => {
    renderModal({ type: 'betaling', potSaldo: 50 })
    const input = screen.getByLabelText(/bedrag/i)
    const knop = screen.getByRole('button', { name: /bevestigen/i })

    await userEvent.type(input, '10')

    fireEvent.click(knop)
    fireEvent.click(knop)

    resolveBevestig()

    await waitFor(() => {
      expect(onBevestig).toHaveBeenCalledTimes(1)
      expect(onBevestig).toHaveBeenCalledWith('betaling', 10)
    })
  })
})
