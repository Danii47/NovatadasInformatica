import express from 'express'
import { PORT, SERVER_URL, SECRET_JWT_KEY, MONGOOSE_CONNECT, DISCORD_WEBHOOK_LOGIN, DISCORD_WEBHOOK_REQUEST_CHALLENGE, IS_PRODUCTION, EDITION } from './config.js'
import { UserRepository } from './user-repository.js'
import { ChallengeRepository } from './challenge-repository.js'
import { AuditRepository, AUDIT_ACTIONS } from './audit-repository.js'
import { corsMiddleWare } from './middlewares/cors.js'
import { securityHeaders } from './middlewares/securityHeaders.js'
import { rateLimit } from './middlewares/rateLimit.js'
import { isAdminRedirect, isAdminMessage, isSuperAdminRedirect, isSuperAdminMessage } from './middlewares/isAdmin.js'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'
import mongoose from 'mongoose'
import { ChallengeAlreadyAcceptedError, ChallengeAlreadyCompletedError, ChallengeAlreadyPendingError, ChallengeNotFoundError, ChallengeNotRequestedError, ForbiddenActionError, InvalidCredentialsError, InvalidPointsError, UserAlreadyAdministratorError, UserAlreadyExistsError, UserNotFoundError, ValidationError } from './errors.js'
import { sendWebhook } from './utils/sendWebhook.js'
import { getTotalPoints } from './utils/getTotalPoints.js'
import { jsonForScript } from './utils/jsonForScript.js'

mongoose.connect(`${MONGOOSE_CONNECT}`)
  .then(() => {
    console.log('\x1b[36m', '\n[MONGO-DB] Conectado a DB ☁️', '\x1b[0m')
  }).catch((error) => {
    console.log('\x1b[31m', '\n[MONGO-DB] Ocurrio un error al intentar conectar la DB:\n', error, '\x1b[0m')
  })

const app = express()

app.disable('x-powered-by')

// Render y cualquier proxy TLS: sin esto `req.ip` es la IP del proxy y el
// limitador de intentos de login trataria a todo el mundo como un unico cliente.
app.set('trust proxy', 1)

app.set('view engine', 'ejs')
app.use(securityHeaders())
app.use(express.static('public', { maxAge: IS_PRODUCTION ? '7d' : 0 }))
app.use(express.json({ limit: '512kb' }))
app.use(corsMiddleWare())
app.use(cookieParser())

/**
 * Traduce los errores de dominio a codigos HTTP. Evita repetir la misma
 * escalera de `instanceof` en cada endpoint.
 */
const STATUS_BY_ERROR = new Map([
  [ValidationError, 400],
  [InvalidPointsError, 400],
  [UserAlreadyExistsError, 409],
  [UserAlreadyAdministratorError, 409],
  [ChallengeAlreadyAcceptedError, 409],
  [ChallengeAlreadyPendingError, 409],
  [ChallengeAlreadyCompletedError, 409],
  [ChallengeNotRequestedError, 409],
  [UserNotFoundError, 404],
  [ChallengeNotFoundError, 404],
  [InvalidCredentialsError, 401],
  [ForbiddenActionError, 403]
])

const sendError = (res, error) => {
  for (const [ErrorType, status] of STATUS_BY_ERROR) {
    if (error instanceof ErrorType) return res.status(status).send({ err: error.message })
  }

  console.error('[ERROR]', error)
  return res.status(500).send({ err: 'Ha ocurrido un error inesperado.' })
}

/**
 * La cookie solo dice *quien* eres; el rol y los puntos se releen de la base en
 * cada peticion. Antes viajaban dentro del JWT, asi que un usuario ascendido (o
 * expulsado) mantenia su rol antiguo hasta 10 dias.
 */
app.use(async (req, res, next) => {
  const token = req.cookies.access_token

  req.session = { user: null }

  if (!token) return next()

  try {
    const data = jwt.verify(token, SECRET_JWT_KEY)
    const user = await UserRepository.getSessionUser({ id: data.id })

    if (!user) {
      res.clearCookie('access_token')
      return next()
    }

    req.session.user = user
  } catch (error) {
    res.clearCookie('access_token')
  }

  next()
})

