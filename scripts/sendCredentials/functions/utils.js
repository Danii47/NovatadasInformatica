import fs from 'fs'
import csv from 'csv-parser'
import nodemailer from 'nodemailer'
import { EMAIL_USER, EMAIL_APP_PASSWORD, WEB_URL } from '../config.js'

export async function readCsv (csvFile, columnNames) {
  return new Promise((resolve, reject) => {
    const rows = []

    fs.createReadStream(csvFile, { encoding: 'utf-8' })
      .pipe(csv())
      .on('data', (row) => {
        try {
          const values = columnNames.map((col) => row[col])
          rows.push(Object.fromEntries(columnNames.map((c, i) => [c, values[i]])))
        } catch (err) {
          console.error(`Column name not found in CSV file. ${err}`)
        }
      })
      .on('end', () => resolve(rows))
      .on('error', reject)
  })
}

export async function sendMail (fromEmail, toEmail, subject, body, displayName) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_APP_PASSWORD
    }
  })

  const mailOptions = {
    from: `"${displayName}" <${fromEmail}>`,
    to: toEmail,
    subject,
    html: body
  }

  try {
    await transporter.sendMail(mailOptions)
    console.log(`Correo enviado a ${toEmail}`)
  } catch (error) {
    console.error('Error al enviar correo:', error)
  }
}

export function getEmailBody (userName, email, password, isAdmin) {
  return `
    <html>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com/" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@100..900&display=swap" rel="stylesheet">
      </head>
      <body style="color: black; font-family: 'Trebuchet MS', sans-serif; font-size: 1.3rem">
        <p>Hola <strong>${userName}</strong>,</p>
        <p>Te damos la bienvenida a <a href="${WEB_URL}">Novatadas Informática</a>. Aquí tienes tus credenciales de acceso:</p>
        <ol>
          <li><strong>Usuario:</strong> ${email}</li>
          <li><strong>Contraseña:</strong> ${password}</li>
        </ol>
        ${
          isAdmin
            ? '<p>Como administrador, puedes gestionar los retos y usuarios en la plataforma desde el apartado ADMIN. Asegúrate de que tus credenciales de acceso funcionan correctamente.</p>'
            : '<p>Como usuario, puedes acceder a los retos y participar en la plataforma. Por el momento comprueba que tus credenciales funcionan correctamente y en caso contrario notifícalo a algún veterano.</p>'
        }
        <p>¡Disfruta de la experiencia!</p>
      </body>
    </html>
  `
}

export function generatePassword (length = 8) {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let contrasena = ''

  for (let i = 0; i < length; i++) {
    const indice = Math.floor(Math.random() * caracteres.length)
    contrasena += caracteres[indice]
  }

  return contrasena
}
