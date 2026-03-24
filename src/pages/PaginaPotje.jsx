import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { vertaalFout } from '../utils/vertaalFout'
import { berekenSaldi } from '../utils/berekenSaldi'
import { formatBedrag } from '../utils/formatBedrag'
import ModalDeelnemen from '../components/ModalDeelnemen.jsx'
import ModalTransactie from '../components/ModalTransactie.jsx'
import ModalSluiten from '../components/ModalSluiten.jsx'
import PaginaEindafrekening from './PaginaEindafrekening.jsx'

function PaginaPotje() {
  const { id } = useParams()
  const [potje, setPotje] = useState(null)
  const [deelnemers, setDeelnemers] = useState([])
  const [transacties, setTransacties] = useState([])
  const [deelnemer, setDeelnemer] = useState(null)
  const [laden, setLaden] = useState(true)
  const [fout, setFout] = useState('')
  const [online, setOnline] = useState(true)
  const [modaal, setModaal] = useState(null) // 'storting' | 'betaling' | 'sluiten'
  const [toast, setToast] = useState(null)
  const [afmeldenLaden, setAfmeldenLaden] = useState(false)
  const [toonAlleTransacties, setToonAlleTransacties] = useState(false)
  const toastTimerRef = useRef(null)

  const deviceId = getDeviceId()

  function getDeviceId() {
    let id = localStorage.getItem('digipot_device_id')
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('digipot_device_id', id) }
    return id
  }

  // V1: variabele toast-duur: actie=10s, info=5s, overig=3s
  function toonToast(bericht, type = 'info', actie = null) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ bericht, type, actie })
    const duur = actie ? 10000 : type === 'info' ? 5000 : 3000
    toastTimerRef.current = setTimeout(() => setToast(null), duur)
  }

  const laadData = useCallback(async () => {
    try {
      const [{ data: p, error: pe }, { data: d, error: de }, { data: t, error: te }] =
        await Promise.all([
          supabase.from('potjes').select('*').eq('id', id).single(),
          supabase.from('deelnemers').select('*').eq('potje_id', id).order('aangemaakt_op'),
          supabase.from('transacties').select('*').eq('potje_id', id).order('aangemaakt_op')
        ])
      if (pe) throw pe
      if (de) throw de
      if (te) throw te
      setPotje(p)
      setDeelnemers(d)
      setTransacties(t)
      const bekende = d.find(x => x.device_id === deviceId)
      if (bekende) setDeelnemer(bekende)
    } catch (e) {
      setFout(vertaalFout(e) || 'Dit potje bestaat niet. Controleer de link.')
    } finally {
      setLaden(false)
    }
  }, [id, deviceId])

  useEffect(() => {
    laadData()

    const kanaal = supabase.channel(`potje-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'potjes', filter: `id=eq.${id}` },
        payload => setPotje(payload.new))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deelnemers', filter: `potje_id=eq.${id}` },
        payload => setDeelnemers(prev => [...prev.filter(d => d.id !== payload.new.id), payload.new].sort((a,b) => new Date(a.aangemaakt_op) - new Date(b.aangemaakt_op))))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deelnemers', filter: `potje_id=eq.${id}` },
        payload => {
          setDeelnemers(prev => prev.map(d => d.id === payload.new.id ? payload.new : d))
          setDeelnemer(prev => prev && prev.id === payload.new.id ? payload.new : prev)
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transacties', filter: `potje_id=eq.${id}` },
        payload => setTransacties(prev => [...prev, payload.new]))
      .subscribe(status => setOnline(status === 'SUBSCRIBED'))

    const handleOnline = () => { setOnline(true); toonToast('Verbinding hersteld.', 'ok') }
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      supabase.removeChannel(kanaal)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [id, laadData])

  async function handleDeelnemen(naam) {
    const { data, error } = await supabase
      .from('deelnemers').insert({ potje_id: id, naam, device_id: deviceId }).select().single()
    if (error) throw error
    setDeelnemer(data)
  }

  async function handleTransactie(type, bedrag) {
    if (!ikBenActief) throw new Error('NIET_ACTIEF')
    const saldi = berekenSaldi(deelnemers, transacties)
    if (type === 'betaling' && bedrag > saldi.potSaldo) {
      throw new Error(`SALDO_TE_LAAG:${saldi.potSaldo}`)
    }
    // K5: .select().single() om ID te krijgen voor undo
    const { data, error } = await supabase.from('transacties')
      .insert({ potje_id: id, deelnemer_id: deelnemer.id, type, bedrag })
      .select().single()
    if (error) throw error
    setModaal(null)
    toonToast(
      type === 'storting'
        ? `Storting van ${formatBedrag(bedrag)} geregistreerd.`
        : `Betaling van ${formatBedrag(bedrag)} geregistreerd.`,
      'ok',
      { label: 'Ongedaan', handler: () => handleUndo(data.id) }
    )
  }

  // K5: undo — verwijder transactie binnen 10 seconden
  async function handleUndo(transactieId) {
    setToast(null)
    const { error } = await supabase.from('transacties').delete().eq('id', transactieId)
    if (error) {
      toonToast('Ongedaan maken mislukt.', 'fout')
    } else {
      setTransacties(prev => prev.filter(t => t.id !== transactieId))
      toonToast('Transactie ongedaan gemaakt.', 'ok')
    }
  }

  async function handleSluiten() {
    const { error } = await supabase.from('potjes')
      .update({ status: 'gesloten', gesloten_op: new Date().toISOString(), gesloten_door: deelnemer.id })
      .eq('id', id).eq('status', 'open')
    if (error) throw error
    setModaal(null)
  }

  async function handleAfmelden() {
    if (!deelnemer || afmeldenLaden) return
    setAfmeldenLaden(true)
    try {
      const { data, error } = await supabase
        .from('deelnemers')
        .update({ actief: false, afgemeld_op: new Date().toISOString() })
        .eq('id', deelnemer.id)
        .select().single()
      if (error) throw error
      setDeelnemer(data)
      setDeelnemers(prev => prev.map(d => d.id === data.id ? data : d))
      toonToast('Je bent afgemeld. Je telt niet meer mee bij nieuwe betalingen.', 'info')
    } catch (e) {
      toonToast(vertaalFout(e) || 'Afmelden mislukt.', 'fout')
    } finally {
      setAfmeldenLaden(false)
    }
  }

  async function handleAanmelden() {
    if (!deelnemer || afmeldenLaden) return
    setAfmeldenLaden(true)
    try {
      const { data, error } = await supabase
        .from('deelnemers')
        .update({ actief: true, afgemeld_op: null })
        .eq('id', deelnemer.id)
        .select().single()
      if (error) throw error
      setDeelnemer(data)
      setDeelnemers(prev => prev.map(d => d.id === data.id ? data : d))
      toonToast('Je doet weer mee!', 'ok')
    } catch (e) {
      toonToast(vertaalFout(e) || 'Aanmelden mislukt.', 'fout')
    } finally {
      setAfmeldenLaden(false)
    }
  }

  const saldi = berekenSaldi(deelnemers, transacties)
  const actieveDeelnemers = deelnemers.filter(d => d.actief !== false)
  const heeftTransacties = transacties.length > 0
  const ikBenActief = deelnemer?.actief !== false

  // V2: uitgebreide skeleton loader
  if (laden) return (
    <div className="pagina">
      <div className="kaart">
        <div className="skeleton" style={{ height: 28, width: '60%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 16, width: '40%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 16, width: '30%' }} />
      </div>
      <div className="kaart">
        <div className="skeleton" style={{ height: 16, width: '50%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 40, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 40, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 40 }} />
      </div>
      <div className="kaart">
        <div className="skeleton" style={{ height: 16, width: '40%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 32, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 32 }} />
      </div>
    </div>
  )

  if (fout) return <div className="pagina"><div className="kaart"><p style={{ color: 'var(--rood)' }}>{fout}</p></div></div>

  // G4: ModalDeelnemen is een bottom-sheet overlay; render achtergrond eronder
  if (!deelnemer) return (
    <>
      <div className="pagina">
        <div className="kaart">
          <h1 className="titel">🍺 {potje?.naam}</h1>
          <p className="subtitel">Doe mee en splits de kosten eerlijk.</p>
        </div>
      </div>
      <ModalDeelnemen potjeNaam={potje?.naam} deelnemers={deelnemers} onDeelnemen={handleDeelnemen} />
    </>
  )

  if (potje?.status === 'gesloten') return (
    <PaginaEindafrekening potje={potje} deelnemers={deelnemers} transacties={transacties} />
  )

  // V5: actief-banner namen afkappen na 3
  const actieveNamen = actieveDeelnemers.map(d => d.naam)
  const bannerNamenTekst = actieveNamen.length <= 3
    ? actieveNamen.join(', ')
    : `${actieveNamen.slice(0, 3).join(', ')} +${actieveNamen.length - 3} anderen`

  // V7: transactielijst afkappen op 10 meest recente
  const zichtbareTransacties = toonAlleTransacties ? transacties : transacties.slice(-10)

  return (
    <>
      {/* V8: verbindingsbanner position:fixed, buiten .pagina flow */}
      {!online && <div className="verbinding-banner">⚠️ Verbinding verbroken. Wijzigingen worden niet opgeslagen.</div>}

      <div className="pagina" style={!online ? { paddingTop: 48 } : undefined}>

        {/* V5: actieve deelnemers banner */}
        {actieveDeelnemers.length < deelnemers.length && (
          <div className="actief-banner">
            👥 Actief: {bannerNamenTekst || '—'}
          </div>
        )}

        {/* G2: deel-link kaart wanneer je de enige deelnemer bent */}
        {deelnemers.length === 1 && (
          <div className="kaart" style={{ background: 'var(--groen-licht)', border: '1px solid #bbf7d0' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--groen)', marginBottom: 6 }}>
              👋 Nodig vrienden uit!
            </p>
            <p style={{ fontSize: 13, color: 'var(--grijs-600)', marginBottom: 12 }}>
              Je bent de enige deelnemer. Deel de link zodat anderen ook kunnen meedoen.
            </p>
            <button
              className="knop knop-primair"
              onClick={() => { navigator.clipboard.writeText(window.location.href); toonToast('Link gekopieerd!', 'ok') }}
            >
              🔗 Link kopiëren
            </button>
          </div>
        )}

        {/* Header */}
        <div className="kaart">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 className="titel">🍺 {potje?.naam}</h1>
              <p className="subtitel" style={{ marginBottom: 0 }}>Welkom, {deelnemer.naam}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: saldi.potSaldo > 0 ? 'var(--groen)' : 'var(--grijs-600)' }}>
                {formatBedrag(saldi.potSaldo)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--grijs-400)' }}>saldo</div>
            </div>
          </div>

          {/* Jouw status */}
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            {!ikBenActief && (
              <span className="badge badge-afgemeld">Afgemeld</span>
            )}
            {/* G5: padding verhoogd naar 11px 16px voor min-height 44px touch target */}
            <button
              className={`knop ${ikBenActief ? 'knop-afmelden' : 'knop-aanmelden'}`}
              style={{ width: 'auto', fontSize: 13, padding: '11px 16px' }}
              onClick={ikBenActief ? handleAfmelden : handleAanmelden}
              disabled={afmeldenLaden}
            >
              {afmeldenLaden ? 'Bezig...' : ikBenActief ? '👋 Afmelden' : '✅ Weer meedoen'}
            </button>
          </div>

          {/* Kopieerknop — alleen bij meerdere deelnemers (anders G2-kaart) */}
          {deelnemers.length > 1 && (
            <button
              className="knop knop-secundair"
              style={{ marginTop: 10, fontSize: 14, padding: '8px 14px', width: 'auto' }}
              onClick={() => { navigator.clipboard.writeText(window.location.href); toonToast('Link gekopieerd!', 'ok') }}
            >
              🔗 Link kopiëren
            </button>
          )}
        </div>

        {/* Deelnemers */}
        <div className="kaart">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            Deelnemers ({actieveDeelnemers.length}/{deelnemers.length})
          </h2>

          {/* Kolomhoofden — G3: "Ingelegd" → "Gestort" */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, padding: '4px 0 8px', borderBottom: '1px solid var(--grijs-200)', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--grijs-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Naam</span>
            <span style={{ fontSize: 11, color: 'var(--grijs-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Gestort</span>
            <span style={{ fontSize: 11, color: 'var(--grijs-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Uitgegeven</span>
          </div>

          {deelnemers.map(d => {
            const saldiD = saldi.deelnemersSaldi.find(s => s.id === d.id)
            const isAfgemeld = d.actief === false
            return (
              <div key={d.id} style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                gap: 8,
                padding: '8px 0',
                borderBottom: '1px solid var(--grijs-100)',
                opacity: isAfgemeld ? 0.55 : 1,
                background: isAfgemeld ? 'var(--grijs-50, #f9f9f9)' : 'transparent',
                borderRadius: isAfgemeld ? 6 : 0,
                paddingLeft: isAfgemeld ? 6 : 0,
                paddingRight: isAfgemeld ? 6 : 0,
              }}>
                <span style={{ fontWeight: d.id === deelnemer.id ? 600 : 400, display: 'flex', alignItems: 'center', gap: 6, textDecoration: isAfgemeld ? 'line-through' : 'none' }}>
                  {d.naam} {d.id === deelnemer.id ? '(jij)' : ''}
                  {isAfgemeld && <span className="badge badge-afgemeld" style={{ fontSize: 10 }}>Afgemeld</span>}
                </span>
                <span style={{ fontSize: 14, color: 'var(--grijs-600)', textAlign: 'right' }}>
                  {formatBedrag(saldiD?.gestort || 0)}
                </span>
                <span style={{ fontSize: 14, color: (saldiD?.uitgegeven || 0) > 0 ? 'var(--rood)' : 'var(--grijs-400)', textAlign: 'right' }}>
                  {formatBedrag(saldiD?.uitgegeven || 0)}
                </span>
              </div>
            )
          })}
        </div>

        {/* Transacties */}
        <div className="kaart">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Transacties</h2>
          {transacties.length === 0 ? (
            <p style={{ color: 'var(--grijs-400)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>
              Nog geen transacties. Voeg een storting toe om te beginnen.
            </p>
          ) : (
            <>
              {zichtbareTransacties.map(t => {
                const naam = deelnemers.find(d => d.id === t.deelnemer_id)?.naam || '?'
                const tijd = new Date(t.aangemaakt_op)
                const nu = new Date()
                const ouderDan24u = (nu - tijd) > 86400000
                const tijdLabel = ouderDan24u
                  ? tijd.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) + ' ' + tijd.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
                  : tijd.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--grijs-100)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{t.type === 'storting' ? '🟢' : '🔴'}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{naam}</div>
                        <div style={{ fontSize: 12, color: 'var(--grijs-400)' }}>{tijdLabel}</div>
                      </div>
                    </div>
                    <span style={{ fontWeight: 600, color: t.type === 'storting' ? 'var(--groen)' : 'var(--rood)' }}>
                      {t.type === 'storting' ? '+' : '-'}{formatBedrag(t.bedrag)}
                    </span>
                  </div>
                )
              })}
              {/* V7: toon-alle knop */}
              {!toonAlleTransacties && transacties.length > 10 && (
                <button
                  className="knop knop-secundair"
                  style={{ marginTop: 12, fontSize: 14 }}
                  onClick={() => setToonAlleTransacties(true)}
                >
                  Toon alle {transacties.length} transacties
                </button>
              )}
            </>
          )}
        </div>

        {/* Actieknoppen */}
        <div className="kaart" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ikBenActief ? (
            <>
              <button className="knop knop-primair" onClick={() => setModaal('storting')}>💰 Storten</button>
              {/* G6: betaalknop uitgeschakeld bij leeg saldo */}
              <button
                className="knop knop-secundair"
                onClick={() => setModaal('betaling')}
                disabled={saldi.potSaldo === 0}
              >
                🍺 Rondje betaald
              </button>
              {saldi.potSaldo === 0 && (
                <p style={{ fontSize: 12, color: 'var(--grijs-400)', textAlign: 'center', marginTop: -4 }}>
                  Geen saldo beschikbaar. Voeg eerst een storting toe.
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize: 14, color: 'var(--grijs-400)', textAlign: 'center', padding: '8px 0' }}>
              Je hebt je afgemeld en kunt geen transacties meer invoeren.
            </p>
          )}
          {/* V9: visuele scheiding tussen transactie-acties en potje sluiten */}
          {heeftTransacties && (
            <>
              <div style={{ borderTop: '1px solid var(--grijs-200)', marginTop: 2 }} />
              <button className="knop knop-gevaar" style={{ opacity: 0.7 }} onClick={() => setModaal('sluiten')}>
                🔒 Potje sluiten
              </button>
            </>
          )}
        </div>

        {/* Modals */}
        {modaal === 'storting' && (
          <ModalTransactie type="storting" potSaldo={saldi.potSaldo} ikBenActief={ikBenActief} onBevestig={handleTransactie} onAnnuleer={() => setModaal(null)} />
        )}
        {modaal === 'betaling' && (
          <ModalTransactie type="betaling" potSaldo={saldi.potSaldo} ikBenActief={ikBenActief} onBevestig={handleTransactie} onAnnuleer={() => setModaal(null)} />
        )}
        {modaal === 'sluiten' && (
          <ModalSluiten potjeNaam={potje?.naam} onBevestig={handleSluiten} onAnnuleer={() => setModaal(null)} />
        )}

        {/* K5: toast met optionele undo-knop */}
        {toast && (
          <div className={`toast ${toast.type}`}>
            <span>{toast.bericht}</span>
            {toast.actie && (
              <button className="toast-knop" onClick={toast.actie.handler}>{toast.actie.label}</button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export default PaginaPotje
