import { initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from 'firebase/auth'
import { connectDatabaseEmulator, getDatabase } from 'firebase/database'

const REQUERIDAS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_DATABASE_URL',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const

const faltantes = REQUERIDAS.filter((clave) => !import.meta.env[clave])
if (faltantes.length > 0) {
  throw new Error(
    `Faltan variables de entorno de Firebase: ${faltantes.join(', ')}. ` +
      'Copiá .env.example a .env y completalo (ver README).',
  )
}

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)
export const db = getDatabase(app)

/**
 * Desarrollo contra el emulador local (`npm run emulador`), para probar el juego
 * y las reglas sin tocar la base de verdad. Se activa con VITE_USAR_EMULADOR=true.
 */
export const usandoEmulador = import.meta.env.VITE_USAR_EMULADOR === 'true'
if (usandoEmulador) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectDatabaseEmulator(db, '127.0.0.1', 9000)
}

/**
 * Persistencia local para que el uid anónimo sobreviva al reload. Sin esto,
 * recargar la página te convierte en un jugador nuevo y perdés el puntaje.
 */
export const persistenciaLista = setPersistence(auth, browserLocalPersistence)
