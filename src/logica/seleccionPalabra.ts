/**
 * Elige la palabra de la próxima ronda entre las que todavía no salieron en
 * esta partida. El `random` se inyecta para poder testear la selección.
 */
export function elegirPalabraId(
  palabras: readonly { id: string }[],
  usadas: Readonly<Record<string, true>>,
  random: () => number = Math.random,
): string | null {
  const disponibles = palabras.filter((p) => !usadas[p.id])
  if (disponibles.length === 0) return null

  const indice = Math.min(
    Math.floor(random() * disponibles.length),
    disponibles.length - 1,
  )
  return disponibles[indice]!.id
}
