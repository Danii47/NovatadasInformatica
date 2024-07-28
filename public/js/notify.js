// eslint-disable-next-line
function notify(msg, time, type = 'error', spawnTime = 500) {
  const $ = (element) => document.querySelector(element)

  const container = $('.notify-container')
  const notifyText = $('.notify-text')
  const notifyIcon = $('#notify-icon')

  container.style.animation = 'none'
  container.style.opacity = 0

  notifyIcon.className = ''
  notifyIcon.classList.add(
    ...((type === 'error')
      ? ['fa-solid', 'fa-triangle-exclamation', 'fa-beat']
      : ['fa-solid', 'fa-check-circle', 'fa-beat']
    ))

  notifyText.textContent = msg
  container.className = 'notify-container'
  container.classList.add(type)

  container.style.animation = `showNotify ${spawnTime}ms forwards`

  setTimeout(() => {
    container.style.animation = `hideNotify ${spawnTime}ms forwards`
  }, time + spawnTime)
}
