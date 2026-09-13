import { EDITION } from '../../config.js'

export const {
  EMAIL_USER,
  DISPLAY_NAME = 'Novatadas Informática',
  EMAIL_APP_PASSWORD,
  EMAIL_FROM = 'correo@example.com',
  EMAIL_SUBJECT = `Novatadas Informática ${EDITION}: credenciales de acceso`,
  WEB_URL = 'https://novatadasinformatica.onrender.com'
} = process.env
