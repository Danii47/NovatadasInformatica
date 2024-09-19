import bcrypt from 'bcrypt'

import { SALT_ROUNDS } from './config.js'
import { ChallengeRepository } from './challenge-repository.js'
import User from './schemas/User.js'
import { ChallengeAlreadyAcceptedError, ChallengeAlreadyCompletedError, ChallengeAlreadyPendingError, ChallengeNotFoundError, ChallengeNotRequestedError, InvalidCredentialsError, UserAlreadyAdministratorError, UserAlreadyExistsError, UserNotFoundError, ValidationError } from './errors.js'
import { getTotalPoints } from './utils/getTotalPoints.js'

export class UserRepository {
  static async create ({ name, dni, password }) {
    Validation.name(name)
    Validation.dni(dni)
    Validation.password(password)

    const user = await User.findOne({ dni })
    if (user) throw new UserAlreadyExistsError('El usuario ya existe.')

    const hashedPassword = await bcrypt.hash(password, Number(SALT_ROUNDS))

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
    if (!user) throw new InvalidCredentialsError('El usuario o la contraseña son incorrectos.')

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) throw new InvalidCredentialsError('El usuario o la contraseña son incorrectos.')

    return {
      id: user._id,
      name: user.name,
      points: user.points,
      isAdmin: user.isAdmin,
      isSuperAdmin: user.isSuperAdmin
    }
  }

  static async getAllUsers ({ sorted = false, catchDNI = false, showAdmins = false } = {}) {
    const users = await User.find(!showAdmins ? { isAdmin: showAdmins } : {})

    return users
      .sort((a, b) => {
        if (sorted) {
          // Sort by points and then, length of pendingChallenges and then, by name
          if (a.points !== b.points) return b.points - a.points
          else if (a.pendingChallenges.length !== b.pendingChallenges.length) return b.pendingChallenges.length - a.pendingChallenges.length
          return a.name.localeCompare(b.name)
        } else return 0
      })
      .map(({ _id, name, challenges, pendingChallenges, extraPoints, points, isExtraWinner, dni }) => ({ id: _id, name, challenges, pendingChallenges, extraPoints, points, isExtraWinner, dni: catchDNI ? dni : undefined }))
  }

  static async getUserById ({ id }) {
    const user = await User.findOne({ _id: id })

    if (!user) throw new UserNotFoundError('El usuario no existe.')

    return {
      _id: user._id,
      name: user.name,
      points: user.points,
      challenges: user.challenges,
      pendingChallenges: user.pendingChallenges,
      extraPoints: user.extraPoints,
      isAdmin: user.isAdmin
    }
  }

  static async addPoints ({ userId, challengeId }) {
    const user = await User.findOne({ _id: userId })

    if (!user) throw new UserNotFoundError('El usuario no existe.')

    if (user.challenges.includes(challengeId)) throw new ChallengeAlreadyCompletedError('El usuario ya ha completado este reto.')

    const challenge = await ChallengeRepository.getChallengeById({ id: challengeId })

    await user
      .updateOne({
        points: user.points + challenge.points,
        challenges: [...user.challenges, challengeId]
      })

    return challenge.points
  }

  static async addExtraPoints ({ userId, extraPointsText, extraPoints }) {
    const user = await User.findOne({ _id: userId })

    if (!user) throw new UserNotFoundError('El usuario no existe.')

    await user
      .updateOne({
        extraPoints: [...user.extraPoints, { name: extraPointsText, points: extraPoints }],
        points: user.points + extraPoints
      })

    return extraPoints
  }

  static async requestCompleteChallenge ({ userId, challengeId }) {
    const user = await User.findOne({ _id: userId })

    if (!user) throw new UserNotFoundError('El usuario no existe.')

    const challenge = await ChallengeRepository.getChallengeById({ id: challengeId })
    if (!challenge) throw new ChallengeNotFoundError('El reto no existe.')

    if (user.challenges.includes(challengeId)) throw new ChallengeAlreadyAcceptedError('Este reto ya ha sido completado.')
    if (user.pendingChallenges.includes(challengeId)) throw new ChallengeAlreadyPendingError('Este reto ya ha sido solicitado.')

    await user
      .updateOne({
        pendingChallenges: [...user.pendingChallenges, challengeId]
      })

    return challenge
  }

  static async getPendingAndCompletedChallenges ({ userId, pendingChallenges = true, completedChallenges = true }) {
    const user = await User.findOne({ _id: userId })

    if (!user) throw new UserNotFoundError('El usuario no existe.')

    return { pendingChallenges: pendingChallenges ? user.pendingChallenges : null, completedChallenges: completedChallenges ? user.challenges : null }
  }

  static async acceptChallengeCompleted ({ userId, challengeId }) {
    const user = await User.findOne({ _id: userId })

    if (!user) throw new UserNotFoundError('El usuario no existe.')

    const challenge = await ChallengeRepository.getChallengeById({ id: challengeId })
    if (!challenge) throw new ChallengeNotFoundError('El reto no existe.')

    if (!user.pendingChallenges.includes(challengeId)) throw new ChallengeNotRequestedError('El reto no ha sido solicitado.')

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

    if (!user) throw new UserNotFoundError('El usuario no existe.')

    if (!user.pendingChallenges.includes(challengeId)) throw new ChallengeNotRequestedError('El reto no ha sido solicitado.')

    await user
      .updateOne({
        pendingChallenges: user.pendingChallenges.filter(id => id !== challengeId)
      })

    return challengeId
  }

  static async becomeAdministrator ({ userId }) {
    const user = await User.findOne({ _id: userId })

    if (!user) throw new UserNotFoundError('El usuario no existe.')
    if (user.isAdmin) throw new UserAlreadyAdministratorError('El usuario ya es administrador.')

    await user.updateOne({ isAdmin: true })

    return userId
  }

  static async deleteUser ({ userId }) {
    const user = await User.findOne({ _id: userId })
    if (!user) throw new UserNotFoundError('El usuario no existe.')

    await user.deleteOne()

    return userId
  }

  static async spinExtraPrize () {
    const users = (await UserRepository.getAllUsers({ sorted: true, showAdmins: false, catchDNI: false }))
      .filter((user) => !user.isExtraWinner)

    const totalPoints = getTotalPoints({ users, start: 2 })
    const randomNumber = Math.random() * totalPoints
    let count = 0

    for (let i = 2; i < users.length; i++) {
      count += users[i].points
      if (randomNumber <= count) {
        await User.findOneAndUpdate({ _id: users[i].id }, { isExtraWinner: true })
        return users[i]
      }
    }

    return null
  }
}

class Validation {
  static name (name) {
    if (typeof name !== 'string') throw new ValidationError('El nombre debe ser una cadena de texto.')
  }

  static dni (dni) {
    if (typeof dni !== 'string') throw new ValidationError('El DNI debe ser una cadena de texto.')
    if (dni.length !== 5) throw new ValidationError('El DNI debe tener 5 caracteres.')
    if (!Number(dni)) throw new ValidationError('El DNI debe ser un número.')
    // if (!/^\d{8}[A-Z]$/.test(dni)) throw new Error('El DNI no tiene un formato válido.')

    // const dniNumbers = dni.substring(0, 8)
    // const letter = dni.charAt(8)
    // const validLetters = 'TRWAGMYFPDXBNJZSQVHLCKE'
    // const calculatedLetter = validLetters.charAt(parseInt(dniNumbers, 10) % 23)

    // if (calculatedLetter !== letter) throw new Error('La letra del DNI no es correcta.')
  }

  static password (password) {
    if (typeof password !== 'string') throw new ValidationError('La contraseña debe ser una cadena de texto.')
  }
}
