/**
 * Pruebas de las reglas de seguridad contra el emulador.
 *
 *   terminal 1:  npm run emulador
 *   terminal 2:  npm run test:reglas
 *
 * Cada caso dice si la operación TIENE que pasar o TIENE que ser rechazada.
 * Una regla nueva sin su caso acá es una regla que no sabemos si funciona.
 */
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import {
  connectDatabaseEmulator,
  get,
  getDatabase,
  ref,
  set,
  update,
} from 'firebase/database'

const cfg = {
  apiKey: 'demo',
  projectId: 'demo-balderdash',
  databaseURL: 'https://demo-balderdash-default-rtdb.firebaseio.com',
}

function cliente(nombre) {
  const app = initializeApp(cfg, nombre)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const db = getDatabase(app)
  connectDatabaseEmulator(db, '127.0.0.1', 9000)
  return { auth, db }
}

let ok = 0
let mal = 0

async function debeFallar(desc, fn) {
  try {
    await fn()
    console.log(`  ✗ ${desc} — PASÓ y no debía`)
    mal++
  } catch {
    console.log(`  ✓ ${desc} — rechazado`)
    ok++
  }
}

async function debeAndar(desc, fn) {
  try {
    await fn()
    console.log(`  ✓ ${desc}`)
    ok++
  } catch (e) {
    console.log(`  ✗ ${desc} — falló: ${e.message}`)
    mal++
  }
}

function titulo(t) {
  console.log(`\n${t}`)
}

/**
 * Base limpia en cada corrida. Sin esto las salas quedan de la vez anterior y,
 * como cada `signInAnonymously` crea un usuario nuevo, el "host" de esas salas
 * es un uid viejo: los casos del host empiezan a fallar por contaminación.
 *
 * El bearer "owner" es la cuenta de administración del emulador, que se saltea
 * las reglas. Solo existe en el emulador.
 */
const NS = 'demo-balderdash-default-rtdb'
const limpieza = await fetch(`http://127.0.0.1:9000/.json?ns=${NS}`, {
  method: 'DELETE',
  headers: { Authorization: 'Bearer owner' },
})
if (!limpieza.ok) {
  console.error(
    `\nNo pude limpiar la base del emulador (HTTP ${limpieza.status}).\n` +
      '¿Está corriendo `npm run emulador`?',
  )
  process.exit(1)
}

const A = cliente('a')
const B = cliente('b')
const C = cliente('c')
const anon = cliente('anon')
const uidA = (await signInAnonymously(A.auth)).user.uid
const uidB = (await signInAnonymously(B.auth)).user.uid
const uidC = (await signInAnonymously(C.auth)).user.uid

// ─── Sala y lobby ────────────────────────────────────────────────────────────

const S = 'salas/LOBB'
const P = `${S}/publico`

titulo('Armado de la sala')
await debeAndar('A crea la sala y queda de host', () =>
  update(ref(A.db, P), {
    host: uidA,
    creadaEn: Date.now(),
    estado: 'lobby',
    'config/rondas': 8,
    [`jugadores/${uidA}/nombre`]: 'Mauri',
    [`jugadores/${uidA}/conectado`]: true,
  }),
)
await debeAndar('B entra como jugador', () =>
  update(ref(B.db, `${P}/jugadores/${uidB}`), { nombre: 'Sofi', conectado: true }),
)

titulo('Lo que un jugador común NO puede hacer en el lobby')
await debeFallar('B cambia config/rondas', () => set(ref(B.db, `${P}/config/rondas`), 20))
await debeFallar('B cambia estado', () => set(ref(B.db, `${P}/estado`), 'jugando'))
await debeFallar('B roba el host', () => set(ref(B.db, `${P}/host`), uidB))
await debeFallar('B renombra a A', () => set(ref(B.db, `${P}/jugadores/${uidA}/nombre`), 'Tonto'))
await debeFallar('B se escribe un puntaje', () => set(ref(B.db, `${P}/jugadores/${uidB}/puntaje`), 999))
await debeFallar('B le escribe puntaje a A', () => set(ref(B.db, `${P}/jugadores/${uidA}/puntaje`), -5))
await debeFallar('B crea un jugador sin nombre', () => set(ref(B.db, `${P}/jugadores/${uidB}`), { conectado: true }))
await debeFallar('B mete un campo inventado en la sala', () => set(ref(B.db, `${P}/trampa`), true))
await debeFallar('B pone un nombre vacío', () => set(ref(B.db, `${P}/jugadores/${uidB}/nombre`), ''))
await debeFallar('B pone un estado inválido', () => set(ref(B.db, `${P}/estado`), 'cualquiera'))
await debeFallar('B marca una palabra como usada', () => set(ref(B.db, `${P}/usadas/cazcarria`), true))
await debeFallar('B antedata la sala al futuro', () =>
  set(ref(B.db, `${P}/creadaEn`), Date.now() + 86400000),
)

