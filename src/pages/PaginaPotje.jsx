import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { logFout } from '../utils/logFout'
import { berekenSaldi } from '../utils/berekenSaldi'
import { formatBedrag } from '../utils/formatBedrag'
import ModalDeelnemen from '../components/ModalDeelnemen.jsx'
import ModalTransactie from '../components/ModalTransactie.jsx'
import ModalSluiten from '../components/ModalSluiten.jsx'
import PaginaEindafrekening from './PaginaEindafrekening.jsx'
import PaginaOverzicht from './PaginaOverzicht.jsx'

function PaginaPotje() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [potje, setPotje] = useState(null)
  const [deelnemers, setDeelnemers] = useState([])
  const [transacties, setTransacties] = useState([])
  const [deelnemer, setDeelnemer] = useState(null)
  const [laden, setLaden] = useState(true)
  const [fout, setFout] = useState('')
  const [online, setOnline] = useState(true)
  const [modaal, setModaal] = useState(null) // 'betaling' | 'sluiten'
  const [toast, setToast] = useState(null)
  const [afmeldenLaden, setAfmeldenLaden] = useState(false)
  const toastTimerRef = useRef(null)

  const deviceId = (() => {
    let did = localStorage.getItem('digipot_device_id')
    if (!did) { did = crypto.randomUUID(); localStorage.setItem('digipot_device_id', did) }
    return did
  })()

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
      setFout(logFout(e, { component: 'PaginaPotje', actie: 'laadData' }) || 'Dit potje bestaat niet. Controleer de link.')
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
        payload => setDeelnemers(prev => [...prev.filter(d => d.id !== payload.new.id), payload.new].sort((a, b) => new Date(a.aangemaakt_op) - new Date(b.aangemaakt_op))))
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
    // Na deelnemen direct door naar Stortingscherm
    navigate(`/potje/${id}/storten`)
  }

  async function handleTransactie(type, bedrag) {
    if (!ikBenActief) throw new Error('NIET_ACTIEF')
    const saldi = berekenSaldi(deelnemers, transacties)
    if (type === 'betaling' && bedrag > saldi.potSaldo) {
      throw new Error(`SALDO_TE_LAAG:${saldi.potSaldo}`)
    }
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

  async function handleUndo(transactieId) {
    setToast(null)
    const { error } = await supabase.from('transacties').delete().eq('id', transactieId)
    if (error) {
      toonToast(logFout(error, { component: 'PaginaPotje', actie: 'undo' }), 'fout')
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
    const saldi = berekenSaldi(deelnemers, transacties)
    const mijnSaldi = saldi.deelnemersSaldi.find(s => s.id === deelnemer.id)
    if ((mijnSaldi?.gestort ?? 0) === 0) {
      toonToast('Je kunt je pas afmelden als je hebt gestort.', 'fout')
      return
    }
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
      toonToast(logFout(e, { component: 'PaginaPotje', actie: 'afmelden' }), 'fout')
    } finally {
      setAfmeldenLaden(false)
    }
  }

  const saldi = berekenSaldi(deelnemers, transacties)
  const ikBenActief = deelnemer?.actief !== false

  // Skeleton loader
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
    </div>
  )

  if (fout) return (
    <div className="pagina">
      <div className="kaart">
        <p style={{ color: 'var(--rood)' }}>{fout}</p>
      </div>
    </div>
  )

  // Deelneemscherm: deelnemer nog niet bekend op dit device
  if (!deelnemer) {
    return (
      <>
        <div className="pagina">
          <div className="kaart">
            <h1 className="titel">🍺 {potje?.naam}</h1>
            <p className="subtitel">Doe mee en splits de kosten eerlijk.</p>
          </div>
        </div>
        <ModalDeelnemen
          potjeNaam={potje?.naam}
          deelnemers={deelnemers}
          onDeelnemen={handleDeelnemen}
          profielNaam={localStorage.getItem('digipot_profiel_naam')?.trim() || ''}
        />
      </>
    )
  }

  // Eindafrekeningscherm
  if (potje?.status === 'gesloten') return (
    <PaginaEindafrekening potje={potje} deelnemers={deelnemers} transacties={transacties} />
  )

  // Overzichtscherm
  return (
    <>
      {!online && (
        <div className="verbinding-banner">⚠️ Verbinding verbroken. Wijzigingen worden niet opgeslagen.</div>
      )}
      <div style={!online ? { paddingTop: 40 } : undefined}>
        <PaginaOverzicht
          potje={potje}
          deelnemers={deelnemers}
          transacties={transacties}
          deelnemer={deelnemer}
          onStorten={() => navigate(`/potje/${id}/storten`)}
          onBetalen={() => setModaal('betaling')}
          onSluiten={() => setModaal('sluiten')}
          onAfmelden={handleAfmelden}
          afmeldenLaden={afmeldenLaden}
        />
      </div>

      {modaal === 'betaling' && (
        <ModalTransactie
          type="betaling"
          potSaldo={saldi.potSaldo}
          ikBenActief={ikBenActief}
          onBevestig={handleTransactie}
          onAnnuleer={() => setModaal(null)}
        />
      )}
      {modaal === 'sluiten' && (
        <ModalSluiten
          potjeNaam={potje?.naam}
          onBevestig={handleSluiten}
          onAnnuleer={() => setModaal(null)}
        />
      )}

      {toast && (
        <div className={`toast ${toast.type}`}>
          <span>{toast.bericht}</span>
          {toast.actie && (
            <button className="toast-knop" onClick={toast.actie.handler}>{toast.actie.label}</button>
          )}
        </div>
      )}
    </>
  )
}

export default PaginaPotje
