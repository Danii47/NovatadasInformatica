const {
  PORT = 3000,
  SERVER_URL = 'http://localhost',
  DISCORD_WEBHOOK_LOGIN,
  DISCORD_WEBHOOK_REQUEST_CHALLENGE,
  SALT_ROUNDS = 10,
  SECRET_JWT_KEY,
  MONGOOSE_CONNECT,
  NODE_ENV = 'development',
  EDITION = '26-27'
} = process.env

const IS_PRODUCTION = NODE_ENV === 'production'

// Sin secreto no se puede firmar nada: antes habia un valor por defecto publico
// en el repositorio, lo que permitia falsificar tokens de administrador.
if (!SECRET_JWT_KEY || SECRET_JWT_KEY.length < 32) {
  throw new Error('[CONFIG] Falta SECRET_JWT_KEY (minimo 32 caracteres) en el fichero .env')
}

if (!MONGOOSE_CONNECT) {
  throw new Error('[CONFIG] Falta MONGOOSE_CONNECT en el fichero .env')
}

export {
  PORT,
  SERVER_URL,
  DISCORD_WEBHOOK_LOGIN,
  DISCORD_WEBHOOK_REQUEST_CHALLENGE,
  SALT_ROUNDS,
  SECRET_JWT_KEY,
  MONGOOSE_CONNECT,
  NODE_ENV,
  IS_PRODUCTION,
  EDITION
}
