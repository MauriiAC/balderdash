/**
 * Cuántas rondas se pueden jugar.
 *
 * Hay dos topes distintos y conviene no confundirlos:
 *
 * - La cantidad de palabras cargadas, porque una palabra no se repite dentro
 *   de la misma partida.
 * - MAX_RONDAS, que es un tope de paciencia: cada ronda son varios minutos y
 *   nadie quiere una partida de 40. Cuando la lista pasó de 10 palabras a
 *   varios cientos, atar el máximo al tamaño de la lista dejó de tener
 *   sentido: el selector pasaba a tener cientos de opciones.
 */

export const MAX_RONDAS = 15

/** Default cómodo, siempre que haya palabras de sobra. */
const RONDAS_SUGERIDAS = 8

export function opcionesDeRondas(totalPalabras: number): number[] {
  const tope = Math.min(MAX_RONDAS, Math.floor(totalPalabras))
  if (tope < 1) return []
  return Array.from({ length: tope }, (_, i) => i + 1)
}

export function rondasPorDefecto(totalPalabras: number): number {
  const opciones = opcionesDeRondas(totalPalabras)
  if (opciones.length === 0) return 1
  return Math.min(RONDAS_SUGERIDAS, opciones.at(-1)!)
}
