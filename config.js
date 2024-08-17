export const {
  PORT = 3000,
  SALT_ROUNDS = 10,
  SECRET_JWT_KEY = 'this-is-an-awesome-secret-key-please-change-it-in-production',
  MONGOOSE_CONNECT
} = process.env
