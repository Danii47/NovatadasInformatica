// `<` y `>` podrían cerrar la etiqueta <script>; `&` evita sorpresas al
// reinterpretar entidades; U+2028 y U+2029 son saltos de línea para JavaScript
// aunque JSON los admita dentro de una cadena.
const UNSAFE = new RegExp('[<>&' + String.fromCharCode(0x2028, 0x2029) + ']', 'g')

const toUnicodeEscape = (char) => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')

/**
 * Serializa datos para incrustarlos dentro de una etiqueta <script>.
 *
 * Un nombre de usuario como `</script><img onerror=...>` no puede cerrar la
 * etiqueta ni romper el literal. El resultado sigue siendo JSON válido.
 */
export function jsonForScript (data) {
  return JSON.stringify(data).replace(UNSAFE, toUnicodeEscape)
}
