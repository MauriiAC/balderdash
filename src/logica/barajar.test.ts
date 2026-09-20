import { describe, it, expect } from 'vitest'
import { barajarConSemilla } from './barajar'

const ITEMS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

describe('barajarConSemilla', () => {
  it('con la misma semilla devuelve siempre el mismo orden', () => {
    const uno = barajarConSemilla(ITEMS, 'uid-1:cazcarria')
    const dos = barajarConSemilla(ITEMS, 'uid-1:cazcarria')
    expect(uno).toEqual(dos)
  })

  it('con semillas distintas devuelve órdenes distintos', () => {
    const uno = barajarConSemilla(ITEMS, 'uid-1:cazcarria')
    const dos = barajarConSemilla(ITEMS, 'uid-2:cazcarria')
    expect(uno).not.toEqual(dos)
  })

  it('cambia de orden entre rondas para el mismo jugador', () => {
    const uno = barajarConSemilla(ITEMS, 'uid-1:cazcarria')
    const dos = barajarConSemilla(ITEMS, 'uid-1:jeribeque')
    expect(uno).not.toEqual(dos)
  })

  it('no pierde ni inventa elementos', () => {
    const salida = barajarConSemilla(ITEMS, 'cualquiera')
    expect([...salida].sort()).toEqual([...ITEMS].sort())
  })

  it('no muta el array original', () => {
    const original = [...ITEMS]
    barajarConSemilla(ITEMS, 'cualquiera')
    expect(ITEMS).toEqual(original)
  })

  it('efectivamente mezcla: no devuelve el orden de entrada', () => {
    const salida = barajarConSemilla(ITEMS, 'uid-1:cazcarria')
    expect(salida).not.toEqual(ITEMS)
  })

  it('aguanta listas vacías o de un solo elemento', () => {
    expect(barajarConSemilla([], 'x')).toEqual([])
    expect(barajarConSemilla(['solo'], 'x')).toEqual(['solo'])
  })

  it('reparte las posiciones de forma pareja entre semillas', () => {
    // Con 500 semillas distintas, cada elemento tiene que caer primero
    // alguna vez. Si el hash fuera malo, uno se clavaría siempre al frente.
    const primeros = new Set(
      Array.from({ length: 500 }, (_, i) => barajarConSemilla(ITEMS, `uid-${i}`)[0]),
    )
    expect(primeros.size).toBe(ITEMS.length)
  })
})
