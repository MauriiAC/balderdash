import { describe, it, expect } from 'vitest'
import { normalizarDefinicion } from './normalizar'

describe('normalizarDefinicion', () => {
  it('recorta los espacios de los bordes', () => {
    expect(normalizarDefinicion('  hola  ')).toBe('Hola')
  })

  it('colapsa los espacios internos, incluidos saltos de línea', () => {
    expect(normalizarDefinicion('hola   mundo')).toBe('Hola mundo')
    expect(normalizarDefinicion('hola\n\nmundo\tque tal')).toBe('Hola mundo que tal')
  })

  it('pone la primera letra en mayúscula', () => {
    expect(normalizarDefinicion('el barro del pantalón')).toBe('El barro del pantalón')
  })

  it('no toca el resto de la frase', () => {
    expect(normalizarDefinicion('un gesto de Juan')).toBe('Un gesto de Juan')
  })

  it('baja el grito de los que escriben todo en mayúsculas', () => {
    expect(normalizarDefinicion('EL BARRO DEL PANTALON')).toBe('El barro del pantalon')
    expect(normalizarDefinicion('ÁRBOL GRANDE')).toBe('Árbol grande')
  })

  it('no confunde una sigla suelta con un grito', () => {
    expect(normalizarDefinicion('un pase de la NASA')).toBe('Un pase de la NASA')
  })

  it('saca el punto final', () => {
    expect(normalizarDefinicion('una mueca.')).toBe('Una mueca')
    expect(normalizarDefinicion('una mueca...')).toBe('Una mueca')
    expect(normalizarDefinicion('una mueca . ')).toBe('Una mueca')
  })

  it('conserva los signos que cambian el sentido', () => {
    expect(normalizarDefinicion('una mueca?')).toBe('Una mueca?')
    expect(normalizarDefinicion('una mueca!')).toBe('Una mueca!')
  })

  it('capitaliza la primera letra, no el signo de apertura', () => {
    expect(normalizarDefinicion('¿una mueca?')).toBe('¿Una mueca?')
    expect(normalizarDefinicion('¡qué mueca!')).toBe('¡Qué mueca!')
  })

  it('deja igual algo que ya está normalizado', () => {
    const ya = 'El barro que se te pega en el pantalón'
    expect(normalizarDefinicion(ya)).toBe(ya)
  })

  it('es idempotente', () => {
    const entradas = ['  HOLA   MUNDO. ', '¿y esto?', 'algo...', 'NASA y otros']
    for (const e of entradas) {
      expect(normalizarDefinicion(normalizarDefinicion(e))).toBe(normalizarDefinicion(e))
    }
  })

  it('aguanta texto vacío o solo espacios', () => {
    expect(normalizarDefinicion('')).toBe('')
    expect(normalizarDefinicion('   ')).toBe('')
    expect(normalizarDefinicion('...')).toBe('')
  })
})