app.use((req, res, next) => {
  res.locals.edition = EDITION
  // Para incrustar datos en un <script> sin que un nombre de usuario pueda
  // cerrar la etiqueta e inyectar código.
  res.locals.jsonForScript = jsonForScript
  next()
})

const requireSession = (req, res, next) => {
  if (!req.session.user) return res.status(403).redirect('/')
  next()
}

app.get('/', (req, res) => {
  const { user } = req.session
  if (user) return res.redirect('/scoreboard')
  res.render('index')
})

app.post('/login', rateLimit({ windowMs: 10 * 60 * 1000, max: 12, message: 'Demasiados intentos de inicio de sesión. Espera unos minutos.' }), async (req, res) => {
  const { email, password } = req.body
  try {
    const user = await UserRepository.login({ email, password })

    // El token solo lleva el identificador: los permisos se resuelven en cada
    // peticion contra la base de datos.
    const accessToken = jwt.sign({ id: user.id }, SECRET_JWT_KEY, {
      expiresIn: '10d'
    })

    res
      .cookie('access_token', accessToken, {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24 * 10 // 10 days
      })
      .send(user)

    await sendWebhook(DISCORD_WEBHOOK_LOGIN, {
      username: 'Log In Novatadas',
      embeds: [{
        color: 4373056,
        title: 'Nuevo inicio de sesión',
        fields: [
          { name: 'Email', value: `${email}` },
          { name: 'Nombre', value: `${user.name}` },
          { name: 'Puntos', value: `${user.points}` },
          { name: 'Rango', value: `${user.isAdmin ? 'Administrador' : 'Usuario'}` }
        ],
        footer: { text: 'Sistema de logs | Novatadas' }
      }]
    })
  } catch (error) {
    sendError(res, error)
  }
})

app.post('/logout', (req, res) => {
  res.clearCookie('access_token').redirect('/')
})

app.get('/scoreboard', requireSession, async (req, res) => {
  const { user } = req.session

  try {
    const users = await UserRepository.getAllUsers({ sorted: true })

    const totalPoints = getTotalPoints({ users, start: 2 })

    res.render('scoreboard', { loggedUser: user, allUsers: users, totalPoints })
  } catch (error) {
    console.error('[ERROR]', error)
    res.status(500).redirect('/')
  }
})

app.get('/challenges', requireSession, async (req, res) => {
  const { user } = req.session

  try {
    const challenges = await ChallengeRepository.getAllChallenges({ sorted: true })
    const { pendingChallenges, completedChallenges } = await UserRepository.getPendingAndCompletedChallenges({ userId: user.id })

    res.render('challenges', { loggedUser: user, allChallenges: challenges, pendingChallenges, completedChallenges })
  } catch (error) {
    console.error('[ERROR]', error)
    res.status(500).redirect('/')
  }
})

app.get('/user/:id', requireSession, async (req, res) => {
  const { user } = req.session
  const { id } = req.params

  try {
    const userToShow = await UserRepository.getUserById({ id })

    const completedChalleges = await ChallengeRepository.getCompletedChallenges({ challengesIds: userToShow.challenges })
    const pendingChallenges = await ChallengeRepository.getPendingChallenges({ challengesIds: userToShow.pendingChallenges })

    res.render('user', { loggedUser: user, userToShow, completedChalleges, pendingChallenges })
  } catch (error) {
    if (error instanceof UserNotFoundError) return res.status(404).redirect('/scoreboard')
    console.error('[ERROR]', error)
    res.status(500).redirect('/')
  }
})

// ---------------------------------------------------------------- Retos

