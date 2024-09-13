import express from 'express'
import { PORT, SERVER_URL, SECRET_JWT_KEY, MONGOOSE_CONNECT, DISCORD_WEBHOOK_LOGIN, DISCORD_WEBHOOK_REQUEST_CHALLENGE } from './config.js'
import { UserRepository } from './user-repository.js'
import { ChallengeRepository } from './challenge-repository.js'
import { corsMiddleWare } from './middlewares/cors.js'
import { isAdminRedirect, isAdminMessage, isSuperAdminRedirect, isSuperAdminMessage } from './middlewares/isAdmin.js'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'
import mongoose from 'mongoose'
import { ChallengeAlreadyAcceptedError, ChallengeAlreadyCompletedError, ChallengeAlreadyPendingError, ChallengeNotFoundError, ChallengeNotRequestedError, InvalidCredentialsError, InvalidPointsError, UserAlreadyAdministratorError, UserAlreadyExistsError, UserNotFoundError, ValidationError } from './errors.js'
import { sendWebhook } from './utils/sendWebhook.js'
import { getTotalPoints } from './utils/getTotalPoints.js'

mongoose.connect(`${MONGOOSE_CONNECT}`, {
  // useNewUrlParser: true,
  // useUnifiedTopology: true
}).then(() => {
  console.log('\x1b[36m', '\n[MONGO-DB] Conectado a DB ☁️', '\x1b[0m')
}).catch((error) => {
  console.log('\x1b[31m', '\n[MONGO-DB] Ocurrio un error al intentar conectar la DB:\n', error, '\x1b[0m')
})

const app = express()

app.disable('x-powered-by')

app.set('view engine', 'ejs')
app.use(express.static('public'))
app.use(express.json())
app.use(corsMiddleWare())
app.use(cookieParser())

app.use((req, res, next) => {
  const token = req.cookies.access_token

  req.session = { user: null }

  try {
    const data = jwt.verify(token, SECRET_JWT_KEY)
    req.session.user = data
  } catch (error) {
    res.clearCookie('access_token')
  }

  next()
})

app.get('/', (req, res) => {
  const { user } = req.session
  if (user) return res.redirect('/scoreboard')
  res.render('index')
})

app.post('/register', isAdminMessage, async (req, res) => {
  const { name, dni, password } = req.body

  try {
    const id = await UserRepository.create({ name, dni, password })
    res.send({ id })
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).send({ err: error.message })
    } else if (error instanceof UserAlreadyExistsError) {
      res.status(400).send({ err: error.message })
    } else {
      res.status(500).send({ err: 'Ha ocurrido un error inesperado.' })
    }
  }
})

app.post('/login', async (req, res) => {
  const { dni, password } = req.body
  try {
    const user = await UserRepository.login({ dni, password })
    const accessToken = jwt.sign({ ...user }, SECRET_JWT_KEY, {
      expiresIn: '1h'
    })

    res
      .cookie('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60
      })
      .send(user)

    await sendWebhook(DISCORD_WEBHOOK_LOGIN, {
      username: 'Log In Novatadas',
      embeds: [{
        color: 4373056,
        title: 'Nuevo inicio de sesión',
        fields: [
          { name: 'DNI', value: `${dni}` },
          { name: 'Nombre', value: `${user.name}` },
          { name: 'Puntos', value: `${user.points}` },
          { name: 'Rango', value: `${user.isAdmin ? 'Administrador' : 'Usuario'}` }
        ],
        footer: { text: 'Sistema de logs | Novatadas' }
      }]
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).send({ err: error.message })
    } else if (error instanceof InvalidCredentialsError) {
      res.status(401).send({ err: error.message })
    } else {
      res.status(500).send({ err: 'Ha ocurrido un error inesperado.' })
    }
  }
})

app.post('/logout', (req, res) => {
  res.clearCookie('access_token').redirect('/')
})

app.get('/scoreboard', async (req, res) => {
  const { user } = req.session
  if (!user) return res.status(403).redirect('/')

  try {
    const users = await UserRepository.getAllUsers({ sorted: true })

    const totalPoints = getTotalPoints({ users, start: 2 })

    res.render('scoreboard', { loggedUser: user, allUsers: users, totalPoints })
  } catch (error) {
    res.status(500).redirect('/')
  }
})

