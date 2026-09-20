import { describe, it, expect } from 'vitest'
import { calcularTabla } from './puntaje'
import type { RondaHistorial } from '../tipos'

const REAL = 'op-real'
const DE_ANA = 'op-ana'
const DE_BETO = 'op-beto'
const DE_CORA = 'op-cora'

/** Ronda con una opción por jugador más la verdadera. Los votos se pasan aparte. */
function ronda(votos: Record<string, string>): RondaHistorial {
  return {
    palabraId: 'cazcarria',
    palabra: 'cazcarria',
    opciones: {
      [REAL]: { texto: 'La de verdad', autor: 'REAL' },
      [DE_ANA]: { texto: 'La de Ana', autor: 'ana' },
      [DE_BETO]: { texto: 'La de Beto', autor: 'beto' },
      [DE_CORA]: { texto: 'La de Cora', autor: 'cora' },
    },
    votos,
  }
}

const JUGADORES = ['ana', 'beto', 'cora']

/** Atajo para leer la tabla como { uid: puntos }. */
function puntosPorUid(tabla: ReturnType<typeof calcularTabla>) {
  return Object.fromEntries(tabla.map((f) => [f.uid, f.puntos]))
}

describe('calcularTabla', () => {
  it('sin historial deja a todos en cero', () => {
    const tabla = calcularTabla(undefined, JUGADORES)
    expect(puntosPorUid(tabla)).toEqual({ ana: 0, beto: 0, cora: 0 })
  })

  it('da +2 al que votó la definición real', () => {
    const tabla = calcularTabla({ 1: ronda({ ana: REAL }) }, JUGADORES)
    expect(puntosPorUid(tabla)).toEqual({ ana: 2, beto: 0, cora: 0 })
  })

  it('da +1 al autor por cada uno que cayó en su definición', () => {
    const tabla = calcularTabla({ 1: ronda({ beto: DE_ANA, cora: DE_ANA }) }, JUGADORES)
    expect(puntosPorUid(tabla)).toEqual({ ana: 2, beto: 0, cora: 0 })
  })

  it('distingue los dos +2 de un acierto de los dos +1 de dos engañados', () => {
    const conAciertos = calcularTabla({ 1: ronda({ ana: REAL }) }, JUGADORES)
    const conEngaños = calcularTabla({ 1: ronda({ beto: DE_ANA, cora: DE_ANA }) }, JUGADORES)
    expect(conAciertos[0]!.aciertos).toBe(1)
    expect(conAciertos[0]!.votosRecibidos).toBe(0)
    expect(conEngaños[0]!.aciertos).toBe(0)
    expect(conEngaños[0]!.votosRecibidos).toBe(2)
  })

  it('no le da puntos a nadie por votar la definición real', () => {
    const tabla = calcularTabla({ 1: ronda({ ana: REAL, beto: REAL }) }, JUGADORES)
    expect(puntosPorUid(tabla)).toEqual({ ana: 2, beto: 2, cora: 0 })
  })

  it('ignora el autovoto aunque llegue en el historial', () => {
    const tabla = calcularTabla({ 1: ronda({ ana: DE_ANA }) }, JUGADORES)
    expect(puntosPorUid(tabla)).toEqual({ ana: 0, beto: 0, cora: 0 })
  })

  it('ignora votos a opciones que no existen', () => {
    const tabla = calcularTabla({ 1: ronda({ ana: 'fantasma' }) }, JUGADORES)
    expect(puntosPorUid(tabla)).toEqual({ ana: 0, beto: 0, cora: 0 })
  })

  it('acumula a lo largo de las rondas', () => {
    const tabla = calcularTabla(
      {
        1: ronda({ ana: REAL, beto: DE_ANA }),
        2: ronda({ ana: REAL, cora: DE_ANA }),
      },
      JUGADORES,
    )
    expect(puntosPorUid(tabla)).toEqual({ ana: 6, beto: 0, cora: 0 })
  })

  it('ordena de mayor a menor', () => {
    const tabla = calcularTabla(
      { 1: ronda({ ana: REAL, beto: DE_CORA, cora: DE_ANA }) },
      JUGADORES,
    )
    expect(tabla.map((f) => f.uid)).toEqual(['ana', 'cora', 'beto'])
  })

  it('desempata a favor del que acertó más veces', () => {
    // Ana: un acierto (2). Beto: dos engañados (2). Mismo puntaje.
    const tabla = calcularTabla(
      { 1: ronda({ ana: REAL, cora: DE_BETO }), 2: ronda({ cora: DE_BETO }) },
      JUGADORES,
    )
    expect(tabla[0]!.uid).toBe('ana')
    expect(tabla[0]!.puntos).toBe(tabla[1]!.puntos)
  })

  it('los empatados comparten posición y la siguiente se saltea', () => {
    const tabla = calcularTabla({ 1: ronda({ ana: REAL, beto: REAL }) }, JUGADORES)
    expect(tabla.map((f) => f.posicion)).toEqual([1, 1, 3])
  })

  it('incluye a los jugadores que no sumaron nada', () => {
    const tabla = calcularTabla({ 1: ronda({ ana: REAL }) }, JUGADORES)
    expect(tabla).toHaveLength(3)
  })

  it('no borra de la tabla a quien se fue de la sala', () => {
    // Beto ya no está en `jugadores`, pero su definición engañó a Ana.
    const tabla = calcularTabla({ 1: ronda({ ana: DE_BETO }) }, ['ana', 'cora'])
    expect(puntosPorUid(tabla)).toEqual({ beto: 1, ana: 0, cora: 0 })
  })

  it('es estable: mismo historial, mismo orden', () => {
    const h = { 1: ronda({ ana: REAL, beto: REAL, cora: REAL }) }
    expect(calcularTabla(h, JUGADORES)).toEqual(calcularTabla(h, JUGADORES))
  })

  it('aguanta una ronda sin votos', () => {
    const tabla = calcularTabla({ 1: ronda({}) }, JUGADORES)
    expect(puntosPorUid(tabla)).toEqual({ ana: 0, beto: 0, cora: 0 })
  })
})
