import express from 'express'
import { PORT, SECRET_JWT_KEY } from './config.js'
import { UserRepository } from './user-repository.js'
import { corsMiddleWare } from './middlewares/cors.js'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'
import { ChallengeRepository } from './challenge-repository.js'

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
    const token = jwt.sign({ id: user._id, name: user.name, auraPoints: user.auraPoints, isAdmin: user.isAdmin }, SECRET_JWT_KEY,
      {
        expiresIn: '1h'
      }
    )

    res
      .cookie('access_token', token, {
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

app.get('/challenges', (req, res) => {
  const { user } = req.session
  if (!user) return res.status(403).redirect('/')

  res.render('challenges', { loggedUser: user })
})

app.get('/admin-page', async (req, res) => {
  const { user } = req.session
  if (!user || !user.isAdmin) return res.status(403).redirect('/')

  const users = await UserRepository.getAllUsers({ sorted: true, catchDNI: true })
  const challenges = await ChallengeRepository.getAllChallenges({ sorted: true, maxCharacters: 20 })

  res.render('admin-page', { loggedUser: user, allUsers: users, allChallenges: challenges })
})

app.post('/create-challenge', async (req, res) => {
  const { user } = req.session
  if (!user || !user.isAdmin) return res.status(403).send('No autorizado')

  const { title, description, auraPoints } = req.body

  try {
    const id = await ChallengeRepository.create({ title, description, auraPoints })
    res.send({ id })
  } catch (error) {
    res.status(400).send({ err: error.message })
  }
})

app.get('/get-admin-data', async (req, res) => {
  const { user } = req.session
  if (!user || !user.isAdmin) return res.status(403).send('No autorizado')

  const challenges = await ChallengeRepository.getAllChallenges({ sorted: true, maxCharacters: 20 })
  const users = await UserRepository.getAllUsers({ sorted: true, catchDNI: true })

  res.send({ challenges, users })
})

app.use((req, res) => {
  res.status(404).send('Not found')
})

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`)
})
