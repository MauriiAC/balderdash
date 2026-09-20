import { onValue, ref } from 'firebase/database'
import { useEffect, useState } from 'react'
import { db } from '../firebase'

export interface EstadoPrivado {
  /** Lo que escribí esta ronda, para poder mostrarlo y editarlo tras un reload. */
  miTexto: string | null
  /** A qué opción voté. */
  miVoto: string | null
  /** Cuál de las opciones del pool es la mía, para no poder votarme. */
  miOpcionId: string | null
}

const VACIO: EstadoPrivado = { miTexto: null, miVoto: null, miOpcionId: null }

/**
 * Las tres ramas privadas van con un listener cada una: no se pueden leer de
 * un saque porque `privado` entero no es legible (cada jugador solo ve lo suyo).
 */
export function usePrivado(codigo: string | null, uid: string | null): EstadoPrivado {
  const [estado, setEstado] = useState<EstadoPrivado>(VACIO)

  useEffect(() => {
    if (!codigo || !uid) {
      setEstado(VACIO)
      return
    }

    const base = `salas/${codigo}/privado`
    const campos = [
      ['miTexto', `${base}/definiciones/${uid}/texto`],
      ['miVoto', `${base}/votos/${uid}/opcionId`],
      ['miOpcionId', `${base}/mias/${uid}`],
    ] as const

    const desuscriptores = campos.map(([campo, ruta]) =>
      onValue(
        ref(db, ruta),
        (snap) => {
          setEstado((previo) => ({ ...previo, [campo]: (snap.val() as string | null) ?? null }))
        },
        // Sin este callback el rechazo queda como promesa sin atrapar en la
        // consola. Pasa, por ejemplo, si la sala se borra mientras jugamos.
        (error) => {
          console.debug(`no pude leer ${ruta}:`, error.message)
          setEstado((previo) => ({ ...previo, [campo]: null }))
        },
      ),
    )

    return () => desuscriptores.forEach((d) => d())
  }, [codigo, uid])

  return estado
}
