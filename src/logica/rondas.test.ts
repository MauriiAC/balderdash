import { describe, it, expect } from 'vitest'
import { MAX_RONDAS, opcionesDeRondas, rondasPorDefecto } from './rondas'

describe('opcionesDeRondas', () => {
  it('con pocas palabras, el tope es la cantidad de palabras', () => {
    expect(opcionesDeRondas(10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('con muchas palabras, el tope es MAX_RONDAS', () => {
    expect(opcionesDeRondas(800)).toHaveLength(MAX_RONDAS)
    expect(opcionesDeRondas(800).at(-1)).toBe(MAX_RONDAS)
  })

  it('no ofrece una partida de cero rondas', () => {
    expect(opcionesDeRondas(0)).toEqual([])
    expect(opcionesDeRondas(1)).toEqual([1])
  })

  it('arranca siempre en 1 y no saltea números', () => {
    const opciones = opcionesDeRondas(800)
    expect(opciones[0]).toBe(1)
    opciones.forEach((n, i) => expect(n).toBe(i + 1))
  })

  it('aguanta un total negativo sin romper', () => {
    expect(opcionesDeRondas(-5)).toEqual([])
  })
})

describe('rondasPorDefecto', () => {
  it('con la lista semilla de 10, propone 8', () => {
    expect(rondasPorDefecto(10)).toBe(8)
  })

  it('con una lista grande sigue proponiendo 8, no el máximo', () => {
    expect(rondasPorDefecto(800)).toBe(8)
  })

  it('con menos de 8 palabras propone todas las que hay', () => {
    expect(rondasPorDefecto(3)).toBe(3)
  })

  it('nunca propone menos de 1', () => {
    expect(rondasPorDefecto(0)).toBe(1)
  })

  it('lo que propone siempre es una opción ofrecida', () => {
    for (const total of [1, 3, 8, 10, 50, 800]) {
      expect(opcionesDeRondas(total)).toContain(rondasPorDefecto(total))
    }
  })
})

describe('MAX_RONDAS y las reglas de seguridad', () => {
  it('coinciden', async () => {
    // El tope vive en dos lados que no se pueden importar entre sí: esta
    // constante y database.rules.json. Si se desincronizan, el selector ofrece
    // una opción que la base rechaza, y el jugador ve un error sin sentido.
    const { readFileSync } = await import('node:fs')
    const reglas = readFileSync('database.rules.json', 'utf8')
    const validate: string =
      JSON.parse(reglas).rules.salas.$codigo.publico.config.rondas['.validate']

    const tope = validate.match(/newData\.val\(\) <= (\d+)/)?.[1]
    expect(tope, `no encontré el tope en: ${validate}`).toBeDefined()
    expect(Number(tope)).toBe(MAX_RONDAS)
  })
})
