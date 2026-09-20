import { useCallback, useState } from 'react'

/** Envuelve una acción asincrónica: estado de ocupado y el error a la vista. */
export function useAccion() {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ejecutar = useCallback((accion: () => Promise<void>) => {
    setOcupado(true)
    setError(null)
    void accion()
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Algo salió mal. Probá de nuevo.')
      })
      .finally(() => setOcupado(false))
  }, [])

  return { ocupado, error, ejecutar }
}
