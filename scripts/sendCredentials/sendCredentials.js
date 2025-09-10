import { readCsv, sendMail, getEmailBody, generatePassword } from './functions/utils.js'
import { EMAIL_FROM, EMAIL_SUBJECT, DISPLAY_NAME } from './config.js'
import mongoose from 'mongoose'
import { MONGOOSE_CONNECT, SALT_ROUNDS } from '../../config.js'
import User from '../../schemas/User.js'
import bcrypt from 'bcrypt'

mongoose.connect(`${MONGOOSE_CONNECT}`)
  .then(() => {
    console.log('\x1b[36m', '\n[MONGO-DB] Conectado a DB ☁️', '\x1b[0m')
  }).catch((error) => {
    console.log('\x1b[31m', '\n[MONGO-DB] Ocurrio un error al intentar conectar la DB:\n', error, '\x1b[0m')
  })

const users = await readCsv('scripts/sendCredentials/CSV/NOVATOS_WEB_NOVATOS_2025-2026.csv', ['name', 'email', 'status'])

for (const { name, email, status } of users) {
  const password = generatePassword()

  const user = await User.findOne({ email })
  if (user) {
    console.log('\x1b[33m', `[MONGO-DB] El usuario ya existe: ${name}`, '\x1b[0m')
    continue
  }

  const hashedPassword = await bcrypt.hash(password, Number(SALT_ROUNDS))

  const newUser = new User({
    name,
    email,
    password: hashedPassword,
    isAdmin: status === 'admin'
  })

  await newUser.save()

  await sendMail(
    EMAIL_FROM,
    email,
    EMAIL_SUBJECT,
    getEmailBody(name, email, password, status === 'admin'),
    DISPLAY_NAME
  )

  console.log('\x1b[32m', `[MONGO-DB] Usuario creado: ${name} | Email: ${email} | Contraseña: ${password}`, '\x1b[0m')
}

console.log('\x1b[36m', '\n[FIN] Script finalizado.', '\x1b[0m')
process.exit(0)
