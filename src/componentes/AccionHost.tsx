import { useAccion } from '../hooks/useAccion'

interface Props {
  etiqueta: string
  accion: () => Promise<void>
  deshabilitado?: boolean
  nota?: string | null
}

/** Botón de avanzar de fase, con su propio estado de ocupado y de error. */
export function AccionHost({ etiqueta, accion, deshabilitado, nota }: Props) {
  const { ocupado, error, ejecutar } = useAccion()

  return (
    <section className="bloque">
      <button
        className="primario"
        disabled={deshabilitado || ocupado}
        onClick={() => ejecutar(accion)}
      >
        {ocupado ? 'Un segundo…' : etiqueta}
      </button>
      {nota && <p className="atenuado chico">{nota}</p>}
      {error && <p className="error chico">{error}</p>}
    </section>
  )
}
