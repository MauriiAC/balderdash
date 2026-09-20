import { useEffect, useState } from 'react'
import { mantenerPresencia, suscribirSala } from '../servicios/sala'
import type { SalaPublica } from '../tipos'

interface EstadoSalaHook {
  sala: SalaPublica | null
  cargando: boolean
  error: string | null
}

/**
 * Suscribe a todo el estado público de la sala con un solo listener y mantiene
 * la presencia del jugador mientras esté adentro.
 */
export function useSala(codigo: string | null, uid: string | null): EstadoSalaHook {
  const [estado, setEstado] = useState<EstadoSalaHook>({
    sala: null,
    cargando: Boolean(codigo),
    error: null,
  })

  useEffect(() => {
    if (!codigo || !uid) {
      setEstado({ sala: null, cargando: false, error: null })
      return
    }

    setEstado({ sala: null, cargando: true, error: null })

    const desuscribir = suscribirSala(
      codigo,
      (sala) => setEstado({ sala, cargando: false, error: null }),
      (error) =>
        setEstado({
          sala: null,
          cargando: false,
          error: error.message.includes('permission_denied')
            ? 'La base rechazó la lectura. ¿Cargaste database.rules.json?'
            : `No pude leer la sala: ${error.message}`,
        }),
    )

    return desuscribir
  }, [codigo, uid])

  // Presencia aparte: depende de estar adentro, no de haber leído la sala.
  useEffect(() => {
    if (!codigo || !uid) return
    return mantenerPresencia(codigo, uid)
  }, [codigo, uid])

  return estado
}