app.get('/challenges', async (req, res) => {
  const { user } = req.session
  if (!user) return res.status(403).redirect('/')
  try {
    const challenges = await ChallengeRepository.getAllChallenges({ sorted: true })
    const { pendingChallenges, completedChallenges } = await UserRepository.getPendingAndCompletedChallenges({ userId: user.id })

    res.render('challenges', { loggedUser: user, allChallenges: challenges, pendingChallenges, completedChallenges })
  } catch (error) {
    res.status(500).redirect('/')
  }
})

app.post('/users/become-administrator', isAdminMessage, async (req, res) => {
  const { userId } = req.body

  try {
    const userUpdated = await UserRepository.becomeAdministrator({ userId })
    res.send({ userUpdated })
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(400).send({ err: error.message })
    } else if (error instanceof UserAlreadyAdministratorError) {
      res.status(400).send({ err: error.message })
    } else {
      res.status(500).send({ err: 'Ha ocurrido un error inesperado.' })
    }
  }
})

app.post('/challenges/request-complete-challenge', async (req, res) => {
  const { user } = req.session
  if (!user) return res.status(403).send('No autorizado')

  const { userId, challengeId } = req.body
  try {
    const pendingChallengeAdded = await UserRepository.requestCompleteChallenge({ userId, challengeId })
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
          { name: 'Puntos', value: `${pendingChallengeAdded.points}` }
        ],
        footer: { text: 'Sistema de logs | Novatadas' }
      }]
    })
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(400).send({ err: error.message })
    } else if (error instanceof ChallengeNotFoundError) {
      res.status(400).send({ err: error.message })
    } else if (error instanceof ChallengeAlreadyAcceptedError) {
      res.status(400).send({ err: error.message })
    } else if (error instanceof ChallengeAlreadyPendingError) {
      res.status(400).send({ err: error.message })
    } else {
      res.status(500).send({ err: 'Ha ocurrido un error inesperado.' })
    }
  }
})

app.post('/challenges/reject-challenge-completed', isAdminMessage, async (req, res) => {
  const { userId, challengeId } = req.body

  try {
    const challengeRejected = await UserRepository.rejectChallengeCompleted({ userId, challengeId })
    res.send({ challengeRejected })
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return res.status(400).send({ err: error.message })
    } else if (error instanceof ChallengeNotRequestedError) {
      return res.status(400).send({ err: error.message })
    } else {
      return res.status(500).send({ err: 'Ha ocurrido un error inesperado.' })
    }
  }
})

app.post('/challenges/accept-challenge-completed', isAdminMessage, async (req, res) => {
  const { userId, challengeId } = req.body

  try {
    const challengeAccepted = await UserRepository.acceptChallengeCompleted({ userId, challengeId })
    res.send({ challengeAccepted })
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(400).send({ err: error.message })
    } else if (error instanceof ChallengeNotFoundError) {
      res.status(400).send({ err: error.message })
    } else if (error instanceof ChallengeNotRequestedError) {
      res.status(400).send({ err: error.message })
    } else {
      res.status(500).send({ err: 'Ha ocurrido un error inesperado.' })
    }
  }
})

app.get('/admin-page', isAdminRedirect, async (req, res) => {
  const { user } = req.session

  try {
    const users = await UserRepository.getAllUsers({ sorted: true, catchDNI: true })
    const challenges = await ChallengeRepository.getAllChallenges({ sorted: true, maxCharacters: 20 })

    res.render('admin-page', { loggedUser: user, allUsers: users, allChallenges: challenges })
  } catch (error) {
    res.status(500).redirect('/')
  }
})

app.get('/spinner', isAdminRedirect, async (req, res) => {
  const { user } = req.session

  try {
    const users = await UserRepository.getAllUsers({ sorted: true, catchDNI: true })
    const totalPoints = getTotalPoints({ users, start: 2 })

    res.render('spinner', { loggedUser: user, allUsers: users, totalPoints })
  } catch (error) {
    res.status(500).redirect('/')
  }
})