app.post('/challenges/request-complete-challenge', async (req, res) => {
  const { user } = req.session
  if (!user) return res.status(403).send({ err: 'No autorizado.' })

  const { challengeId } = req.body

  try {
    // El id del usuario sale de la sesion, nunca del cuerpo de la peticion:
    // antes cualquiera podia solicitar retos en nombre de otro.
    const pendingChallengeAdded = await UserRepository.requestCompleteChallenge({ userId: user.id, challengeId })
    res.send({ pendingChallengeAdded })

    await sendWebhook(DISCORD_WEBHOOK_REQUEST_CHALLENGE, {
      username: 'Request Challenge Novatadas',
      embeds: [{
        color: 4352180,
        title: 'Nuevo reto solicitado',
        fields: [
          { name: 'Nombre', value: `${user.name}` },
          { name: 'Puntos', value: `${user.points}` },
          { name: 'Rango', value: `${user.isAdmin ? 'Administrador' : 'Usuario'}` },
          { name: 'Reto', value: `${pendingChallengeAdded.title}` },
          { name: 'Puntos del reto', value: `${pendingChallengeAdded.points}` }
        ],
        footer: { text: 'Sistema de logs | Novatadas' }
      }]
    })
  } catch (error) {
    sendError(res, error)
  }
})

app.post('/challenges/accept-challenge-completed', isAdminMessage, async (req, res) => {
  const { userId, challengeId } = req.body

  try {
    const result = await UserRepository.acceptChallengeCompleted({ userId, challengeId })

    res.send({ challengeAccepted: result.challengeId })

    await AuditRepository.record({
      action: AUDIT_ACTIONS.CHALLENGE_ACCEPTED,
      actor: req.session.user,
      targetName: result.userName,
      detail: result.challengeTitle,
      amount: result.points
    })
  } catch (error) {
    sendError(res, error)
  }
})

app.post('/challenges/reject-challenge-completed', isAdminMessage, async (req, res) => {
  const { userId, challengeId } = req.body

  try {
    const result = await UserRepository.rejectChallengeCompleted({ userId, challengeId })

    res.send({ challengeRejected: result.challengeId })

    await AuditRepository.record({
      action: AUDIT_ACTIONS.CHALLENGE_REJECTED,
      actor: req.session.user,
      targetName: result.userName
    })
  } catch (error) {
    sendError(res, error)
  }
})

app.post('/challenges/create-challenge', isAdminMessage, async (req, res) => {
  const { title, description, points } = req.body

  try {
    const id = await ChallengeRepository.create({ title, description, points })
    res.send({ id })

    await AuditRepository.record({
      action: AUDIT_ACTIONS.CHALLENGE_CREATED,
      actor: req.session.user,
      detail: title,
      amount: Number(points)
    })
  } catch (error) {
    sendError(res, error)
  }
})

app.post('/challenges/edit-challenge', isAdminMessage, async (req, res) => {
  const { challengeId, title, description, points } = req.body

  try {
    const result = await ChallengeRepository.update({ challengeId, title, description, points })
    res.send(result)

    await AuditRepository.record({
      action: AUDIT_ACTIONS.CHALLENGE_UPDATED,
      actor: req.session.user,
      detail: result.pointsDelta === 0
        ? result.title
        : `${result.title} · ${result.pointsDelta > 0 ? '+' : ''}${result.pointsDelta} puntos a ${result.affectedUsers} usuarios`,
      amount: result.points
    })
  } catch (error) {
    sendError(res, error)
  }
})

app.post('/challenges/delete-challenge', isSuperAdminMessage, async (req, res) => {
  const { challengeId } = req.body

  try {
    const result = await ChallengeRepository.deleteChallenge({ challengeId })
    res.send({ challengeDeleted: result.challengeId })

    await AuditRepository.record({
      action: AUDIT_ACTIONS.CHALLENGE_DELETED,
      actor: req.session.user,
      detail: result.title
    })
  } catch (error) {
    sendError(res, error)
  }
})

// ---------------------------------------------------------------- Puntos

app.post('/add-points', isAdminMessage, async (req, res) => {
  const { userId, challengeId } = req.body

  try {
    const result = await UserRepository.addPoints({ userId, challengeId })

    res.send({ points: result.points })

    await AuditRepository.record({
      action: AUDIT_ACTIONS.POINTS_ADDED,
      actor: req.session.user,
      targetName: result.userName,
      detail: result.challengeTitle,
      amount: result.points
    })
  } catch (error) {
    sendError(res, error)
  }
})

