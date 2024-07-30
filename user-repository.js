import crypto from 'node:crypto'

import DBLocal from 'db-local'
import bcrypt from 'bcrypt'

import { SALT_ROUNDS } from './config.js'
import { ChallengeRepository } from './challenge-repository.js'

const { Schema } = new DBLocal({ path: './db' })

const User = Schema('User', {
  _id: { type: String, required: true },
  dni: { type: String, required: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  pendingChallenges: { type: Array, required: true, default: [] },
  challenges: { type: Array, required: true, default: [] },
  points: { type: Number, required: true, default: 0 },
  isAdmin: { type: Boolean, required: true, default: false }
})

export class UserRepository {
  static async create ({ name, dni, password }) {
    Validation.name(name)
    Validation.dni(dni)
    Validation.password(password)

    const user = User.findOne({ dni })
    if (user) throw new Error('El usuario ya existe.')

    const id = crypto.randomUUID()
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

    User.create({
      _id: id,
      name,
      dni,
      password: hashedPassword,
      isAdmin: false
    }).save()

    return id
  }

  static async login ({ dni, password }) {
    Validation.dni(dni)
    Validation.password(password)

    const user = User.findOne({ dni })
    if (!user) throw new Error('El usuario o la contraseña son incorrectos.')

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) throw new Error('El usuario o la contraseña son incorrectos.')

    return {
      _id: user._id,
      name: user.name,
      points: user.points,
      challenges: user.challenges,
      isAdmin: user.isAdmin
    }
  }

  static async getAllUsers ({ sorted = false, catchDNI = false, showAdmins = false } = {}) {
    const users = await User.find(!showAdmins ? { isAdmin: showAdmins } : {})

    return users
      .sort((a, b) => sorted ? b.points - a.points : 0)
      .map(({ _id, name, challenges, pendingChallenges, points, dni }) => ({ _id, name, challenges, pendingChallenges, points, dni: catchDNI ? dni : undefined }))
  }

  static async getUserById ({ id }) {
    const user = User.findOne({ _id: id })

    if (!user) throw new Error('El usuario no existe.')

    return {
      _id: user._id,
      name: user.name,
      points: user.points,
      challenges: user.challenges,
      pendingChallenges: user.pendingChallenges,
      isAdmin: user.isAdmin
    }
  }

  static async addPoints ({ userId, challengeId }) {
    const user = User.findOne({ _id: userId })

    if (!user) throw new Error('El usuario no existe.')

    if (user.challenges.includes(challengeId)) throw new Error('El usuario ya ha completado este reto.')

    const challenge = await ChallengeRepository.getChallengeById({ id: challengeId })

    await user
      .update({
        points: user.points + challenge.points,
        challenges: [...user.challenges, challengeId]
      })
      .save()

    return challenge.points
  }

  static async requestCompleteChallenge ({ userId, challengeId }) {
    const user = User.findOne({ _id: userId })

    if (!user) throw new Error('El usuario no existe.')

    if (user.challenges.includes(challengeId)) throw new Error('Este reto ya ha sido completado.')
    if (user.pendingChallenges.includes(challengeId)) throw new Error('Este reto ya ha sido solicitado.')

    const challenge = await ChallengeRepository.getChallengeById({ id: challengeId })

    if (!challenge) throw new Error('El reto no existe.')

    await user
      .update({
        pendingChallenges: [...user.pendingChallenges, challengeId]
      })
      .save()

    return challengeId
  }

  static async getPendingAndCompletedChallenges ({ userId, pendingChallenges = true, completedChallenges = true }) {
    const user = User.findOne({ _id: userId })

    if (!user) throw new Error('El usuario no existe.')

    return { pendingChallenges: pendingChallenges ? user.pendingChallenges : null, completedChallenges: completedChallenges ? user.challenges : null }
  }
}

class Validation {
  static name (name) {
    if (typeof name !== 'string') throw new Error('El nombre debe ser una cadena de texto.')
  }

  static dni (dni) {
    if (typeof dni !== 'string') throw new Error('El DNI debe ser una cadena de texto.')
    if (!/^\d{8}[A-Z]$/.test(dni)) throw new Error('El DNI no tiene un formato válido.')

    const dniNumbers = dni.substring(0, 8)
    const letter = dni.charAt(8)
    const validLetters = 'TRWAGMYFPDXBNJZSQVHLCKE'
    const calculatedLetter = validLetters.charAt(parseInt(dniNumbers, 10) % 23)

    if (calculatedLetter !== letter) throw new Error('La letra del DNI no es correcta.')
  }

  static password (password) {
    if (typeof password !== 'string') throw new Error('La contraseña debe ser una cadena de texto.')
  }
}