app.get('/super-admin-page', isSuperAdminRedirect, async (req, res) => {
  const { user } = req.session

  try {
    const users = await UserRepository.getAllUsers({ sorted: true, catchDNI: true })
    const challenges = await ChallengeRepository.getAllChallenges({ sorted: true, maxCharacters: 20 })

    res.render('super-admin-page', { loggedUser: user, allUsers: users, allChallenges: challenges })
  } catch (error) {
    res.status(500).redirect('/')
  }
})

app.get('/user/:id', async (req, res) => {
  const { user } = req.session
  if (!user) return res.status(403).redirect('/')

  const { id } = req.params

  try {
    const userToShow = await UserRepository.getUserById({ id })

    const completedChalleges = await ChallengeRepository.getCompletedChallenges({ challengesIds: userToShow.challenges })
    const pendingChallenges = await ChallengeRepository.getPendingChallenges({ challengesIds: userToShow.pendingChallenges })

    res.render('user', { loggedUser: user, userToShow, completedChalleges, pendingChallenges })
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(404).redirect('/')
    } else {
      res.status(500).redirect('/')
    }
  }
})

app.post('/add-points', isAdminMessage, async (req, res) => {
  const { userId, challengeId } = req.body

  try {
    const newPoints = await UserRepository.addPoints({ userId, challengeId })

    res.send({ points: newPoints })
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(400).send({ err: error.message })
    } else if (error instanceof ChallengeNotFoundError) {
      res.status(400).send({ err: error.message })
    } else if (error instanceof ChallengeAlreadyCompletedError) {
      res.status(400).send({ err: error.message })
    } else {
      res.status(500).send({ err: 'Ha ocurrido un error inesperado.' })
    }
  }
})

app.post('/add-extra-points', isSuperAdminMessage, async (req, res) => {
  const { userId, extraPointsText, extraPoints } = req.body

  try {
    const newPoints = await UserRepository.addExtraPoints({ userId, extraPointsText, extraPoints })

    res.send({ points: newPoints })
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(400).send({ err: error.message })
    } else {
      res.status(500).send({ err: 'Ha ocurrido un error inesperado.' })
    }
  }
})

app.post('/challenges/create-challenge', isAdminMessage, async (req, res) => {
  const { title, description, points } = req.body

  try {
    const id = await ChallengeRepository.create({ title, description, points })
    res.send({ id })
  } catch (error) {
    if (error instanceof InvalidPointsError) {
      res.status(400).send({ err: error.message })
    } else {
      res.status(500).send({ err: 'Ha ocurrido un error inesperado.' })
    }
  }
})

app.post('/challenges/delete-challenge', isAdminMessage, async (req, res) => {
  const { challengeId } = req.body

  try {
    const challengeDeleted = await ChallengeRepository.deleteChallenge({ challengeId })
    res.send({ challengeDeleted })
  } catch (error) {
    if (error instanceof ChallengeNotFoundError) {
      res.status(400).send({ err: error.message })
    } else {
      res.status(500).send({ err: 'Ha ocurrido un error inesperado.' })
    }
  }
})

app.post('/users/delete-user', isAdminMessage, async (req, res) => {
  const { userId } = req.body

  try {
    const userDeleted = await UserRepository.deleteUser({ userId })
    res.send({ userDeleted })
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(400).send({ err: error.message })
    } else {
      res.status(500).send({ err: 'Ha ocurrido un error inesperado.' })
    }
  }
})

app.get('/get-db-data', isAdminMessage, async (req, res) => {
  try {
    const challenges = await ChallengeRepository.getAllChallenges({ sorted: true, maxCharacters: 20 })
    const users = await UserRepository.getAllUsers({ sorted: true, catchDNI: true })

    res.send({ challenges, users })
  } catch (error) {
    res.status(500).send({ err: 'Ha ocurrido un error inesperado.' })
  }
})

app.use((_, res) => {
  res.status(404).send('Página no encontrada.')
})

app.listen(PORT, () => {
  console.log(`Servidor escuchando en ${SERVER_URL}:${PORT}`)
})
