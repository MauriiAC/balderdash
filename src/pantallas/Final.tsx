import { AccionHost } from '../componentes/AccionHost'
import { nombreDe, TablaPosiciones } from '../componentes/TablaPosiciones'
import { calcularTabla } from '../logica/puntaje'
import { volverAlLobby } from '../servicios/ronda'
import type { SalaPublica } from '../tipos'

interface Props {
  codigo: string
  sala: SalaPublica
  uid: string
  alSalir: () => void
}

export function Final({ codigo, sala, uid, alSalir }: Props) {
  const jugadores = sala.jugadores ?? {}
  const soyHost = sala.host === uid
  const tabla = calcularTabla(sala.historial, Object.keys(jugadores))
  const rondasJugadas = Object.keys(sala.historial ?? {}).length

  const ganadores = tabla.filter((f) => f.posicion === 1)
  const nadieSumo = ganadores.every((f) => f.puntos === 0)

  const nombres = ganadores.map((f) => nombreDe(jugadores, f.uid))
  const titulo = nadieSumo
    ? 'Empate en cero'
    : ganadores.length === 1
      ? `Ganó ${nombres[0]}`
      : `Empataron ${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`

  return (
    <div className="pantalla">
      <header className="tapa">
        <p className="atenuado chico">
          Terminó la partida · {rondasJugadas}{' '}
          {rondasJugadas === 1 ? 'ronda' : 'rondas'}
        </p>
        <h1>{titulo}</h1>
        {nadieSumo && (
          <p className="atenuado">Nadie acertó ni engañó a nadie. Pasa.</p>
        )}
      </header>

      <section className="bloque">
        <TablaPosiciones tabla={tabla} jugadores={jugadores} uidPropio={uid} />
      </section>

      <p className="atenuado chico">
        +2 por cada definición verdadera que votaste, +1 por cada jugador que
        cayó en una tuya.
      </p>

      {soyHost ? (
        <AccionHost
          etiqueta="Jugar otra"
          accion={() => volverAlLobby(codigo)}
          nota="Vuelven al lobby con el mismo código. Se borra el puntaje y las palabras vuelven a estar todas disponibles."
        />
      ) : (
        <p className="atenuado">
          {nombreDe(jugadores, sala.host)} puede arrancar otra partida con el
          mismo código.
        </p>
      )}

      <button className="secundario" onClick={alSalir}>
        Salir de la sala
      </button>
    </div>
  )
}
