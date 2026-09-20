/**
 * Códigos de sala: 4 letras mayúsculas. Cortos para dictarlos en voz alta,
 * y 456.976 combinaciones son de sobra para un juego entre amigos.
 */

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export const LARGO_CODIGO = 4

export function generarCodigo(): string {
  const bytes = new Uint8Array(LARGO_CODIGO)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => LETRAS[b % LETRAS.length]).join('')
}

/**
 * Deja lo que el usuario tipeó en forma de código: mayúsculas, sin acentos,
 * sin nada que no sea una letra, recortado al largo exacto.
 */
export function normalizarCodigo(entrada: string): string {
  return entrada
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, LARGO_CODIGO)
}

export function esCodigoValido(codigo: string): boolean {
  return new RegExp(`^[A-Z]{${LARGO_CODIGO}}$`).test(codigo)
}
