interface Props {
  numero: number
  total: number
  palabra: string
  bajada: string
}

export function CabeceraRonda({ numero, total, palabra, bajada }: Props) {
  return (
    <header className="tapa">
      <p className="atenuado chico">
        Ronda {numero} de {total}
      </p>
      <h1 className="palabra">{palabra}</h1>
      <p className="atenuado">{bajada}</p>
    </header>
  )
}
