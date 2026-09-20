import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { auth, persistenciaLista } from '../firebase'

interface EstadoAuth {
  uid: string | null
  cargando: boolean
  error: string | null
}

/**
 * Autenticación anónima al arranque. El uid queda guardado por Firebase en el
 * storage del navegador, así que sobrevive a recargar la página.
 */
export function useAuth(): EstadoAuth {
  const [estado, setEstado] = useState<EstadoAuth>({
    uid: null,
    cargando: true,
    error: null,
  })

  useEffect(() => {
    let vivo = true

    const desuscribir = onAuthStateChanged(
      auth,
      (usuario) => {
        if (!vivo) return
        if (usuario) {
          setEstado({ uid: usuario.uid, cargando: false, error: null })
          return
        }
        persistenciaLista
          .then(() => signInAnonymously(auth))
          .catch((error: Error) => {
            if (!vivo) return
            setEstado({
              uid: null,
              cargando: false,
              error: mensajeDeError(error),
            })
          })
      },
      (error) => {
        if (!vivo) return
        setEstado({ uid: null, cargando: false, error: mensajeDeError(error) })
      },
    )

    return () => {
      vivo = false
      desuscribir()
    }
  }, [])

  return estado
}

function mensajeDeError(error: Error): string {
  // Firebase devuelve admin-restricted-operation cuando el proveedor anónimo
  // existe pero está apagado, y operation-not-allowed en otras variantes. Los
  // dos significan lo mismo para quien está configurando el proyecto.
  if (
    error.message.includes('auth/admin-restricted-operation') ||
    error.message.includes('auth/operation-not-allowed')
  ) {
    return (
      'Falta habilitar el acceso anónimo en Firebase: ' +
      'Authentication > Método de acceso > Anónimo > Habilitar.'
    )
  }
  if (error.message.includes('auth/configuration-not-found')) {
    return 'El proyecto de Firebase no tiene Authentication inicializado. Revisá el README.'
  }
  if (error.message.includes('auth/unauthorized-domain')) {
    return (
      'Este dominio no está autorizado en Firebase: ' +
      'Authentication > Settings > Dominios autorizados.'
    )
  }
  if (error.message.includes('auth/network-request-failed')) {
    return 'No pude conectarme a Firebase. ¿Estás sin internet?'
  }
  return `No pude iniciar sesión: ${error.message}`
}
