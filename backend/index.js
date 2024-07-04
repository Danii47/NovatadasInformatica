import express from 'express'
import { PORT, SECRET_JWT_KEY } from './config.js'
import { UserRepository } from './user-repository.js'
import { corsMiddleWare } from './middlewares/cors.js'
import jwt from 'jsonwebtoken'

const app = express()

app.disable('x-powered-by')

app.set('view engine', 'ejs')
app.use(express.json())
app.use(corsMiddleWare())

app.get('/', (req, res) => {
  res.render('index')
})

app.post('/login', async (req, res) => {
  const { dni, password } = req.body
  try {
    const user = await UserRepository.login({ dni, password })
    const token = jwt.sign({ id: user._id, username: user.name, auraPoints: user.auraPoints, isAdmin: user.isAdmin }, SECRET_JWT_KEY)

    res.send(user)
  } catch (error) {
    res.status(401).send({ err: error.message })
  }
})

app.post('/register', async (req, res) => {
  const { name, dni, password } = req.body

  try {
    const id = await UserRepository.create({ name, dni, password })
    res.send({ id })
  } catch (error) {
    // Quitar info del error
    res.status(400).send(error.message)
  }
})

app.post('/logout', (req, res) => { })

app.get('/dashboard', (req, res) => {
  res.render('dashboard')
})

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`)
})
