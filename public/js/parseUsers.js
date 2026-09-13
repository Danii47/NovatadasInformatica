/* global document */

/**
 * Convierte el texto pegado en el importador en filas de usuario.
 *
 * Acepta una línea por usuario con cualquiera de estos separadores: punto y
 * coma, coma o tabulador (lo que sale al copiar de Excel o Google Sheets).
 *
 *   Ana Pérez;ana@uni.es
 *   Ana Pérez,ana@uni.es,admin
 *   Ana Pérez<TAB>ana@uni.es
 *   ana@uni.es                  → el nombre se deduce del correo
 *
 * La cabecera se detecta y se descarta. Nunca lanza: cada fila problemática
 * vuelve marcada con `error` para poder pintarla en la previsualización.
 *
 * @returns {Array<{ line: number, name: string, email: string, isAdmin: boolean, error: string|null }>}
 */
// eslint-disable-next-line no-unused-vars
function parseUserList (text) {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  return String(text ?? '')
    .split(/\r?\n/)
    .map((raw, index) => ({ raw: raw.trim(), line: index + 1 }))
    .filter(({ raw }) => raw.length > 0)
    .map(({ raw, line }) => {
      const columns = raw.split(/[;,\t]/).map((column) => column.trim()).filter(Boolean)

      // El correo puede venir en cualquier columna; lo buscamos por su forma.
      const emailIndex = columns.findIndex((column) => EMAIL_RE.test(column.toLowerCase()))
      const email = emailIndex >= 0 ? columns[emailIndex].toLowerCase() : ''

      const rest = columns.filter((_, index) => index !== emailIndex)
      const isAdmin = rest.some((column) => /^(admin|administrador|veterano)$/i.test(column))

      const nameCandidate = rest.find((column) => !/^(admin|administrador|veterano|novato|user|usuario)$/i.test(column))
      const name = nameCandidate || deriveNameFromEmail(email)

      let error = null
      if (!email) error = 'Sin correo válido'
      else if (!name || name.length < 2) error = 'Sin nombre'

      return { line, name, email, isAdmin, error }
    })
    .filter((row, index, rows) => {
      // Cabecera: primera fila sin correo válido que menciona las columnas.
      if (index !== 0) return true
      const looksLikeHeader = !row.email && /nombre|name|correo|email/i.test(rows[0].name || '')
      return !looksLikeHeader
    })
}

/** «ana.perez@uni.es» → «Ana Perez» */
function deriveNameFromEmail (email) {
  if (!email) return ''

  return email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, '')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Descarga un texto como fichero desde el propio navegador. */
// eslint-disable-next-line no-unused-vars
function downloadText (filename, content, type = 'text/csv;charset=utf-8') {
  // Excel abre el CSV como UTF-8 solo si empieza por BOM; sin él se rompen las tildes.
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + content], { type })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(url)
}

/** Escapa un valor para meterlo en una celda CSV. */
// eslint-disable-next-line no-unused-vars
function csvCell (value) {
  const text = String(value ?? '')
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