titulo('Lo que sí puede')
await debeAndar('B se cambia su propio nombre', () => set(ref(B.db, `${P}/jugadores/${uidB}/nombre`), 'Sofía'))
await debeAndar('B lee el estado público de la sala', () => get(ref(B.db, P)))
await debeAndar('A (host) cambia rondas', () => set(ref(A.db, `${P}/config/rondas`), 5))

titulo('Sin autenticar')
await debeFallar('anónimo sin login lee la sala', () => get(ref(anon.db, P)))
await debeFallar('anónimo sin login lee el nodo raíz de la sala', () => get(ref(anon.db, S)))

// ─── Ciclo de ronda ──────────────────────────────────────────────────────────

const R = 'salas/RNDA'
const RP = `${R}/publico`

titulo('Fase escribiendo')
await debeFallar('A intenta anotar a B en la sala', () =>
  update(ref(A.db, RP), {
    host: uidA,
    creadaEn: Date.now(),
    estado: 'lobby',
    'config/rondas': 3,
    [`jugadores/${uidA}/nombre`]: 'Mauri',
    [`jugadores/${uidB}/nombre`]: 'Sofi',
  }),
)
await debeAndar('A crea la sala', () =>
  update(ref(A.db, RP), {
    host: uidA,
    creadaEn: Date.now(),
    estado: 'lobby',
    'config/rondas': 3,
    [`jugadores/${uidA}/nombre`]: 'Mauri',
  }),
)
await debeAndar('B se anota', () => set(ref(B.db, `${RP}/jugadores/${uidB}/nombre`), 'Sofi'))
await debeAndar('A arranca la ronda 1', () =>
  update(ref(A.db, RP), {
    estado: 'jugando',
    'usadas/cazcarria': true,
    ronda: { numero: 1, fase: 'escribiendo', palabraId: 'cazcarria', palabra: 'cazcarria' },
  }),
)
await debeAndar('B entrega su definición', () =>
  update(ref(B.db, R), {
    [`privado/definiciones/${uidB}/texto`]: 'Un pájaro chico',
    [`publico/ronda/entregaron/${uidB}`]: true,
  }),
)
await debeAndar('A entrega la suya', () =>
  update(ref(A.db, R), {
    [`privado/definiciones/${uidA}/texto`]: 'Una piedra del río',
    [`publico/ronda/entregaron/${uidA}`]: true,
  }),
)
await debeFallar('B escribe la definición de A', () =>
  set(ref(B.db, `${R}/privado/definiciones/${uidA}/texto`), 'Una pavada'),
)
await debeFallar('B espía las definiciones de todos', () => get(ref(B.db, `${R}/privado/definiciones`)))
await debeFallar('B espía la definición de A', () => get(ref(B.db, `${R}/privado/definiciones/${uidA}`)))
await debeAndar('B lee la suya', () => get(ref(B.db, `${R}/privado/definiciones/${uidB}`)))
await debeAndar('A (host) lee todas para armar el pool', () => get(ref(A.db, `${R}/privado/definiciones`)))
await debeFallar('B marca que entregó otro', () => set(ref(B.db, `${RP}/ronda/entregaron/${uidA}`), true))
await debeFallar('B cambia la fase', () => set(ref(B.db, `${RP}/ronda/fase`), 'votando'))
await debeFallar('B vota antes de tiempo', () =>
  set(ref(B.db, `${R}/privado/votos/${uidB}/opcionId`), 'loquesea'),
)
await debeFallar('B entrega una definición vacía', () =>
  set(ref(B.db, `${R}/privado/definiciones/${uidB}/texto`), ''),
)
await debeFallar('B se marca como que ya votó, en plena escritura', () =>
  set(ref(B.db, `${RP}/ronda/votaron/${uidB}`), true),
)

