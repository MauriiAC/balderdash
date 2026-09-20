import { AUTOR_REAL } from '../tipos'
import type { RondaHistorial } from '../tipos'

/**
 * El puntaje no se guarda en ningún lado: se deriva del historial cada vez.
 *
 * Así ningún cliente puede escribirlo (la regla de `puntaje` es
 * `.validate: false`) y la reconexión no tiene nada que recuperar — al volver,
 * la cuenta se rehace sola.
 */

export interface FilaTabla {
  uid: string
  puntos: number
  /** Veces que votó la definición verdadera. */
  aciertos: number
  /** Votos que se llevaron sus definiciones inventadas. */
  votosRecibidos: number
  /** Los empatados comparten número y la siguiente posición se saltea. */
  posicion: number
}

const PUNTOS_POR_ACIERTO = 2
const PUNTOS_POR_ENGAÑADO = 1

export function calcularTabla(
  historial: Record<string, RondaHistorial> | undefined,
  uidsDeLaSala: readonly string[],
): FilaTabla[] {
  const acumulado = new Map<string, { puntos: number; aciertos: number; votosRecibidos: number }>()

  const fila = (uid: string) => {
    let existente = acumulado.get(uid)
    if (!existente) {
      existente = { puntos: 0, aciertos: 0, votosRecibidos: 0 }
      acumulado.set(uid, existente)
    }
    return existente
  }

  uidsDeLaSala.forEach(fila)

  for (const ronda of Object.values(historial ?? {})) {
    const opciones = ronda.opciones ?? {}

    // Quien jugó una ronda figura en la tabla aunque después se haya ido.
    for (const opcion of Object.values(opciones)) {
      if (opcion.autor !== AUTOR_REAL) fila(opcion.autor)
    }

    for (const [votante, opcionId] of Object.entries(ronda.votos ?? {})) {
      fila(votante)
      const opcion = opciones[opcionId]
      if (!opcion) continue

      if (opcion.autor === AUTOR_REAL) {
        const suya = fila(votante)
        suya.puntos += PUNTOS_POR_ACIERTO
        suya.aciertos += 1
      } else if (opcion.autor !== votante) {
        // El autovoto lo bloquean las reglas; si igual llegara, no suma.
        const delAutor = fila(opcion.autor)
        delAutor.puntos += PUNTOS_POR_ENGAÑADO
        delAutor.votosRecibidos += 1
      }
    }
  }

  const ordenadas = [...acumulado.entries()]
    .map(([uid, datos]) => ({ uid, ...datos }))
    .sort(
      (a, b) =>
        b.puntos - a.puntos ||
        b.aciertos - a.aciertos ||
        // Último criterio para que el orden no dependa del recorrido del Map.
        a.uid.localeCompare(b.uid),
    )

  let posicion = 0
  let anterior: { puntos: number; aciertos: number } | null = null

  return ordenadas.map((datos, indice) => {
    const empata =
      anterior !== null &&
      anterior.puntos === datos.puntos &&
      anterior.aciertos === datos.aciertos
    if (!empata) posicion = indice + 1
    anterior = datos
    return { ...datos, posicion }
  })
}
