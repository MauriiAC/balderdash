import { get, ref, update } from 'firebase/database'
import { PALABRAS } from '../data/palabras'
import { db } from '../firebase'
import { normalizarDefinicion } from '../logica/normalizar'
import { elegirPalabraId } from '../logica/seleccionPalabra'
import { AUTOR_REAL } from '../tipos'
import type { Opcion, RondaHistorial, SalaPublica } from '../tipos'

export const LARGO_MAX_DEFINICION = 300

/** Id opaco: no tiene que dejar adivinar de quién es la definición. */
function nuevoOpcionId(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function buscarPalabra(palabraId: string) {
  const palabra = PALABRAS.find((p) => p.id === palabraId)
  if (!palabra) {
    throw new Error(
      `La palabra "${palabraId}" ya no está en la lista. ` +
        'Si la borraste de palabras.ts, esta partida no se puede seguir.',
    )
  }
  return palabra
}

function armarRonda(numero: number, usadas: Record<string, true>) {
  const palabraId = elegirPalabraId(PALABRAS, usadas)
  if (!palabraId) return null
  return {
    numero,
    fase: 'escribiendo' as const,
    palabraId,
    palabra: buscarPalabra(palabraId).palabra,
  }
}

// ─── Acciones del host ───────────────────────────────────────────────────────

export async function empezarPartida(codigo: string, sala: SalaPublica): Promise<void> {
  const ronda = armarRonda(1, sala.usadas ?? {})
  if (!ronda) throw new Error('No hay palabras cargadas para jugar.')

  await update(ref(db, `salas/${codigo}/publico`), {
    estado: 'jugando',
    [`usadas/${ronda.palabraId}`]: true,
    ronda,
  })
}

/**
 * escribiendo → votando. Acá se arma el pool anónimo: se normalizan todos los
 * textos juntos (incluida la definición real) y cada uno recibe un id opaco.
 * El mapa id→autor va a `secreto`, y a cada jugador se le deja en `privado/mias`
 * cuál es la suya para poder bloquearle el autovoto.
 */
export async function abrirVotacion(codigo: string, sala: SalaPublica): Promise<void> {
  const ronda = sala.ronda
  if (!ronda) throw new Error('No hay ronda en curso.')

  const snap = await get(ref(db, `salas/${codigo}/privado/definiciones`))
  const definiciones = (snap.val() ?? {}) as Record<string, { texto?: string }>

  const opciones: Record<string, Opcion> = {}
  const autores: Record<string, string> = {}
  const mias: Record<string, string> = {}

  const idReal = nuevoOpcionId()
  opciones[idReal] = { texto: normalizarDefinicion(buscarPalabra(ronda.palabraId).definicion) }
  autores[idReal] = AUTOR_REAL

  for (const [uid, definicion] of Object.entries(definiciones)) {
    const texto = normalizarDefinicion(definicion.texto ?? '')
    if (texto === '') continue
    const id = nuevoOpcionId()
    opciones[id] = { texto }
    autores[id] = uid
    mias[uid] = id
  }

  await update(ref(db, `salas/${codigo}`), {
    'publico/ronda/opciones': opciones,
    'publico/ronda/fase': 'votando',
    'privado/mias': mias,
    'secreto/autores': autores,
  })
}

/**
 * votando → revelando. Se congela todo lo necesario para mostrar el resultado
 * y para calcular el puntaje en `historial/{numero}`, que es público: a partir
 * de acá ya no hay nada que esconder.
 */
export async function revelar(codigo: string, sala: SalaPublica): Promise<void> {
  const ronda = sala.ronda
  if (!ronda) throw new Error('No hay ronda en curso.')

  const [autoresSnap, votosSnap] = await Promise.all([
    get(ref(db, `salas/${codigo}/secreto/autores`)),
    get(ref(db, `salas/${codigo}/privado/votos`)),
  ])

  const autores = (autoresSnap.val() ?? {}) as Record<string, string>
  const votosCrudos = (votosSnap.val() ?? {}) as Record<string, { opcionId?: string }>

  const opciones: RondaHistorial['opciones'] = {}
  for (const [id, opcion] of Object.entries(ronda.opciones ?? {})) {
    const autor = autores[id]
    if (!autor) {
      throw new Error(`Quedó una opción sin autor (${id}). No puedo revelar la ronda.`)
    }
    opciones[id] = { texto: opcion.texto, autor }
  }

  const votos: Record<string, string> = {}
  for (const [uid, voto] of Object.entries(votosCrudos)) {
    if (voto.opcionId) votos[uid] = voto.opcionId
  }

  const entrada: RondaHistorial = {
    palabraId: ronda.palabraId,
    palabra: ronda.palabra,
    opciones,
    votos,
  }

  await update(ref(db, `salas/${codigo}`), {
    [`publico/historial/${ronda.numero}`]: entrada,
    'publico/ronda/fase': 'revelando',
  })
}

/**
 * revelando → la que sigue, o fin de la partida. Se limpian `privado` y
 * `secreto`: lo que importaba de esa ronda ya quedó en el historial.
 */
export async function siguienteRonda(codigo: string, sala: SalaPublica): Promise<void> {
  const ronda = sala.ronda
  if (!ronda) throw new Error('No hay ronda en curso.')

  const esUltima = ronda.numero >= sala.config.rondas
  const proxima = esUltima ? null : armarRonda(ronda.numero + 1, sala.usadas ?? {})

  if (!proxima) {
    await update(ref(db, `salas/${codigo}`), {
      'publico/estado': 'terminado',
      'publico/ronda': null,
      privado: null,
      secreto: null,
    })
    return
  }

  await update(ref(db, `salas/${codigo}`), {
    [`publico/usadas/${proxima.palabraId}`]: true,
    'publico/ronda': proxima,
    privado: null,
    secreto: null,
  })
}

// ─── Acciones de cualquier jugador ───────────────────────────────────────────

/** La definición y el "ya entregué" van juntos: nunca uno sin el otro. */
export async function guardarDefinicion(
  codigo: string,
  uid: string,
  texto: string,
): Promise<void> {
  await update(ref(db, `salas/${codigo}`), {
    [`privado/definiciones/${uid}/texto`]: texto.trim().slice(0, LARGO_MAX_DEFINICION),
    [`publico/ronda/entregaron/${uid}`]: true,
  })
}

export async function votar(codigo: string, uid: string, opcionId: string): Promise<void> {
  await update(ref(db, `salas/${codigo}`), {
    [`privado/votos/${uid}/opcionId`]: opcionId,
    [`publico/ronda/votaron/${uid}`]: true,
  })
}
