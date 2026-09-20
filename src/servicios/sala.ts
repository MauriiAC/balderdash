import {
  get,
  onDisconnect,
  onValue,
  ref,
  remove,
  set,
  serverTimestamp,
  update,
} from 'firebase/database'
import { db } from '../firebase'
import { generarCodigo } from '../logica/codigoSala'
import type { SalaPublica } from '../tipos'

/** Si chocan 10 códigos al hilo, algo anda muy mal y es mejor fallar fuerte. */
const INTENTOS_CODIGO = 10

export const LARGO_MAX_NOMBRE = 20

export function rutaPublico(codigo: string, sub = ''): string {
  return `salas/${codigo}/publico${sub ? `/${sub}` : ''}`
}

export async function existeSala(codigo: string): Promise<boolean> {
  const snap = await get(ref(db, rutaPublico(codigo, 'host')))
  return snap.exists()
}

export async function crearSala(opciones: {
  uid: string
  nombre: string
  rondas: number
}): Promise<string> {
  const { uid, nombre, rondas } = opciones

  for (let intento = 0; intento < INTENTOS_CODIGO; intento++) {
    const codigo = generarCodigo()
    if (await existeSala(codigo)) continue

    await update(ref(db, rutaPublico(codigo)), {
      host: uid,
      creadaEn: serverTimestamp(),
      estado: 'lobby',
      'config/rondas': rondas,
      [`jugadores/${uid}/nombre`]: nombre,
      [`jugadores/${uid}/conectado`]: true,
    })
    return codigo
  }

  throw new Error('No pude generar un código libre. Probá de nuevo.')
}

export async function unirseASala(opciones: {
  codigo: string
  uid: string
  nombre: string
}): Promise<void> {
  const { codigo, uid, nombre } = opciones

  const [hostSnap, estadoSnap, yoSnap] = await Promise.all([
    get(ref(db, rutaPublico(codigo, 'host'))),
    get(ref(db, rutaPublico(codigo, 'estado'))),
    get(ref(db, rutaPublico(codigo, `jugadores/${uid}`))),
  ])

  if (!hostSnap.exists()) {
    throw new Error(`No existe ninguna sala con el código ${codigo}.`)
  }
  // Volver a entrar a una partida en curso sí se permite: es la reconexión.
  if (!yoSnap.exists() && estadoSnap.val() !== 'lobby') {
    throw new Error('Esa partida ya empezó. Pediles que armen una nueva.')
  }

  await update(ref(db, rutaPublico(codigo, `jugadores/${uid}`)), {
    nombre,
    conectado: true,
  })
}

export async function salirDeSala(codigo: string, uid: string): Promise<void> {
  await remove(ref(db, rutaPublico(codigo, `jugadores/${uid}`)))
}

export function suscribirSala(
  codigo: string,
  alCambiar: (sala: SalaPublica | null) => void,
  alFallar: (error: Error) => void,
): () => void {
  return onValue(
    ref(db, rutaPublico(codigo)),
    (snap) => alCambiar(snap.exists() ? (snap.val() as SalaPublica) : null),
    alFallar,
  )
}

/**
 * Marca al jugador conectado y programa en el servidor la baja para cuando se
 * corte la conexión. Se recuelga en cada reconexión porque el onDisconnect se
 * consume al dispararse.
 */
export function mantenerPresencia(codigo: string, uid: string): () => void {
  const refConectado = ref(db, rutaPublico(codigo, `jugadores/${uid}/conectado`))

  const desuscribir = onValue(ref(db, '.info/connected'), (snap) => {
    if (snap.val() !== true) return
    // Primero se registra la baja y recién después se marca conectado: si el
    // navegador muere en el medio, no queda un `true` colgado para siempre.
    //
    // El catch no es decorativo: si la sala se borró mientras estábamos
    // adentro, las reglas rechazan escribir `conectado` en un jugador que ya
    // no existe. Es esperable y no rompe nada; la app se entera por el
    // listener de la sala.
    onDisconnect(refConectado)
      .set(false)
      .then(() => set(refConectado, true))
      .catch(ignorarSiLaSalaSeFue)
  })

  // No se escribe `false` al desmontar: el socket sigue vivo, el jugador sigue
  // conectado. La baja la hace el servidor vía onDisconnect, o `salirDeSala`.
  return () => {
    desuscribir()
    onDisconnect(refConectado).cancel().catch(ignorarSiLaSalaSeFue)
  }
}

/** Solo el host puede tocar la config; las reglas lo rechazan para el resto. */
export async function actualizarRondas(codigo: string, rondas: number): Promise<void> {
  await update(ref(db, rutaPublico(codigo, 'config')), { rondas })
}

/**
 * Los fallos de presencia no son fatales: la sala pudo borrarse o el jugador
 * pudo salir mientras había una escritura en vuelo. Se registran y se siguen.
 */
function ignorarSiLaSalaSeFue(error: Error): void {
  console.debug('presencia:', error.message)
}
