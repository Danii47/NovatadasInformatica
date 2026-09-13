/**
 * Limitador en memoria. Suficiente para una unica instancia como la de Render;
 * si algun dia hay varias replicas habria que moverlo a Mongo o Redis.
 */
export const rateLimit = ({ windowMs = 15 * 60 * 1000, max = 10, message = 'Demasiados intentos. Inténtalo más tarde.' } = {}) => {
  const hits = new Map()

  const prune = (now) => {
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key)
    }
  }

  return (req, res, next) => {
    const now = Date.now()
    if (hits.size > 5000) prune(now)

    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    const entry = hits.get(key)

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    entry.count += 1

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      res.set('Retry-After', String(retryAfter))
      return res.status(429).send({ err: message })
    }

    next()
  }
}
