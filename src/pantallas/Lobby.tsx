import { useState } from 'react'
import { AccionHost } from '../componentes/AccionHost'
import { useAccion } from '../hooks/useAccion'
import { ListaJugadores } from '../componentes/ListaJugadores'
import { TOTAL_PALABRAS } from '../data/palabras'
import { MAX_RONDAS, opcionesDeRondas } from '../logica/rondas'
import { empezarPartida } from '../servicios/ronda'
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
  const cambioDeRondas = useAccion()
  const opciones = opcionesDeRondas(TOTAL_PALABRAS)
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
            onChange={(e) =>
              cambioDeRondas.ejecutar(() =>
                actualizarRondas(codigo, Number(e.target.value)),
              )
            }
          >
            {opciones.map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'ronda' : 'rondas'}
              </option>
            ))}
          </select>
        </label>
        {cambioDeRondas.error && <p className="error chico">{cambioDeRondas.error}</p>}
        {!soyHost && (
          <p className="atenuado chico">Solo {nombreHost} puede cambiar la configuración.</p>
        )}
        <p className="atenuado chico">
          {TOTAL_PALABRAS <= MAX_RONDAS
            ? `Hay ${TOTAL_PALABRAS} palabras cargadas, así que ese es el máximo de rondas.`
            : `${TOTAL_PALABRAS} palabras cargadas. El máximo por partida son ${MAX_RONDAS} rondas.`}
        </p>
      </section>

      {soyHost ? (
        <AccionHost
          etiqueta="Empezar partida"
          accion={() => empezarPartida(codigo, sala)}
          deshabilitado={cantidad < MIN_JUGADORES}
          nota={
            cantidad < MIN_JUGADORES
              ? `Hacen falta al menos ${MIN_JUGADORES} jugadores para arrancar.`
              : null
          }
        />
      ) : (
        <p className="atenuado">Esperando a que {nombreHost} arranque la partida…</p>
      )}

      <button className="secundario" onClick={alSalir}>
        Salir de la sala
      </button>
    </div>
  )
}
