import type { Palabra } from '../tipos'

/**
 * Palabras raras en español con su definición real, escrita en lenguaje llano
 * para que se confunda con las inventadas por los jugadores.
 *
 * Para ampliar la lista: agregá objetos acá. El `id` tiene que ser único y no
 * conviene cambiarlo después (queda guardado en el historial de las partidas).
 *
 * Ojo: estas definiciones viajan en el bundle. Cualquier jugador puede abrir
 * DevTools y leerlas. Es un juego entre amigos, no hay forma de evitarlo sin
 * un backend.
 */
export const PALABRAS: Palabra[] = [
  {
    id: 'cazcarria',
    palabra: 'cazcarria',
    definicion: 'el barro que se te pega en el borde de abajo del pantalón',
  },
  {
    id: 'jeribeque',
    palabra: 'jeribeque',
    definicion: 'una mueca o gesto exagerado con la cara',
  },
  {
    id: 'estafermo',
    palabra: 'estafermo',
    definicion: 'alguien que se queda parado y embobado sin hacer nada',
  },
  {
    id: 'guirigay',
    palabra: 'guirigay',
    definicion: 'un griterío desordenado donde no se entiende nada',
  },
  {
    id: 'carantona',
    palabra: 'carantoña',
    definicion: 'un mimo hecho a propósito para conseguir algo',
  },
  {
    id: 'gaznapiro',
    palabra: 'gaznápiro',
    definicion: 'una persona torpe y medio tonta',
  },
  {
    id: 'zurrapa',
    palabra: 'zurrapa',
    definicion: 'la borra o el sedimento que queda en el fondo de un líquido',
  },
  {
    id: 'tolondro',
    palabra: 'tolondro',
    definicion: 'el chichón que te queda después de un golpe en la cabeza',
  },
  {
    id: 'escolimoso',
    palabra: 'escolimoso',
    definicion: 'alguien difícil de contentar, que se queja de todo',
  },
  {
    id: 'chafallo',
    palabra: 'chafallo',
    definicion: 'un remiendo hecho mal y a las apuradas',
  },
]

export const TOTAL_PALABRAS = PALABRAS.length
