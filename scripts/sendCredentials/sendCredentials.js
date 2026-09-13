/**
 * Alta masiva desde un CSV con envío de credenciales por correo.
 *
 * Uso:
 *   npm run send-credentials -- <ruta-del-csv> [--dry-run] [--no-mail]
 *
 * El CSV necesita las columnas `name`, `email` y, opcionalmente, `status`
 * (`admin` para dar de alta a un veterano).
 *
 * Para altas sin correo, el panel de Gestión de la web hace lo mismo pegando
 * la lista en el navegador; este script existe para cuando hay que avisar a
 * todo el mundo por email.
 */
import { readCsv, sendMail, getEmailBody } from './functions/utils.js'
import { EMAIL_FROM, EMAIL_SUBJECT, DISPLAY_NAME } from './config.js'
import mongoose from 'mongoose'
import { MONGOOSE_CONNECT, SALT_ROUNDS } from '../../config.js'
import { generatePassword } from '../../utils/generatePassword.js'
import User from '../../schemas/User.js'
import bcrypt from 'bcrypt'

const args = process.argv.slice(2)
const flags = new Set(args.filter((arg) => arg.startsWith('--')))
const csvPath = args.find((arg) => !arg.startsWith('--'))

const dryRun = flags.has('--dry-run')
const skipMail = flags.has('--no-mail') || dryRun

if (!csvPath) {
  console.error('\x1b[31m', 'Falta la ruta del CSV.\n  npm run send-credentials -- ruta/al/fichero.csv [--dry-run] [--no-mail]', '\x1b[0m')
  process.exit(1)
}

const log = {
  info: (message) => console.log('\x1b[36m', message, '\x1b[0m'),
  warn: (message) => console.log('\x1b[33m', message, '\x1b[0m'),
  ok: (message) => console.log('\x1b[32m', message, '\x1b[0m'),
  error: (message) => console.log('\x1b[31m', message, '\x1b[0m')
}

try {
  await mongoose.connect(`${MONGOOSE_CONNECT}`)
  log.info('\n[MONGO-DB] Conectado a DB ☁️')
} catch (error) {
  log.error(`\n[MONGO-DB] No se pudo conectar: ${error.message}`)
  process.exit(1)
}

const rows = await readCsv(csvPath, ['name', 'email', 'status'])

if (rows.length === 0) {
  log.warn(`[CSV] ${csvPath} no tiene filas utilizables.`)
  process.exit(0)
}

if (dryRun) log.warn('[MODO PRUEBA] No se creará ningún usuario ni se enviará ningún correo.\n')

const created = []
const skipped = []

for (const { name, email, status } of rows) {
  const cleanName = (name ?? '').trim()
  const cleanEmail = (email ?? '').trim().toLowerCase()
  const isAdmin = status === 'admin'

  if (!cleanName || !cleanEmail) {
    skipped.push({ email: cleanEmail || '(sin correo)', reason: 'Fila incompleta' })
    log.warn(`[OMITIDO] Fila incompleta: ${JSON.stringify({ name, email })}`)
    continue
  }

  if (await User.findOne({ email: cleanEmail })) {
    skipped.push({ email: cleanEmail, reason: 'Ya existe' })
    log.warn(`[OMITIDO] El usuario ya existe: ${cleanName} <${cleanEmail}>`)
    continue
  }

  const password = generatePassword()

  if (!dryRun) {
    const hashedPassword = await bcrypt.hash(password, Number(SALT_ROUNDS))

    await new User({
      name: cleanName,
      email: cleanEmail,
      password: hashedPassword,
      isAdmin
    }).save()
  }

  if (!skipMail) {
    await sendMail(
      EMAIL_FROM,
      cleanEmail,
      EMAIL_SUBJECT,
      getEmailBody(cleanName, cleanEmail, password, isAdmin),
      DISPLAY_NAME
    )
  }

  created.push({ name: cleanName, email: cleanEmail, password, isAdmin })
  log.ok(`[CREADO] ${cleanName} | ${cleanEmail} | ${password}${isAdmin ? ' | admin' : ''}`)
}

console.log()
log.info(`[FIN] ${created.length} creados · ${skipped.length} omitidos${skipMail ? ' · sin enviar correos' : ''}`)

// Copia de seguridad por si el correo no llega: las contraseñas ya no se pueden recuperar.
if (created.length > 0 && !dryRun) {
  const csv = ['name;email;password;status', ...created.map((user) =>
    `${user.name};${user.email};${user.password};${user.isAdmin ? 'admin' : 'novato'}`)].join('\n')

  const { writeFileSync } = await import('node:fs')
  const backupPath = `credenciales-${new Date().toISOString().slice(0, 10)}.csv`
  // BOM para que Excel abra el CSV como UTF-8 y no destroce las tildes.
  writeFileSync(backupPath, '\uFEFF' + csv, 'utf8')
  log.info(`[FIN] Copia de las credenciales en ${backupPath}`)
}

await mongoose.disconnect()
process.exit(0)
