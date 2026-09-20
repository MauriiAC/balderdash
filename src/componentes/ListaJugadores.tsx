import type { Jugador } from '../tipos'

interface Props {
  jugadores: Record<string, Jugador>
  host: string
  uidPropio: string
}

export function ListaJugadores({ jugadores, host, uidPropio }: Props) {
  const entradas = Object.entries(jugadores)

  return (
    <ul className="lista-jugadores">
      {entradas.map(([uid, jugador]) => (
        <li key={uid} className={jugador.conectado ? '' : 'desconectado'}>
          <span
            className="punto"
            title={jugador.conectado ? 'Conectado' : 'Desconectado'}
          />
          <span className="nombre">{jugador.nombre}</span>
          {uid === host && <span className="etiqueta">host</span>}
          {uid === uidPropio && <span className="etiqueta etiqueta-vos">vos</span>}
        </li>
      ))}
    </ul>
  )
}
