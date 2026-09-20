import type { FilaTabla } from '../logica/puntaje'
import type { Jugador } from '../tipos'

interface Props {
  tabla: FilaTabla[]
  jugadores: Record<string, Jugador>
  uidPropio: string
  /** Sin el desglose de aciertos y engañados: sirve para el corte de ronda. */
  compacta?: boolean
}

export function nombreDe(jugadores: Record<string, Jugador>, uid: string): string {
  return jugadores[uid]?.nombre ?? 'alguien que se fue'
}

function desglose(fila: FilaTabla): string {
  const partes: string[] = []
  if (fila.aciertos > 0) {
    partes.push(`${fila.aciertos} ${fila.aciertos === 1 ? 'acierto' : 'aciertos'}`)
  }
  if (fila.votosRecibidos > 0) {
    partes.push(`engañó a ${fila.votosRecibidos}`)
  }
  return partes.join(' · ')
}

export function TablaPosiciones({ tabla, jugadores, uidPropio, compacta }: Props) {
  return (
    <ol className="tabla">
      {tabla.map((fila) => (
        <li
          key={fila.uid}
          className={`fila-tabla${fila.posicion === 1 ? ' puntero' : ''}`}
        >
          <span className="posicion">{fila.posicion}</span>
          <span className="datos">
            <span className="nombre">
              {nombreDe(jugadores, fila.uid)}
              {fila.uid === uidPropio && <span className="etiqueta etiqueta-vos">vos</span>}
            </span>
            {!compacta && desglose(fila) !== '' && (
              <span className="atenuado chico">{desglose(fila)}</span>
            )}
          </span>
          <span className="puntos">{fila.puntos}</span>
        </li>
      ))}
    </ol>
  )
}
