import { useCallback, useState } from 'react'
import { Cargando } from './componentes/Cargando'
import { useAuth } from './hooks/useAuth'
import { useSala } from './hooks/useSala'
import { useSesionLocal } from './hooks/useSesionLocal'
import { Inicio } from './pantallas/Inicio'
import { Lobby } from './pantallas/Lobby'
import { salirDeSala } from './servicios/sala'

export function App() {
  const { uid, cargando: authCargando, error: authError } = useAuth()
  const { sesion, guardar, limpiar } = useSesionLocal()
  const { sala, cargando: salaCargando, error: salaError } = useSala(
    sesion?.codigo ?? null,
    uid,
  )
  const [aviso, setAviso] = useState<string | null>(null)

  const alEntrar = useCallback(
    (codigo: string, nombre: string) => {
      setAviso(null)
      guardar({ codigo, nombre })
    },
    [guardar],
  )

  const alSalir = useCallback(() => {
    if (sesion && uid) void salirDeSala(sesion.codigo, uid)
    limpiar()
  }, [sesion, uid, limpiar])

  if (authCargando) return <Cargando mensaje="Conectando…" />
  if (authError || !uid) {
    return <PantallaError mensaje={authError ?? 'No pude iniciar sesión.'} />
  }

  if (!sesion) {
    return (
      <Inicio
        uid={uid}
        nombreInicial=""
        codigoInicial=""
        aviso={aviso}
        alEntrar={alEntrar}
      />
    )
  }

  if (salaCargando) return <Cargando mensaje={`Entrando a ${sesion.codigo}…`} />

  if (salaError) {
    return <PantallaError mensaje={salaError} alVolver={() => limpiar()} />
  }

  // La sala se borró, o el código guardado ya no existe.
  if (!sala) {
    return (
      <Inicio
        uid={uid}
        nombreInicial={sesion.nombre}
        codigoInicial=""
        aviso={`La sala ${sesion.codigo} ya no existe.`}
        alEntrar={alEntrar}
      />
    )
  }

  // Existe la sala pero este uid no figura adentro: pasa si se borró el storage
  // del navegador o si es otro dispositivo. Se vuelve a entrar a mano.
  if (!sala.jugadores?.[uid]) {
    return (
      <Inicio
        uid={uid}
        nombreInicial={sesion.nombre}
        codigoInicial={sesion.codigo}
        aviso={`No figurás en la sala ${sesion.codigo}. Volvé a entrar.`}
        alEntrar={alEntrar}
      />
    )
  }

  if (sala.estado === 'lobby') {
    return <Lobby codigo={sesion.codigo} sala={sala} uid={uid} alSalir={alSalir} />
  }

  return (
    <div className="pantalla">
      <header className="tapa">
        <h1>Partida en curso</h1>
      </header>
      <p className="atenuado">
        El ciclo de ronda llega en la etapa 2. Estado actual: <code>{sala.estado}</code>
        {sala.ronda ? ` · ronda ${sala.ronda.numero} · ${sala.ronda.fase}` : ''}
      </p>
      <button className="secundario" onClick={alSalir}>
        Salir de la sala
      </button>
    </div>
  )
}

function PantallaError({ mensaje, alVolver }: { mensaje: string; alVolver?: () => void }) {
  return (
    <div className="pantalla">
      <header className="tapa">
        <h1>Uy</h1>
      </header>
      <p className="error">{mensaje}</p>
      {alVolver && (
        <button className="secundario" onClick={alVolver}>
          Volver al inicio
        </button>
      )}
    </div>
  )
}
