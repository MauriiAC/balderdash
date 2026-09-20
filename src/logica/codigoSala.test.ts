import { describe, it, expect } from 'vitest'
import { generarCodigo, normalizarCodigo, esCodigoValido, LARGO_CODIGO } from './codigoSala'

describe('generarCodigo', () => {
  it('devuelve 4 letras mayúsculas', () => {
    for (let i = 0; i < 200; i++) {
      const codigo = generarCodigo()
      expect(codigo).toHaveLength(LARGO_CODIGO)
      expect(codigo).toMatch(/^[A-Z]{4}$/)
    }
  })

  it('no devuelve siempre el mismo código', () => {
    const generados = new Set(Array.from({ length: 50 }, generarCodigo))
    expect(generados.size).toBeGreaterThan(1)
  })
})

describe('normalizarCodigo', () => {
  it('pasa a mayúsculas y saca espacios', () => {
    expect(normalizarCodigo('  abcd ')).toBe('ABCD')
  })

  it('descarta lo que no sean letras', () => {
    expect(normalizarCodigo('a1b-c d')).toBe('ABCD')
  })

  it('recorta a 4 caracteres', () => {
    expect(normalizarCodigo('abcdefgh')).toBe('ABCD')
  })

  it('saca los acentos en vez de descartar la letra', () => {
    expect(normalizarCodigo('áéio')).toBe('AEIO')
  })

  it('con entrada vacía devuelve vacío', () => {
    expect(normalizarCodigo('')).toBe('')
    expect(normalizarCodigo('   ')).toBe('')
  })
})

describe('esCodigoValido', () => {
  it('acepta un código de 4 letras mayúsculas', () => {
    expect(esCodigoValido('ABCD')).toBe(true)
  })

  it('rechaza códigos cortos, largos o con basura', () => {
    expect(esCodigoValido('ABC')).toBe(false)
    expect(esCodigoValido('ABCDE')).toBe(false)
    expect(esCodigoValido('abcd')).toBe(false)
    expect(esCodigoValido('AB1D')).toBe(false)
    expect(esCodigoValido('')).toBe(false)
  })

  it('acepta todo lo que sale de generarCodigo', () => {
    for (let i = 0; i < 100; i++) expect(esCodigoValido(generarCodigo())).toBe(true)
  })
})
