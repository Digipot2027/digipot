import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { logFout } from '../utils/logFout'
import { berekenSaldi } from '../utils/berekenSaldi'
import { formatBedrag } from '../utils/formatBedrag'

function PaginaOpenPotjes() {
  const navigate = useNavigate()
  const [potjes, setPotjes] = useState([])
  const [laden, setLaden] = useState(true)
  const [fout, setFout] = useState('')

  const deviceId = localStorage.getItem('digipot_device_id')
  const profielNaam = localStorage.getItem('digipot_profiel_naam')?.trim() || null

  useEffect(() => {
    async function laadPotjes() {
      try {
        // Zoek alle deelnemers-records voor dit device of deze profielnaam
        const filters = []
        if (deviceId) filters.push(`device_id.eq.${deviceId}`)
        if (profielNaam) filters.push(`naam.eq.${profielNaam}`)

        if (filters.length === 0) {
          setPotjes([])
          setLaden(false)
          return
        }

        const { data: deelnemers, error: deError } = await supabase
          .from('deelnemers')
          .select('potje_id, naam, id')
          .or(filters.join(','))

        if (deError) throw deError
        if (!deelnemers || deelnemers.length === 0) {
          setPotjes([])
          setLaden(false)
          return
        }

        // Unieke potje-IDs
        const potjeIds = [...new Set(deelnemers.map(d => d.potje_id))]

        // Haal open potjes op, nieuwste bovenaan
        const { data: openPotjes, error: pError } = await supabase
          .from('potjes')
          .select('*')
          .in('id', potjeIds)
          .eq('status', 'open')
          .order('aangemaakt_op', { ascending: false })

        if (pError) throw pError

        // Per potje: deelnemers en transacties ophalen voor saldo
        const verrijkt = await Promise.all((openPotjes || []).map(async potje => {
          const [{ data: allDeelnemers }, { data: transacties }] = await Promise.all([
            supabase.from('deelnemers').select('*').eq('potje_id', potje.id),
            supabase.from('transacties').select('*').eq('potje_id', potje.id),
          ])
          const saldi = berekenSaldi(allDeelnemers || [], transacties || [])
          return {
            ...potje,
            aantalDeelnemers: (allDeelnemers || []).length,
            potSaldo: saldi.potSaldo,
          }
        }))

        setPotjes(verrijkt)
      } catch (e) {
        setFout(logFout(e, { component: 'PaginaOpenPotjes', actie: 'laadPotjes' }))
      } finally {
        setLaden(false)
      }
    }

    laadPotjes()
  }, [deviceId, profielNaam])

  function datumLabel(iso) {
    return new Date(iso).toLocaleDateString('nl-NL', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  if (laden) return (
    <div className="pagina">
      <div className="kaart">
        <div className="skeleton" style={{ height: 28, width: '50%', marginBottom: 12 }} />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="kaart">
          <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 14, width: '40%' }} />
        </div>
      ))}
    </div>
  )

  return (
    <div className="pagina">

      {/* Header */}
      <div className="kaart">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/instellingen')}
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--grijs-600)', padding: '4px 0', lineHeight: 1 }}
            aria-label="Terug naar instellingen"
          >
            ←
          </button>
          <h1 className="titel" style={{ marginBottom: 0 }}>🟢 Open potjes</h1>
        </div>
      </div>

      {fout && (
        <div className="kaart">
          <p style={{ color: 'var(--rood)', fontSize: '0.875rem' }}>{fout}</p>
        </div>
      )}

      {/* Lege staat */}
      {!fout && potjes.length === 0 && (
        <div className="kaart" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🍺</div>
          <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>
            Geen open potjes
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--grijs-600)', marginBottom: 20 }}>
            Je neemt nog niet deel aan een open potje op dit apparaat.
          </p>
          <button
            className="knop knop-primair"
            onClick={() => navigate('/')}
          >
            Nieuw potje starten
          </button>
        </div>
      )}

      {/* Lijst */}
      {potjes.length > 0 && (
        <div className="kaart" style={{ padding: 0, overflow: 'hidden' }}>
          {potjes.map((potje, index) => (
            <button
              key={potje.id}
              onClick={() => navigate(`/potje/${potje.id}`)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderBottom: index < potjes.length - 1 ? '1px solid var(--grijs-100)' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--grijs-900)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {potje.naam}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--grijs-400)' }}>
                  {potje.aantalDeelnemers} {potje.aantalDeelnemers === 1 ? 'deelnemer' : 'deelnemers'} · {datumLabel(potje.aangemaakt_op)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 12 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: potje.potSaldo > 0 ? 'var(--groen)' : 'var(--grijs-400)' }}>
                    {formatBedrag(potje.potSaldo)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--grijs-400)' }}>saldo</div>
                </div>
                <span style={{ fontSize: '1.25rem', color: 'var(--grijs-400)', lineHeight: 1 }}>›</span>
              </div>
            </button>
          ))}
        </div>
      )}

    </div>
  )
}

export default PaginaOpenPotjes