app.post('/add-extra-points', isSuperAdminMessage, async (req, res) => {
  const { userId, extraPointsText, extraPoints } = req.body

  try {
    const result = await UserRepository.addExtraPoints({ userId, extraPointsText, extraPoints })

    res.send({ points: result.points })

    await AuditRepository.record({
      action: AUDIT_ACTIONS.EXTRA_POINTS_ADDED,
      actor: req.session.user,
      targetName: result.userName,
      detail: extraPointsText,
      amount: result.points
    })
  } catch (error) {
    sendError(res, error)
  }
})

app.get('/spin-extra-prize', isSuperAdminMessage, async (req, res) => {
  try {
    const winner = await UserRepository.spinExtraPrize()

    res.send({ winner })

    if (winner) {
      await AuditRepository.record({
        action: AUDIT_ACTIONS.EXTRA_PRIZE_SPUN,
        actor: req.session.user,
        targetName: winner.name
      })
    }
  } catch (error) {
    sendError(res, error)
  }
})

// ---------------------------------------------------------------- Usuarios

app.post('/register', isAdminMessage, async (req, res) => {
  const { name, email, password } = req.body

  try {
    const id = await UserRepository.create({ name, email, password })
    res.send({ id })

    await AuditRepository.record({
      action: AUDIT_ACTIONS.USER_CREATED,
      actor: req.session.user,
      targetName: name,
      detail: email
    })
  } catch (error) {
    sendError(res, error)
  }
})

/** Alta masiva: el corazon de la migracion de cada curso. */
app.post('/users/bulk-create', isSuperAdminMessage, async (req, res) => {
  const { users } = req.body

  try {
    const { created, skipped } = await UserRepository.createMany({ users })

    res.send({ created, skipped })

    if (created.length > 0) {
      await AuditRepository.record({
        action: AUDIT_ACTIONS.USERS_IMPORTED,
        actor: req.session.user,
        detail: `${created.length} altas · ${skipped.length} descartados`,
        amount: created.length
      })
    }
  } catch (error) {
    sendError(res, error)
  }
})

app.post('/users/become-administrator', isSuperAdminMessage, async (req, res) => {
  const { userId } = req.body

  try {
    const result = await UserRepository.becomeAdministrator({ userId })
    res.send({ userUpdated: result.userId })

    await AuditRepository.record({
      action: AUDIT_ACTIONS.USER_PROMOTED,
      actor: req.session.user,
      targetName: result.userName
    })
  } catch (error) {
    sendError(res, error)
  }
})

app.post('/users/revoke-administrator', isSuperAdminMessage, async (req, res) => {
  const { userId } = req.body

  try {
    const result = await UserRepository.revokeAdministrator({ userId })
    res.send({ userUpdated: result.userId })

    await AuditRepository.record({
      action: AUDIT_ACTIONS.USER_DEMOTED,
      actor: req.session.user,
      targetName: result.userName
    })
  } catch (error) {
    sendError(res, error)
  }
})

app.post('/users/reset-password', isSuperAdminMessage, async (req, res) => {
  const { userId } = req.body

  try {
    const result = await UserRepository.resetPassword({ userId })
    res.send(result)

    await AuditRepository.record({
      action: AUDIT_ACTIONS.PASSWORD_RESET,
      actor: req.session.user,
      targetName: result.userName,
      detail: result.email
    })
  } catch (error) {
    sendError(res, error)
  }
})

app.post('/users/delete-user', isSuperAdminMessage, async (req, res) => {
  const { userId } = req.body

  try {
    const result = await UserRepository.deleteUser({ userId, requestedBy: req.session.user.id })
    res.send({ userDeleted: result.userId })

    await AuditRepository.record({
      action: AUDIT_ACTIONS.USER_DELETED,
      actor: req.session.user,
      targetName: result.userName
    })
  } catch (error) {
    sendError(res, error)
  }
})

