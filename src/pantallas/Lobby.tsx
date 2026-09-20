import { useState } from 'react'
import { ListaJugadores } from '../componentes/ListaJugadores'
import { TOTAL_PALABRAS } from '../data/palabras'
import { actualizarRondas } from '../servicios/sala'
import type { SalaPublica } from '../tipos'

export const MIN_JUGADORES = 2

interface Props {
  codigo: string
  sala: SalaPublica
  uid: string
  alSalir: () => void
}

export function Lobby({ codigo, sala, uid, alSalir }: Props) {
  const [copiado, setCopiado] = useState(false)
  const soyHost = sala.host === uid
  const jugadores = sala.jugadores ?? {}
  const cantidad = Object.keys(jugadores).length
  const nombreHost = jugadores[sala.host]?.nombre ?? 'el host'

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // Sin permiso de portapapeles (o sin HTTPS): el código está a la vista igual.
    }
  }

  return (
    <div className="pantalla">
      <header className="tapa">
        <p className="atenuado">Código de la sala</p>
        <button className="codigo-grande" onClick={copiarCodigo} title="Tocá para copiar">
          {codigo}
        </button>
        <p className="atenuado chico">{copiado ? '¡Copiado!' : 'Tocá el código para copiarlo'}</p>
      </header>

      <section className="bloque">
        <h2>
          Jugadores <span className="atenuado">({cantidad})</span>
        </h2>
        <ListaJugadores jugadores={jugadores} host={sala.host} uidPropio={uid} />
      </section>

      <section className="bloque">
        <label className="campo">
          <span>Rondas</span>
          <select
            value={sala.config?.rondas ?? 8}
            disabled={!soyHost}
            onChange={(e) => void actualizarRondas(codigo, Number(e.target.value))}
          >
            {Array.from({ length: TOTAL_PALABRAS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'ronda' : 'rondas'}
              </option>
            ))}
          </select>
        </label>
        {!soyHost && (
          <p className="atenuado chico">Solo {nombreHost} puede cambiar la configuración.</p>
        )}
        <p className="atenuado chico">
          Hay {TOTAL_PALABRAS} palabras cargadas, así que ese es el máximo de rondas.
        </p>
      </section>

      <section className="bloque">
        {soyHost ? (
          <>
            <button className="primario" disabled title="Llega en la etapa 2">
              Empezar partida
            </button>
            {cantidad < MIN_JUGADORES && (
              <p className="atenuado chico">
                Hacen falta al menos {MIN_JUGADORES} jugadores para arrancar.
              </p>
            )}
            <p className="atenuado chico">
              El ciclo de ronda todavía no está implementado (etapa 2).
            </p>
          </>
        ) : (
          <p className="atenuado">Esperando a que {nombreHost} arranque la partida…</p>
        )}
      </section>

      <button className="secundario" onClick={alSalir}>
        Salir de la sala
      </button>
    </div>
  )
}
