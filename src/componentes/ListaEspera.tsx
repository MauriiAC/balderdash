import type { Jugador } from '../tipos'

interface Props {
  jugadores: Record<string, Jugador>
  listos: Record<string, true>
  uidPropio: string
  titulo: string
}

/** Quiénes ya entregaron o ya votaron. Nunca muestra QUÉ hicieron. */
export function ListaEspera({ jugadores, listos, uidPropio, titulo }: Props) {
  const entradas = Object.entries(jugadores)
  const cuantos = entradas.filter(([uid]) => listos[uid]).length

  return (
    <section className="bloque">
      <h2>
        {titulo}{' '}
        <span className="atenuado">
          ({cuantos}/{entradas.length})
        </span>
      </h2>
      <ul className="lista-jugadores">
        {entradas.map(([uid, jugador]) => (
          <li key={uid} className={listos[uid] ? '' : 'pendiente'}>
            <span className={listos[uid] ? 'tilde' : 'punto-espera'} aria-hidden="true">
              {listos[uid] ? '✓' : ''}
            </span>
            <span className="nombre">{jugador.nombre}</span>
            {uid === uidPropio && <span className="etiqueta etiqueta-vos">vos</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
