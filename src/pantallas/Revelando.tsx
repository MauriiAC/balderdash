import { AccionHost } from '../componentes/AccionHost'
import { CabeceraRonda } from '../componentes/CabeceraRonda'
import { Cargando } from '../componentes/Cargando'
import { siguienteRonda } from '../servicios/ronda'
import { AUTOR_REAL } from '../tipos'
import type { Ronda, SalaPublica } from '../tipos'

interface Props {
  codigo: string
  sala: SalaPublica
  ronda: Ronda
  uid: string
}

export function Revelando({ codigo, sala, ronda, uid }: Props) {
  const entrada = sala.historial?.[String(ronda.numero)]
  if (!entrada) return <Cargando mensaje="Contando los votos…" />

  const soyHost = sala.host === uid
  const jugadores = sala.jugadores ?? {}
  const votos = entrada.votos ?? {}
  const esUltima = ronda.numero >= sala.config.rondas

  const nombre = (deUid: string) => jugadores[deUid]?.nombre ?? 'alguien que se fue'

  const votantesDe = (opcionId: string) =>
    Object.entries(votos)
      .filter(([, votado]) => votado === opcionId)
      .map(([votante]) => votante)

  // La verdadera primero, y el resto por cuántos se la creyeron.
  const ordenadas = Object.entries(entrada.opciones).sort(([idA, a], [idB, b]) => {
    if (a.autor === AUTOR_REAL) return -1
    if (b.autor === AUTOR_REAL) return 1
    return votantesDe(idB).length - votantesDe(idA).length
  })

  return (
    <div className="pantalla">
      <CabeceraRonda
        numero={ronda.numero}
        total={sala.config.rondas}
        palabra={entrada.palabra}
        bajada="Esto es lo que había detrás de cada una."
      />

      <ul className="revelaciones">
        {ordenadas.map(([id, opcion]) => {
          const esReal = opcion.autor === AUTOR_REAL
          const votantes = votantesDe(id)
          return (
            <li key={id} className={`bloque revelacion${esReal ? ' real' : ''}`}>
              <p className="opcion-texto">{opcion.texto}</p>
              <p className="autoria">
                {esReal ? (
                  <strong>Era la verdadera</strong>
                ) : (
                  <>
                    La escribió <strong>{nombre(opcion.autor)}</strong>
                    {opcion.autor === uid && (
                      <span className="etiqueta etiqueta-vos">vos</span>
                    )}
                  </>
                )}
              </p>
              <p className="votantes atenuado chico">
                {votantes.length === 0
                  ? 'No la votó nadie.'
                  : `La votaron: ${votantes.map(nombre).join(', ')}`}
              </p>
            </li>
          )
        })}
      </ul>

      {soyHost ? (
        <AccionHost
          etiqueta={esUltima ? 'Ver resultados' : 'Siguiente ronda'}
          accion={() => siguienteRonda(codigo, sala)}
        />
      ) : (
        <p className="atenuado">
          Esperando a que {nombre(sala.host)} {esUltima ? 'cierre la partida' : 'siga'}…
        </p>
      )}
    </div>
  )
}
