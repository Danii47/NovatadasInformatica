import fs from 'node:fs'
import csv from 'csv-parser'
import nodemailer from 'nodemailer'
import { EMAIL_USER, EMAIL_APP_PASSWORD, WEB_URL, DISPLAY_NAME } from '../config.js'

export async function readCsv (csvFile, columnNames) {
  if (!fs.existsSync(csvFile)) {
    throw new Error(`No existe el fichero CSV: ${csvFile}`)
  }

  return new Promise((resolve, reject) => {
    const rows = []

    fs.createReadStream(csvFile, { encoding: 'utf-8' })
      .pipe(csv())
      .on('data', (row) => {
        rows.push(Object.fromEntries(columnNames.map((column) => [column, row[column]])))
      })
      .on('end', () => resolve(rows))
      .on('error', reject)
  })
}

// Un único transporte para todo el lote: abrir una conexión SMTP por correo es
// lo que hace que el envío de cien credenciales tarde una eternidad.
let transporter = null

function getTransporter () {
  if (!EMAIL_USER || !EMAIL_APP_PASSWORD) {
    throw new Error('Faltan EMAIL_USER o EMAIL_APP_PASSWORD en el fichero .env')
  }

  transporter ??= nodemailer.createTransport({
    service: 'gmail',
    pool: true,
    maxConnections: 3,
    auth: { user: EMAIL_USER, pass: EMAIL_APP_PASSWORD }
  })

  return transporter
}

export async function sendMail (fromEmail, toEmail, subject, body, displayName) {
  const mailOptions = {
    from: `"${displayName}" <${fromEmail}>`,
    to: toEmail,
    subject,
    html: body
  }

  try {
    await getTransporter().sendMail(mailOptions)
    console.log(`Correo enviado a ${toEmail}`)
  } catch (error) {
    console.error(`Error al enviar el correo a ${toEmail}:`, error.message)
  }
}

export function getEmailBody (userName, email, password, isAdmin) {
  const roleText = isAdmin
    ? 'Como <strong>veterano</strong> puedes gestionar retos y usuarios desde el apartado ADMIN. Comprueba que tus credenciales funcionan.'
    : 'Comprueba que puedes entrar y, si algo falla, avisa a cualquier veterano.'

  return `
    <html>
      <body style="margin:0;padding:0;background:#08080a;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#08080a;padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                style="max-width:520px;background:#141419;border:1px solid rgba(255,255,255,.12);border-radius:18px;overflow:hidden;">
                <tr>
                  <td style="height:4px;background:#ffe500;"></td>
                </tr>
                <tr>
                  <td style="padding:32px;font-family:'Trebuchet MS',Helvetica,Arial,sans-serif;color:#f5f5f7;">
                    <p style="margin:0 0 4px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#6c6c7a;">
                      ${DISPLAY_NAME}
                    </p>
                    <h1 style="margin:0 0 20px;font-size:28px;line-height:1.15;color:#ffe500;">
                      Bienvenido, ${userName}
                    </h1>

                    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#a5a5b2;">
                      Ya tienes cuenta en <a href="${WEB_URL}" style="color:#ffe500;">la web de las novatadas</a>.
                      Estas son tus credenciales:
                    </p>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                      style="background:#0d0d11;border:1px solid rgba(255,255,255,.10);border-radius:12px;margin-bottom:22px;">
                      <tr>
                        <td style="padding:14px 16px;font-size:12px;color:#6c6c7a;letter-spacing:.1em;text-transform:uppercase;">Usuario</td>
                        <td style="padding:14px 16px;font-size:15px;color:#f5f5f7;text-align:right;">${email}</td>
                      </tr>
                      <tr>
                        <td style="padding:14px 16px;border-top:1px solid rgba(255,255,255,.08);font-size:12px;color:#6c6c7a;letter-spacing:.1em;text-transform:uppercase;">Contraseña</td>
                        <td style="padding:14px 16px;border-top:1px solid rgba(255,255,255,.08);font-family:Consolas,monospace;font-size:16px;color:#ffe500;text-align:right;">${password}</td>
                      </tr>
                    </table>

                    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#a5a5b2;">${roleText}</p>

                    <a href="${WEB_URL}"
                      style="display:inline-block;background:#ffe500;color:#0a0a0c;font-weight:bold;font-size:15px;
                             padding:13px 28px;border-radius:999px;text-decoration:none;">
                      Entrar a la web
                    </a>

                    <p style="margin:26px 0 0;font-size:12px;color:#6c6c7a;">
                      Completa retos, suma puntos y pelea por el primer puesto del marcador.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}
