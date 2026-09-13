const CSP = [
  "default-src 'self'",
  // Tipografía desde Google Fonts e iconos desde cdnjs.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
  "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:",
  // Los scripts de las vistas son inline y usan datos renderizados por EJS.
  "script-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'"
].join('; ')

export const securityHeaders = () => (req, res, next) => {
  res.set('Content-Security-Policy', CSP)
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('Referrer-Policy', 'same-origin')
  res.set('X-Frame-Options', 'DENY')
  res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  next()
}
