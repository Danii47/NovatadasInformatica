import cors from 'cors'

export const corsMiddleWare = () => cors({
  origin: (origin, cb) => {
    const ACCEPTED_ORIGINS = [
      'http://localhost:3000',
      'http://localhost:5137',
      'https://my-app.com'
    ]

    if (ACCEPTED_ORIGINS.includes(origin) || !origin) {
      return cb(null, true)
    }

    return cb(new Error('Not allowed by CORS'))
  }
})
