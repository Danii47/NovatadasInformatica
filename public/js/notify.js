// eslint-disable-next-line
function notify (msg, time, type = 'error') {
  const $ = (element) => document.querySelector(element)

  const container = $('.notify-container')
  const notifyText = $('.notify-text')
  const notifyIcon = $('#notify-icon')

  container.style.animation = ''
  container.style.opacity = 0

  // clearTimeout(notifyTimeoutId)
  // clearTimeout(notifyTimeoutId2)

  notifyIcon.classList.remove('fa-solid', 'fa-triangle-exclamation', 'fa-beat')
  notifyIcon.classList.remove('fa-solid', 'fa-check-circle')
  notifyIcon.classList.add(...(type === 'error' ? ['fa-solid', 'fa-triangle-exclamation', 'fa-beat'] : ['fa-solid', 'fa-check-circle']))

  notifyText.textContent = msg
  container.classList.remove('success')
  container.classList.remove('error')

  container.classList.add(type)

  container.style.animation = 'showNotify .5s'

  setTimeout(() => {
    container.style.animation = ''
    container.style.opacity = 1
  }, 500)

  setTimeout(() => {
    container.style.animation = 'hideNotify .5s'
    setTimeout(() => {
      container.style.animation = ''
      container.style.opacity = 0
    }, 500)
  }, time + 500)
}
