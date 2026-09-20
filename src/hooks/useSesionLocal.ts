import { useCallback, useState } from 'react'

const CLAVE = 'balderdash:sesion'

export interface SesionLocal {
  codigo: string
  nombre: string
}

function leer(): SesionLocal | null {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return null
    const valor = JSON.parse(crudo) as Partial<SesionLocal>
    if (typeof valor.codigo !== 'string' || typeof valor.nombre !== 'string') {
      return null
    }
    return { codigo: valor.codigo, nombre: valor.nombre }
  } catch {
    // localStorage bloqueado (modo privado) o JSON corrupto: se juega igual,
    // solo que sin reconexión automática.
    return null
  }
}

/** Guarda sala y nombre para poder volver a entrar después de un reload. */
export function useSesionLocal() {
  const [sesion, setSesion] = useState<SesionLocal | null>(leer)

  const guardar = useCallback((nueva: SesionLocal) => {
    setSesion(nueva)
    try {
      localStorage.setItem(CLAVE, JSON.stringify(nueva))
    } catch {
      /* si no se puede guardar, no pasa nada grave */
    }
  }, [])

  const limpiar = useCallback(() => {
    setSesion(null)
    try {
      localStorage.removeItem(CLAVE)
    } catch {
      /* idem */
    }
  }, [])

  return { sesion, guardar, limpiar }
}
