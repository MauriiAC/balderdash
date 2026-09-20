/**
 * Empareja el estilo de tipeo de todas las definiciones antes de mostrarlas.
 *
 * Sin esto la definición real canta sola: está bien escrita, con mayúscula y
 * punto final, mientras las inventadas vienen apuradas desde el celular. Se
 * aplica a todas por igual, incluida la verdadera.
 */

/** Un grito es texto con letras y ninguna minúscula. "NASA" suelto no cuenta. */
function esTodoMayusculas(texto: string): boolean {
  const letras = texto.match(/\p{L}/gu)
  if (!letras || letras.length === 0) return false
  return texto === texto.toUpperCase() && texto !== texto.toLowerCase()
}

export function normalizarDefinicion(texto: string): string {
  let limpio = texto.trim().replace(/\s+/gu, ' ')
  if (limpio === '') return ''

  if (esTodoMayusculas(limpio)) limpio = limpio.toLowerCase()

  // Solo puntos: un "?" o un "!" cambian el sentido de la frase y se quedan.
  limpio = limpio.replace(/[\s.]+$/u, '')
  if (limpio === '') return ''

  // La mayúscula va en la primera letra, no en un "¿" o un "¡" de apertura.
  return limpio.replace(/\p{L}/u, (letra) => letra.toUpperCase())
}
