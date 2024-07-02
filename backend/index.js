import express from 'express'
import { PORT } from './config.js'
import { UserRepository } from './user-repository.js'

const app = express()

app.disable('x-powered-by')

app.set('view engine', 'ejs')
app.use(express.json())

app.get('/', (req, res) => {
  res.render('example', { name: 'mariquita' })
})

app.post('/login', async (req, res) => {
  const { dni, password } = req.body

  try {
    const user = await UserRepository.login({ dni, password })
    res.send(user)
  } catch (error) {
    res.status(401).send(error.message)
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

app.get('/protected', (req, res) => { })

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`)
})
