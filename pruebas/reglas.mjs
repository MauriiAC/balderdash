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
import { connectDatabaseEmulator, getDatabase, ref, get, set, update } from 'firebase/database'

const cfg = { apiKey: 'demo', projectId: 'demo-balderdash', databaseURL: 'https://demo-balderdash-default-rtdb.firebaseio.com' }

function cliente(nombre) {
  const app = initializeApp(cfg, nombre)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const db = getDatabase(app)
  connectDatabaseEmulator(db, '127.0.0.1', 9000)
  return { auth, db }
}

let ok = 0, mal = 0
async function debeFallar(desc, fn) {
  try { await fn(); console.log(`  ✗ ${desc} — PASÓ y no debía`); mal++ }
  catch { console.log(`  ✓ ${desc} — rechazado`); ok++ }
}
async function debeAndar(desc, fn) {
  try { await fn(); console.log(`  ✓ ${desc}`); ok++ }
  catch (e) { console.log(`  ✗ ${desc} — falló: ${e.message}`); mal++ }
}

const A = cliente('a'), B = cliente('b'), anon = cliente('anon')
const uidA = (await signInAnonymously(A.auth)).user.uid
const uidB = (await signInAnonymously(B.auth)).user.uid
const P = 'salas/TEST/publico'

console.log('\nHost (A) arma la sala')
await debeAndar('A crea la sala', () => update(ref(A.db, P), {
  host: uidA, creadaEn: Date.now(), estado: 'lobby',
  'config/rondas': 8, [`jugadores/${uidA}/nombre`]: 'Mauri', [`jugadores/${uidA}/conectado`]: true,
}))
await debeAndar('B entra como jugador', () => update(ref(B.db, `${P}/jugadores/${uidB}`), { nombre: 'Sofi', conectado: true }))

console.log('\nLo que un jugador común NO puede hacer')
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

console.log('\nLo que sí puede')
await debeAndar('B se cambia su propio nombre', () => set(ref(B.db, `${P}/jugadores/${uidB}/nombre`), 'Sofía'))
await debeAndar('B lee la sala', () => get(ref(B.db, P)))
await debeAndar('A (host) cambia rondas', () => set(ref(A.db, `${P}/config/rondas`), 5))

console.log('\nSin autenticar')
await debeFallar('anónimo sin login lee la sala', () => get(ref(anon.db, P)))
await debeFallar('anónimo sin login lee el nodo raíz de la sala', () => get(ref(anon.db, 'salas/TEST')))

console.log(`\n${ok} ok, ${mal} mal`)
process.exit(mal === 0 ? 0 : 1)
