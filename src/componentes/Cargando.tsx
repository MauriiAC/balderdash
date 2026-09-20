export function Cargando({ mensaje }: { mensaje: string }) {
  return (
    <div className="centrado">
      <div className="spinner" aria-hidden="true" />
      <p className="atenuado">{mensaje}</p>
    </div>
  )
}