titulo('Fase votando')
const idReal = 'aaaa0000'
const idA = 'bbbb1111'
const idB = 'cccc2222'
await debeAndar('A abre la votación con el pool anónimo', () =>
  update(ref(A.db, R), {
    'publico/ronda/opciones': {
      [idReal]: { texto: 'El barro del pantalón' },
      [idA]: { texto: 'Una piedra del río' },
      [idB]: { texto: 'Un pájaro chico' },
    },
    'publico/ronda/fase': 'votando',
    'privado/mias': { [uidA]: idA, [uidB]: idB },
    'secreto/autores': { [idReal]: 'REAL', [idA]: uidA, [idB]: uidB },
  }),
)
await debeFallar('B espía el secreto antes del reveal', () => get(ref(B.db, `${R}/secreto`)))
await debeFallar('B espía los autores antes del reveal', () => get(ref(B.db, `${R}/secreto/autores`)))
await debeAndar('A (host) lee el secreto', () => get(ref(A.db, `${R}/secreto`)))
await debeAndar('B lee cuál es su propia opción', () => get(ref(B.db, `${R}/privado/mias/${uidB}`)))
await debeFallar('B lee cuál es la opción de A', () => get(ref(B.db, `${R}/privado/mias/${uidA}`)))
await debeFallar('B vota su propia definición', () =>
  update(ref(B.db, R), {
    [`privado/votos/${uidB}/opcionId`]: idB,
    [`publico/ronda/votaron/${uidB}`]: true,
  }),
)
await debeFallar('B vota una opción que no existe', () =>
  set(ref(B.db, `${R}/privado/votos/${uidB}/opcionId`), 'inventado'),
)
await debeFallar('B entrega una definición fuera de fase', () =>
  set(ref(B.db, `${R}/privado/definiciones/${uidB}/texto`), 'Tarde'),
)
await debeFallar('B se marca como que entregó, ya en votación', () =>
  set(ref(B.db, `${RP}/ronda/entregaron/${uidB}`), true),
)
await debeAndar('B vota la definición de A', () =>
  update(ref(B.db, R), {
    [`privado/votos/${uidB}/opcionId`]: idA,
    [`publico/ronda/votaron/${uidB}`]: true,
  }),
)
await debeFallar('B cambia su voto después de votar', () =>
  set(ref(B.db, `${R}/privado/votos/${uidB}/opcionId`), idReal),
)
await debeFallar('B espía los votos de todos', () => get(ref(B.db, `${R}/privado/votos`)))
await debeAndar('A vota la definición real', () =>
  update(ref(A.db, R), {
    [`privado/votos/${uidA}/opcionId`]: idReal,
    [`publico/ronda/votaron/${uidA}`]: true,
  }),
)

titulo('Fase revelando')
await debeAndar('A escribe el historial y revela', () =>
  update(ref(A.db, R), {
    'publico/historial/1': {
      palabraId: 'cazcarria',
      palabra: 'cazcarria',
      opciones: {
        [idReal]: { texto: 'El barro del pantalón', autor: 'REAL' },
        [idA]: { texto: 'Una piedra del río', autor: uidA },
        [idB]: { texto: 'Un pájaro chico', autor: uidB },
      },
      votos: { [uidA]: idReal, [uidB]: idA },
    },
    'publico/ronda/fase': 'revelando',
  }),
)
await debeAndar('ahora sí B puede leer el secreto', () => get(ref(B.db, `${R}/secreto`)))
await debeAndar('B lee el historial', () => get(ref(B.db, `${RP}/historial`)))
await debeFallar('B se inventa una ronda en el historial', () =>
  set(ref(B.db, `${RP}/historial/2`), {
    palabraId: 'x',
    palabra: 'x',
    opciones: { z: { texto: 'y', autor: uidB } },
  }),
)
await debeFallar('B retoca el historial existente', () =>
  set(ref(B.db, `${RP}/historial/1/votos/${uidA}`), idB),
)

titulo('Limpieza entre rondas')
await debeFallar('B borra lo privado de todos', () => set(ref(B.db, `${R}/privado`), null))
await debeFallar('B borra el secreto', () => set(ref(B.db, `${R}/secreto`), null))
await debeFallar('A (host) pisa las definiciones ajenas en vez de borrarlas', () =>
  set(ref(A.db, `${R}/privado/definiciones/${uidB}/texto`), 'Plantada por el host'),
)
await debeAndar('A limpia privado y secreto y pasa a la ronda 2', () =>
  update(ref(A.db, R), {
    'publico/usadas/jeribeque': true,
    'publico/ronda': {
      numero: 2,
      fase: 'escribiendo',
      palabraId: 'jeribeque',
      palabra: 'jeribeque',
    },
    privado: null,
    secreto: null,
  }),
)

titulo('Entrar tarde a una partida ya empezada')
await debeFallar('C se cuela en la partida en curso', () =>
  update(ref(C.db, `${RP}/jugadores/${uidC}`), { nombre: 'Tercero', conectado: true }),
)
await debeAndar('B, que ya estaba, se reconecta', () =>
  set(ref(B.db, `${RP}/jugadores/${uidB}/conectado`), true),
)
await debeAndar('B se va de la sala', () => set(ref(B.db, `${RP}/jugadores/${uidB}`), null))
await debeFallar('y no puede volver hasta la próxima sala', () =>
  update(ref(B.db, `${RP}/jugadores/${uidB}`), { nombre: 'Sofi', conectado: true }),
)

console.log(`\n${ok} ok, ${mal} mal`)
process.exit(mal === 0 ? 0 : 1)
