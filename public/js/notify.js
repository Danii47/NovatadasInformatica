/* global document */

/**
 * Aviso flotante. Mantiene la firma de siempre —notify(msg, time, type)— para
 * no tocar las llamadas repartidas por las vistas.
 *
 * @param {string} msg        texto a mostrar
 * @param {number} time       milisegundos visible (sin contar la entrada)
 * @param {'error'|'success'} type
 * @param {number} spawnTime  duración de la animación de entrada/salida
 */
// eslint-disable-next-line no-unused-vars
function notify (msg, time = 2200, type = 'error', spawnTime = 320) {
  const container = document.querySelector('.notify-container')
  if (!container) return

  const notifyText = container.querySelector('.notify-text')
  const notifyIcon = container.querySelector('#notify-icon')

  // Un aviso anterior podría tener su temporizador de salida en marcha.
  if (notify._timeout) clearTimeout(notify._timeout)

  container.style.animation = 'none'
  container.style.opacity = '0'

  notifyIcon.className = type === 'error'
    ? 'fa-solid fa-triangle-exclamation'
    : 'fa-solid fa-circle-check'

  notifyText.textContent = msg
  container.className = `notify-container ${type}`
  container.setAttribute('role', type === 'error' ? 'alert' : 'status')

  // Reinicia la animación aunque se repita el mismo aviso.
  container.offsetWidth // eslint-disable-line no-unused-expressions

  container.style.animation = `showNotify ${spawnTime}ms var(--ease) forwards`

  notify._timeout = setTimeout(() => {
    container.style.animation = `hideNotify ${spawnTime}ms var(--ease) forwards`
  }, time + spawnTime)
}

/** Escapa texto que vaya a inyectarse con innerHTML. */
// eslint-disable-next-line no-unused-vars
function escapeHtml (value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char])
}
