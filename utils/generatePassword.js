import { randomInt } from 'node:crypto'

// Sin caracteres ambiguos (0/O, 1/l/I) para que se puedan dictar por voz.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/**
 * Contraseñas con `crypto.randomInt` en lugar de `Math.random()`, que es
 * predecible y no sirve para generar secretos.
 */
export function generatePassword (length = 10) {
  let password = ''

  for (let i = 0; i < length; i++) {
    password += ALPHABET[randomInt(ALPHABET.length)]
  }

  return password
}
