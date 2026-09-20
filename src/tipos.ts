/**
 * Modelo de datos de la Realtime Database.
 *
 * salas/{codigo}
 *   publico/   → lo lee cualquier jugador autenticado (un solo listener)
 *   privado/   → definiciones, votos y "cuál es la mía": solo su dueño y el host
 *   secreto/   → el mapa opcionId→autor: legible recién en fase "revelando"
 */

export type EstadoSala = 'lobby' | 'jugando' | 'terminado'
export type FaseRonda = 'escribiendo' | 'votando' | 'revelando'

/** Autor de una opción: el uid del jugador, o REAL si es la definición verdadera. */
export const AUTOR_REAL = 'REAL'

export interface Jugador {
  nombre: string
  conectado: boolean
}

export interface ConfigSala {
  rondas: number
}

export interface Opcion {
  texto: string
}

export interface Ronda {
  numero: number
  fase: FaseRonda
  palabraId: string
  palabra: string
  /** Pool anónimo y barajado. Aparece al pasar a "votando". */
  opciones?: Record<string, Opcion>
  entregaron?: Record<string, true>
  votaron?: Record<string, true>
}

export interface RondaHistorial {
  palabraId: string
  palabra: string
  opciones: Record<string, { texto: string; autor: string }>
  votos?: Record<string, string>
}

export interface SalaPublica {
  host: string
  creadaEn: number
  estado: EstadoSala
  config: ConfigSala
  jugadores?: Record<string, Jugador>
  usadas?: Record<string, true>
  ronda?: Ronda
  historial?: Record<string, RondaHistorial>
}

export interface Palabra {
  id: string
  palabra: string
  definicion: string
}
