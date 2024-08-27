import express from 'express'
import { PORT, SECRET_JWT_KEY, MONGOOSE_CONNECT } from './config.js'
import { UserRepository } from './user-repository.js'
import { ChallengeRepository } from './challenge-repository.js'
import { corsMiddleWare } from './middlewares/cors.js'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'
import mongoose from 'mongoose'

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
  } catch { }

  next()
})

app.get('/', (req, res) => {
  const { user } = req.session
  if (user) return res.redirect('/scoreboard')
  res.render('index')
})

app.post('/login', async (req, res) => {
  const { dni, password } = req.body
  try {
    const user = await UserRepository.login({ dni, password })
    const accessToken = jwt.sign({ ...user }, SECRET_JWT_KEY,
      {
        expiresIn: '1h'
      }
    )

    res
      .cookie('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60
      })
      .send(user)
  } catch (error) {
    res.status(401).send({ err: error.message })
  }
})

app.post('/register', async (req, res) => {
  const { user } = req.session
  if (!user || !user.isAdmin) return res.status(403).send('No autorizado')

  const { name, dni, password } = req.body

  try {
    const id = await UserRepository.create({ name, dni, password })
    res.send({ id })
  } catch (error) {
    res.status(400).send({ err: error.message })
  }
})

app.post('/logout', (req, res) => {
  res.clearCookie('access_token').redirect('/')
})

app.get('/scoreboard', async (req, res) => {
  const { user } = req.session
  if (!user) return res.status(403).redirect('/')

  const users = await UserRepository.getAllUsers({ sorted: true })

  res.render('scoreboard', { loggedUser: user, allUsers: users })
})

app.get('/challenges', async (req, res) => {
  const { user } = req.session
  if (!user) return res.status(403).redirect('/')

  const challenges = await ChallengeRepository.getAllChallenges({ sorted: true })
  const { pendingChallenges, completedChallenges } = await UserRepository.getPendingAndCompletedChallenges({ userId: user.id })

  res.render('challenges', { loggedUser: user, allChallenges: challenges, pendingChallenges, completedChallenges })
})

app.post('/challenges/request-complete-challenge', async (req, res) => {
  const { user } = req.session
  if (!user) return res.status(403).send('No autorizado')

  const { userId, challengeId } = req.body
  console.log({ userId, challengeId })
  try {
    const pendingChallengeAdded = await UserRepository.requestCompleteChallenge({ userId, challengeId })
    res.send({ pendingChallengeAdded })
  } catch (error) {
    res.status(400).send({ err: error.message })
  }
})

app.post('/challenges/reject-challenge-completed', async (req, res) => {
  const { user } = req.session
  if (!user || !user.isAdmin) return res.status(403).send('No autorizado')

  const { userId, challengeId } = req.body

  try {
    console.log({ userId, challengeId })
    const challengeRejected = await UserRepository.rejectChallengeCompleted({ userId, challengeId })
    res.send({ challengeRejected })
  } catch (error) {
    res.status(400).send({ err: error.message })
  }
})

app.post('/challenges/accept-challenge-completed', async (req, res) => {
  const { user } = req.session
  if (!user || !user.isAdmin) return res.status(403).send('No autorizado')

  const { userId, challengeId } = req.body

  try {
    const challengeAccepted = await UserRepository.acceptChallengeCompleted({ userId, challengeId })
    res.send({ challengeAccepted })
  } catch (error) {
    res.status(400).send({ err: error.message })
  }
})

app.get('/admin-page', async (req, res) => {
  const { user } = req.session
  if (!user || !user.isAdmin) return res.status(403).redirect('/')

  const users = await UserRepository.getAllUsers({ sorted: true, catchDNI: true })
  const challenges = await ChallengeRepository.getAllChallenges({ sorted: true, maxCharacters: 20 })

  res.render('admin-page', { loggedUser: user, allUsers: users, allChallenges: challenges })
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
    res.status(403).redirect('/')
  }
})

app.post('/add-points', async (req, res) => {
  const { user } = req.session
  if (!user || !user.isAdmin) return res.status(403).send('No autorizado')

  const { userId, challengeId } = req.body

  try {
    const newPoints = await UserRepository.addPoints({ userId, challengeId })

    res.send({ points: newPoints })
  } catch (error) {
    res.status(400).send({ err: error.message })
  }
})

app.post('/create-challenge', async (req, res) => {
  const { user } = req.session
  if (!user || !user.isAdmin) return res.status(403).send('No autorizado')

  const { title, description, points } = req.body

  try {
    const id = await ChallengeRepository.create({ title, description, points })
    res.send({ id })
  } catch (error) {
    res.status(400).send({ err: error.message })
  }
})

app.post('/challenges/delete-challenge', async (req, res) => {
  const { user } = req.session
  if (!user || !user.isAdmin) return res.status(403).send('No autorizado')

  const { challengeId } = req.body

  try {
    const challengeDeleted = await ChallengeRepository.deleteChallenge({ challengeId })
    res.send({ challengeDeleted })
  } catch (error) {
    res.status(400).send({ err: error.message })
  }
})

app.get('/get-db-data', async (req, res) => {
  const { user } = req.session
  if (!user || !user.isAdmin) return res.status(403).send('No autorizado')

  const challenges = await ChallengeRepository.getAllChallenges({ sorted: true, maxCharacters: 20 })
  const users = await UserRepository.getAllUsers({ sorted: true, catchDNI: true })

  res.send({ challenges, users })
})

app.use((req, res) => {
  res.status(404).send('Página no encontrada.')
})

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`)
})
