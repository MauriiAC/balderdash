import { useMemo } from 'react'
import { AccionHost } from '../componentes/AccionHost'
import { CabeceraRonda } from '../componentes/CabeceraRonda'
import { ListaEspera } from '../componentes/ListaEspera'
import { useAccion } from '../hooks/useAccion'
import { barajarConSemilla } from '../logica/barajar'
import { revelar, votar } from '../servicios/ronda'
import type { Ronda, SalaPublica } from '../tipos'

interface Props {
  codigo: string
  sala: SalaPublica
  ronda: Ronda
  uid: string
  miVoto: string | null
  miOpcionId: string | null
}

export function Votando({ codigo, sala, ronda, uid, miVoto, miOpcionId }: Props) {
  const { ocupado, error, ejecutar } = useAccion()

  const soyHost = sala.host === uid
  const jugadores = sala.jugadores ?? {}
  const votaron = ronda.votaron ?? {}
  const yaVote = Boolean(miVoto)
  const faltan = Object.keys(jugadores).filter((u) => !votaron[u]).length

  // Orden propio de cada jugador, estable entre recargas de la página.
  const opciones = useMemo(() => {
    const entradas = Object.entries(ronda.opciones ?? {})
    return barajarConSemilla(entradas, `${uid}:${ronda.palabraId}`)
  }, [ronda.opciones, ronda.palabraId, uid])

  return (
    <div className="pantalla">
      <CabeceraRonda
        numero={ronda.numero}
        total={sala.config.rondas}
        palabra={ronda.palabra}
        bajada={yaVote ? 'Ya votaste.' : '¿Cuál es la definición de verdad?'}
      />

      <section className="bloque">
        <ul className="opciones">
          {opciones.map(([id, opcion]) => {
            const esMia = id === miOpcionId
            const laVote = id === miVoto
            return (
              <li key={id}>
                <button
                  className={`opcion${laVote ? ' elegida' : ''}${esMia ? ' mia' : ''}`}
                  disabled={esMia || yaVote || ocupado}
                  onClick={() => ejecutar(() => votar(codigo, uid, id))}
                >
                  <span className="opcion-texto">{opcion.texto}</span>
                  {esMia && <span className="etiqueta">la tuya</span>}
                  {laVote && <span className="etiqueta etiqueta-vos">tu voto</span>}
                </button>
              </li>
            )
          })}
        </ul>
        {error && <p className="error chico">{error}</p>}
        {!yaVote && (
          <p className="atenuado chico">
            No podés votar la tuya. El voto no se puede cambiar.
          </p>
        )}
      </section>

      <ListaEspera
        jugadores={jugadores}
        listos={votaron}
        uidPropio={uid}
        titulo="Ya votaron"
      />

      {soyHost ? (
        <AccionHost
          etiqueta="Revelar"
          accion={() => revelar(codigo, sala)}
          nota={faltan > 0 ? `Faltan ${faltan} por votar.` : null}
        />
      ) : (
        faltan === 0 && (
          <p className="atenuado">
            Votaron todos. Esperando a {jugadores[sala.host]?.nombre ?? 'el host'}…
          </p>
        )
      )}
    </div>
  )
}
