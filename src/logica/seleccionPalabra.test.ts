import { describe, it, expect } from 'vitest'
import { elegirPalabraId } from './seleccionPalabra'

const PALABRAS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('elegirPalabraId', () => {
  it('elige una palabra cuando no hay ninguna usada', () => {
    expect(['a', 'b', 'c']).toContain(elegirPalabraId(PALABRAS, {}, () => 0.5))
  })

  it('nunca elige una palabra ya usada', () => {
    const usadas = { a: true, b: true } as const
    for (let i = 0; i < 50; i++) {
      expect(elegirPalabraId(PALABRAS, usadas, Math.random)).toBe('c')
    }
  })

  it('devuelve null cuando se acabaron las palabras', () => {
    expect(elegirPalabraId(PALABRAS, { a: true, b: true, c: true }, Math.random)).toBe(null)
  })

  it('devuelve null si la lista viene vacía', () => {
    expect(elegirPalabraId([], {}, Math.random)).toBe(null)
  })

  it('no se pasa de rango con un random que devuelve casi 1', () => {
    expect(elegirPalabraId(PALABRAS, {}, () => 0.999999)).toBe('c')
  })

  it('usa todas las palabras disponibles a lo largo de muchas tiradas', () => {
    const vistas = new Set(
      Array.from({ length: 200 }, () => elegirPalabraId(PALABRAS, {}, Math.random)),
    )
    expect(vistas).toEqual(new Set(['a', 'b', 'c']))
  })
})