/**
 * Borrado de fin de curso. Requiere escribir la palabra de confirmacion para
 * que no se dispare por un click accidental.
 */
app.post('/users/delete-all', isSuperAdminMessage, async (req, res) => {
  const { confirmation, keepAdmins = true } = req.body

  if (confirmation !== 'BORRAR TODO') {
    return res.status(400).send({ err: 'Escribe exactamente BORRAR TODO para confirmar.' })
  }

  try {
    const { deletedCount, deletedUsers } = await UserRepository.deleteAllUsersExcept({
      requestedBy: req.session.user.id,
      keepAdmins: Boolean(keepAdmins)
    })

    res.send({ deletedCount, deletedUsers })

    await AuditRepository.record({
      action: AUDIT_ACTIONS.USERS_PURGED,
      actor: req.session.user,
      detail: keepAdmins ? 'Conservando administradores' : 'Incluyendo administradores',
      amount: deletedCount
    })
  } catch (error) {
    sendError(res, error)
  }
})

app.post('/users/reset-progress', isSuperAdminMessage, async (req, res) => {
  const { confirmation } = req.body

  if (confirmation !== 'REINICIAR') {
    return res.status(400).send({ err: 'Escribe exactamente REINICIAR para confirmar.' })
  }

  try {
    const modifiedCount = await UserRepository.resetAllProgress()
    res.send({ modifiedCount })

    await AuditRepository.record({
      action: AUDIT_ACTIONS.USERS_PURGED,
      actor: req.session.user,
      detail: 'Progreso reiniciado (puntos y retos a cero)',
      amount: modifiedCount
    })
  } catch (error) {
    sendError(res, error)
  }
})

// ---------------------------------------------------------------- Paneles

app.get('/admin-page', isAdminRedirect, async (req, res) => {
  const { user } = req.session

  try {
    const users = await UserRepository.getAllUsers({ sorted: true, catchEmail: true })
    const challenges = await ChallengeRepository.getAllChallenges({ sorted: true })

    res.render('admin-page', { loggedUser: user, allUsers: users, allChallenges: challenges })
  } catch (error) {
    console.error('[ERROR]', error)
    res.status(500).redirect('/')
  }
})

app.get('/gestion', isSuperAdminRedirect, async (req, res) => {
  const { user } = req.session

  try {
    const [users, stats, logs, challenges] = await Promise.all([
      UserRepository.getAllUsers({ sorted: true, catchEmail: true, showAdmins: true }),
      UserRepository.countUsers(),
      AuditRepository.getRecent({ limit: 150 }),
      ChallengeRepository.getAllChallenges({ sorted: true })
    ])

    res.render('management', { loggedUser: user, allUsers: users, stats, logs, challengeCount: challenges.length })
  } catch (error) {
    console.error('[ERROR]', error)
    res.status(500).redirect('/')
  }
})

// Ruta antigua del panel avanzado.
app.get('/super-admin-page', (req, res) => res.redirect(301, '/gestion'))

app.get('/audit-log', isSuperAdminMessage, async (req, res) => {
  try {
    const logs = await AuditRepository.getRecent({ limit: 150 })
    res.send({ logs })
  } catch (error) {
    sendError(res, error)
  }
})

app.post('/audit-log/clear', isSuperAdminMessage, async (req, res) => {
  try {
    const deletedCount = await AuditRepository.clear()
    res.send({ deletedCount })
  } catch (error) {
    sendError(res, error)
  }
})

app.get('/get-db-data', isAdminMessage, async (req, res) => {
  try {
    const challenges = await ChallengeRepository.getAllChallenges({ sorted: true })
    const users = await UserRepository.getAllUsers({ sorted: true, catchEmail: true })

    res.send({ challenges, users })
  } catch (error) {
    sendError(res, error)
  }
})

app.use((req, res) => {
  res.status(404).render('not-found', { loggedUser: req.session?.user ?? null })
})

app.listen(PORT, () => {
  console.log(`Servidor escuchando en ${SERVER_URL}:${PORT}`)
})
