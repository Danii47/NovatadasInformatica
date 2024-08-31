import bcrypt from 'bcrypt'

import { SALT_ROUNDS } from './config.js'
import { ChallengeRepository } from './challenge-repository.js'
import User from './schemas/User.js'

export class UserRepository {
  static async create ({ name, dni, password }) {
    Validation.name(name)
    Validation.dni(dni)
    Validation.password(password)

    const user = await User.findOne({ dni })
    if (user) throw new Error('El usuario ya existe.')

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

    const newUser = new User({
      name,
      dni,
      password: hashedPassword,
      isAdmin: false
    })

    await newUser.save()

    return newUser._id
  }

  static async login ({ dni, password }) {
    Validation.dni(dni)
    Validation.password(password)

    const user = await User.findOne({ dni })
    if (!user) throw new Error('El usuario o la contraseña son incorrectos.')

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) throw new Error('El usuario o la contraseña son incorrectos.')

    return {
      id: user._id,
      name: user.name,
      points: user.points,
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
    const user = await User.findOne({ _id: id })

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
    const user = await User.findOne({ _id: userId })

    if (!user) throw new Error('El usuario no existe.')

    if (user.challenges.includes(challengeId)) throw new Error('El usuario ya ha completado este reto.')

    const challenge = await ChallengeRepository.getChallengeById({ id: challengeId })

    await user
      .updateOne({
        points: user.points + challenge.points,
        challenges: [...user.challenges, challengeId]
      })

    return challenge.points
  }

  static async requestCompleteChallenge ({ userId, challengeId }) {
    const user = await User.findOne({ _id: userId })

    if (!user) throw new Error('El usuario no existe.')

    if (user.challenges.includes(challengeId)) throw new Error('Este reto ya ha sido completado.')
    if (user.pendingChallenges.includes(challengeId)) throw new Error('Este reto ya ha sido solicitado.')

    const challenge = await ChallengeRepository.getChallengeById({ id: challengeId })

    if (!challenge) throw new Error('El reto no existe.')

    await user
      .updateOne({
        pendingChallenges: [...user.pendingChallenges, challengeId]
      })

    return challengeId
  }

  static async getPendingAndCompletedChallenges ({ userId, pendingChallenges = true, completedChallenges = true }) {
    const user = await User.findOne({ _id: userId })

    if (!user) throw new Error('El usuario no existe.')

    return { pendingChallenges: pendingChallenges ? user.pendingChallenges : null, completedChallenges: completedChallenges ? user.challenges : null }
  }

  static async acceptChallengeCompleted ({ userId, challengeId }) {
    const user = await User.findOne({ _id: userId })

    if (!user) throw new Error('El usuario no existe.')

    if (!user.pendingChallenges.includes(challengeId)) throw new Error('El reto no ha sido solicitado.')

    const challenge = await ChallengeRepository.getChallengeById({ id: challengeId })

    if (!challenge) throw new Error('El reto no existe.')

    await user
      .updateOne({
        pendingChallenges: user.pendingChallenges.filter(id => id !== challengeId),
        challenges: [...user.challenges, challengeId],
        points: user.points + challenge.points
      })

    return challengeId
  }

  static async rejectChallengeCompleted ({ userId, challengeId }) {
    const user = await User.findOne({ _id: userId })

    if (!user) throw new Error('El usuario no existe.')

    if (!user.pendingChallenges.includes(challengeId)) throw new Error('El reto no ha sido solicitado.')

    await user
      .updateOne({
        pendingChallenges: user.pendingChallenges.filter(id => id !== challengeId)
      })

    return challengeId
  }
}

class Validation {
  static name (name) {
    if (typeof name !== 'string') throw new Error('El nombre debe ser una cadena de texto.')
  }

  static dni (dni) {
    if (typeof dni !== 'string') throw new Error('El DNI debe ser una cadena de texto.')
    if (dni.length !== 5) throw new Error('El DNI debe tener 5 caracteres.')
    if (!Number(dni)) throw new Error('El DNI debe ser un número.')
    // if (!/^\d{8}[A-Z]$/.test(dni)) throw new Error('El DNI no tiene un formato válido.')

    // const dniNumbers = dni.substring(0, 8)
    // const letter = dni.charAt(8)
    // const validLetters = 'TRWAGMYFPDXBNJZSQVHLCKE'
    // const calculatedLetter = validLetters.charAt(parseInt(dniNumbers, 10) % 23)

    // if (calculatedLetter !== letter) throw new Error('La letra del DNI no es correcta.')
  }

  static password (password) {
    if (typeof password !== 'string') throw new Error('La contraseña debe ser una cadena de texto.')
  }
}
