/**
 * Selector con búsqueda. Sustituye al par «input de búsqueda + <select>» que
 * obligaba a desplegar una lista de cien nombres para encontrar a alguien.
 *
 * Marcado esperado:
 *   <div class="picker" data-picker>
 *     <input class="input picker__input" type="text" placeholder="…">
 *     <input type="hidden" class="picker__value">
 *     <ul class="picker__list" hidden></ul>
 *   </div>
 *
 * Uso: createPicker(element, { items, render, search })
 *   items  → [{ value, label, hint }]
 */
// eslint-disable-next-line no-unused-vars
function createPicker (root, { items = [], placeholder } = {}) {
  const input = root.querySelector('.picker__input')
  const hidden = root.querySelector('.picker__value')
  const list = root.querySelector('.picker__list')

  let options = items
  let filtered = items
  let activeIndex = -1

  if (placeholder) input.placeholder = placeholder

  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char])

  function render () {
    if (filtered.length === 0) {
      list.innerHTML = '<li class="picker__empty">Sin resultados</li>'
      return
    }

    list.innerHTML = filtered
      .slice(0, 80)
      .map((item, index) => `
        <li class="picker__option${index === activeIndex ? ' is-active' : ''}"
            role="option" data-index="${index}" aria-selected="${index === activeIndex}">
          <span class="picker__label">${escape(item.label)}</span>
          ${item.hint ? `<span class="picker__hint">${escape(item.hint)}</span>` : ''}
        </li>
      `)
      .join('')
  }

  function open () {
    list.hidden = false
    root.classList.add('is-open')
    input.setAttribute('aria-expanded', 'true')
  }

  function close () {
    list.hidden = true
    root.classList.remove('is-open')
    input.setAttribute('aria-expanded', 'false')
    activeIndex = -1
  }

  function filter (query) {
    const needle = query.trim().toLowerCase()

    filtered = needle === ''
      ? options
      : options.filter((item) => `${item.label} ${item.hint ?? ''}`.toLowerCase().includes(needle))

    activeIndex = filtered.length > 0 ? 0 : -1
    render()
  }

  function select (item) {
    if (!item) return

    hidden.value = item.value
    input.value = item.label
    root.classList.add('has-value')
    close()
    root.dispatchEvent(new CustomEvent('picker:change', { detail: item }))
  }

  input.addEventListener('focus', () => { filter(''); open() })

  input.addEventListener('input', () => {
    // Al escribir se descarta la selección previa: evita enviar un id que ya no
    // se corresponde con lo que se ve en el campo.
    hidden.value = ''
    root.classList.remove('has-value')
    filter(input.value)
    open()
  })

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') return close()

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (list.hidden) open()

      const step = event.key === 'ArrowDown' ? 1 : -1
      activeIndex = (activeIndex + step + filtered.length) % Math.max(filtered.length, 1)
      render()
      list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' })
      return
    }

    if (event.key === 'Enter' && !list.hidden && activeIndex >= 0) {
      event.preventDefault()
      select(filtered[activeIndex])
    }
  })

  list.addEventListener('mousedown', (event) => {
    // mousedown en lugar de click: el blur del input cerraría la lista antes.
    const option = event.target.closest('.picker__option')
    if (!option) return
    event.preventDefault()
    select(filtered[Number(option.dataset.index)])
  })

  input.addEventListener('blur', () => setTimeout(close, 120))

  render()

  return {
    get value () { return hidden.value },
    setItems (nextItems) {
      options = nextItems
      filter(input.value)
    },
    clear () {
      hidden.value = ''
      input.value = ''
      root.classList.remove('has-value')
      filtered = options
      render()
    }
  }
}
