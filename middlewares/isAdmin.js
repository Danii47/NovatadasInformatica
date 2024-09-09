export const isAdminRedirect = (req, res, next) => {
  const { user } = req.session
  if (!user || !user.isAdmin) {
    return res.status(403).redirect('/')
  }
  next()
}

export const isAdminMessage = (req, res, next) => {
  const { user } = req.session
  if (!user || !user.isAdmin) {
    return res.status(403).send('No autorizado.')
  }
  next()
}
