function notify (msg, time) {
  const $ = (element) => document.querySelector(element)

  const container = $('.notify-container')
  const notifyText = $('.notify-text')

  notifyText.textContent = msg

  container.style.animation = 'showNotify 1s'

  setTimeout(() => {
    container.style.animation = ''
    container.style.opacity = 1
  }, 1000)

  setTimeout(() => {
    container.style.animation = 'hideNotify 1s'
    setTimeout(() => {
      container.style.animation = ''
      container.style.opacity = 0
    }, 1000)
  }, time + 1000)
}
