import { useEffect, useState } from 'react'
import { AccionHost } from '../componentes/AccionHost'
import { CabeceraRonda } from '../componentes/CabeceraRonda'
import { ListaEspera } from '../componentes/ListaEspera'
import { useAccion } from '../hooks/useAccion'
import { abrirVotacion, guardarDefinicion, LARGO_MAX_DEFINICION } from '../servicios/ronda'
import type { Ronda, SalaPublica } from '../tipos'

interface Props {
  codigo: string
  sala: SalaPublica
  ronda: Ronda
  uid: string
  miTexto: string | null
}

export function Escribiendo({ codigo, sala, ronda, uid, miTexto }: Props) {
  const [borrador, setBorrador] = useState('')
  const [editando, setEditando] = useState(false)
  const { ocupado, error, ejecutar } = useAccion()

  const soyHost = sala.host === uid
  const jugadores = sala.jugadores ?? {}
  const entregaron = ronda.entregaron ?? {}
  const yaEntregue = Boolean(entregaron[uid])
  const cuantosEntregaron = Object.keys(jugadores).filter((u) => entregaron[u]).length
  const faltan = Object.keys(jugadores).length - cuantosEntregaron

  // Al volver de un reload, el borrador arranca con lo que ya había entregado.
  useEffect(() => {
    if (miTexto !== null) setBorrador(miTexto)
  }, [miTexto])

  const mostrarFormulario = !yaEntregue || editando

  return (
    <div className="pantalla">
      <CabeceraRonda
        numero={ronda.numero}
        total={sala.config.rondas}
        palabra={ronda.palabra}
        bajada="Inventá una definición que suene de diccionario."
      />

      {mostrarFormulario ? (
        <section className="bloque">
          <label className="campo">
            <span>Tu definición</span>
            <textarea
              value={borrador}
              onChange={(e) => setBorrador(e.target.value.slice(0, LARGO_MAX_DEFINICION))}
              placeholder="Escribí como si la estuvieras copiando del diccionario…"
              rows={4}
              maxLength={LARGO_MAX_DEFINICION}
              autoFocus
            />
          </label>
          <p className="atenuado chico">
            {borrador.trim().length}/{LARGO_MAX_DEFINICION}
          </p>
          <button
            className="primario"
            disabled={borrador.trim().length === 0 || ocupado}
            onClick={() =>
              ejecutar(async () => {
                await guardarDefinicion(codigo, uid, borrador)
                setEditando(false)
              })
            }
          >
            {ocupado ? 'Guardando…' : yaEntregue ? 'Guardar cambios' : 'Entregar definición'}
          </button>
          {error && <p className="error chico">{error}</p>}
        </section>
      ) : (
        <section className="bloque">
          <h2>Ya entregaste</h2>
          <p className="definicion-propia">{borrador}</p>
          <button className="secundario" onClick={() => setEditando(true)}>
            Cambiarla
          </button>
          <p className="atenuado chico">
            Podés cambiarla hasta que arranque la votación.
          </p>
        </section>
      )}

      <ListaEspera
        jugadores={jugadores}
        listos={entregaron}
        uidPropio={uid}
        titulo="Ya entregaron"
      />

      {soyHost ? (
        <AccionHost
          etiqueta="Pasar a votación"
          accion={() => abrirVotacion(codigo, sala)}
          deshabilitado={cuantosEntregaron === 0}
          nota={
            cuantosEntregaron === 0
              ? 'Todavía no entregó nadie.'
              : faltan > 0
                ? `Faltan ${faltan}. Si arrancás ahora, se quedan sin definición en esta ronda.`
                : null
          }
        />
      ) : (
        faltan === 0 && (
          <p className="atenuado">
            Entregaron todos. Esperando a {jugadores[sala.host]?.nombre ?? 'el host'}…
          </p>
        )
      )}
    </div>
  )
}
