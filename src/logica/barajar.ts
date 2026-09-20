/**
 * Barajado determinístico: cada jugador ve las definiciones en un orden
 * distinto, pero siempre el mismo para él.
 *
 * Si se usara Math.random, al recargar la página las opciones se reordenarían
 * y el jugador tendría que volver a leerlas todas para encontrar la que estaba
 * por votar.
 */

/** FNV-1a: alcanza y sobra para sembrar un PRNG de juguete. */
function hash(texto: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: PRNG chiquito, rápido y con buena distribución. */
function prng(semilla: number): () => number {
  let estado = semilla
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function barajarConSemilla<T>(items: readonly T[], semilla: string): T[] {
  const salida = [...items]
  const siguiente = prng(hash(semilla))

  // Fisher-Yates
  for (let i = salida.length - 1; i > 0; i--) {
    const j = Math.floor(siguiente() * (i + 1))
    ;[salida[i], salida[j]] = [salida[j] as T, salida[i] as T]
  }

  return salida
}
