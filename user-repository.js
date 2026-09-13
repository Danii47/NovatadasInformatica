import bcrypt from 'bcrypt'

import { SALT_ROUNDS } from './config.js'
import { ChallengeRepository } from './challenge-repository.js'
import User from './schemas/User.js'
import { ChallengeAlreadyAcceptedError, ChallengeAlreadyCompletedError, ChallengeAlreadyPendingError, ChallengeNotFoundError, ChallengeNotRequestedError, ForbiddenActionError, InvalidCredentialsError, UserAlreadyAdministratorError, UserAlreadyExistsError, UserNotFoundError, ValidationError } from './errors.js'
import { getTotalPoints } from './utils/getTotalPoints.js'
import { generatePassword } from './utils/generatePassword.js'

// Hash válido de una contraseña que nadie usa, para igualar tiempos en el login.
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8eQ6i5yQ0dQ8sQ0cV2aQp0kq3qPu9W'

const normalizeEmail = (email) => typeof email === 'string' ? email.trim().toLowerCase() : email

export class UserRepository {
  static async create ({ name, email, password, isAdmin = false }) {
    const cleanName = typeof name === 'string' ? name.trim() : name
    const cleanEmail = normalizeEmail(email)

    Validation.name(cleanName)
    Validation.email(cleanEmail)
    Validation.password(password)

    const user = await User.findOne({ email: cleanEmail })
    if (user) throw new UserAlreadyExistsError('El usuario ya existe.')

    const hashedPassword = await bcrypt.hash(password, Number(SALT_ROUNDS))

    const newUser = new User({
      name: cleanName,
      email: cleanEmail,
      password: hashedPassword,
      isAdmin: Boolean(isAdmin)
    })

    await newUser.save()

    return newUser._id
  }

  /**
   * Alta masiva para la migración de cada curso. Nunca aborta a mitad: cada
   * fila que falla se devuelve en `skipped` con el motivo, para que el
   * administrador vea exactamente qué ha entrado y qué no.
   *
   * @param {Array<{ name: string, email: string, password?: string, isAdmin?: boolean }>} users
   */
  static async createMany ({ users }) {
    if (!Array.isArray(users)) throw new ValidationError('Se esperaba una lista de usuarios.')
    if (users.length === 0) throw new ValidationError('La lista de usuarios está vacía.')
    if (users.length > 500) throw new ValidationError('Máximo 500 usuarios por importación.')

    const created = []
    const skipped = []
    const seenEmails = new Set()

    for (const [index, row] of users.entries()) {
      const line = index + 1
      const name = typeof row?.name === 'string' ? row.name.trim() : ''
      const email = normalizeEmail(row?.email ?? '')
      const isAdmin = Boolean(row?.isAdmin)
      const password = typeof row?.password === 'string' && row.password.length > 0
        ? row.password
        : generatePassword()

      try {
        if (seenEmails.has(email)) throw new UserAlreadyExistsError('Duplicado dentro de la propia lista.')
        seenEmails.add(email)

        await UserRepository.create({ name, email, password, isAdmin })
        created.push({ line, name, email, password, isAdmin })
      } catch (error) {
        skipped.push({ line, name, email, reason: error.message })
      }
    }

    return { created, skipped }
  }

  static async login ({ email, password }) {
    const cleanEmail = normalizeEmail(email)

    Validation.email(cleanEmail)
    Validation.password(password)

    const user = await User.findOne({ email: cleanEmail })

    // Se compara siempre contra un hash (real o señuelo) para que el tiempo de
    // respuesta no revele si el correo existe en la base de datos.
    const hash = user?.password ?? DUMMY_HASH
    const isValid = await bcrypt.compare(password, hash)

    if (!user || !isValid) throw new InvalidCredentialsError('El usuario o la contraseña son incorrectos.')

    return {
      id: user._id.toString(),
      name: user.name,
      points: user.points,
      isAdmin: user.isAdmin,
      isSuperAdmin: user.isSuperAdmin
    }
  }

  /**
   * Datos de sesión leídos de la base en cada petición, para que un cambio de
   * rol o un borrado tengan efecto inmediato y no cuando caduque el token.
   */
  static async getSessionUser ({ id }) {
    const user = await User.findById(id).select('name points isAdmin isSuperAdmin').lean()
    if (!user) return null

    return {
      id: user._id.toString(),
      name: user.name,
      points: user.points,
      isAdmin: user.isAdmin,
      isSuperAdmin: user.isSuperAdmin
    }
  }

  static async getAllUsers ({ sorted = false, catchEmail = false, showAdmins = false } = {}) {
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
      .map(({ _id, name, challenges, pendingChallenges, extraPoints, points, isExtraWinner, email, isAdmin, isSuperAdmin }) => ({
        id: _id.toString(),
        name,
        challenges,
        pendingChallenges,
        extraPoints,
        points,
        isExtraWinner,
        isAdmin,
        isSuperAdmin,
        email: catchEmail ? email : undefined
      }))
  }

  static async countUsers () {
    const [total, admins, superAdmins] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isAdmin: true }),
      User.countDocuments({ isSuperAdmin: true })
    ])

    return { total, admins, superAdmins, rookies: total - admins }
  }

  static async getUserById ({ id }) {
    const user = await User.findOne({ _id: id })

    if (!user) throw new UserNotFoundError('El usuario no existe.')

    return {
      _id: user._id.toString(),
      name: user.name,
      points: user.points,
      challenges: user.challenges,
      pendingChallenges: user.pendingChallenges,
      extraPoints: user.extraPoints,
      isAdmin: user.isAdmin,
      isSuperAdmin: user.isSuperAdmin
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
        challenges: [...user.challenges, challengeId],
        pendingChallenges: user.pendingChallenges.filter(id => id !== challengeId)
      })

    return { points: challenge.points, userName: user.name, challengeTitle: challenge.title }
  }

  static async addExtraPoints ({ userId, extraPointsText, extraPoints }) {
    const points = Number(extraPoints)

    if (!Number.isFinite(points)) throw new ValidationError('Los puntos extra deben ser un número.')
    if (typeof extraPointsText !== 'string' || extraPointsText.trim().length === 0) throw new ValidationError('El texto de los puntos extra es obligatorio.')

    const user = await User.findOne({ _id: userId })

    if (!user) throw new UserNotFoundError('El usuario no existe.')

    await user
      .updateOne({
        extraPoints: [...user.extraPoints, { name: extraPointsText.trim(), points }],
        points: user.points + points
      })

    return { points, userName: user.name }
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

    return { challengeId, userName: user.name, challengeTitle: challenge.title, points: challenge.points }
  }

  static async rejectChallengeCompleted ({ userId, challengeId }) {
    const user = await User.findOne({ _id: userId })

    if (!user) throw new UserNotFoundError('El usuario no existe.')

    if (!user.pendingChallenges.includes(challengeId)) throw new ChallengeNotRequestedError('El reto no ha sido solicitado.')

    await user
      .updateOne({
        pendingChallenges: user.pendingChallenges.filter(id => id !== challengeId)
      })

    return { challengeId, userName: user.name }
  }

  static async becomeAdministrator ({ userId }) {
    const user = await User.findOne({ _id: userId })

    if (!user) throw new UserNotFoundError('El usuario no existe.')
    if (user.isAdmin) throw new UserAlreadyAdministratorError('El usuario ya es administrador.')

    await user.updateOne({ isAdmin: true })

    return { userId, userName: user.name }
  }

  static async revokeAdministrator ({ userId }) {
    const user = await User.findOne({ _id: userId })

    if (!user) throw new UserNotFoundError('El usuario no existe.')
    if (user.isSuperAdmin) throw new ForbiddenActionError('No se puede degradar a un super administrador.')
    if (!user.isAdmin) throw new ValidationError('El usuario no es administrador.')

    await user.updateOne({ isAdmin: false })

    return { userId, userName: user.name }
  }

  static async resetPassword ({ userId }) {
    const user = await User.findOne({ _id: userId })
    if (!user) throw new UserNotFoundError('El usuario no existe.')

    const password = generatePassword()
    const hashedPassword = await bcrypt.hash(password, Number(SALT_ROUNDS))

    await user.updateOne({ password: hashedPassword })

    return { userName: user.name, email: user.email, password }
  }

  /**
   * @param {string} userId       usuario a borrar
   * @param {string} requestedBy  id de quien pide el borrado
   */
  static async deleteUser ({ userId, requestedBy }) {
    const user = await User.findOne({ _id: userId })
    if (!user) throw new UserNotFoundError('El usuario no existe.')

    if (user._id.toString() === String(requestedBy)) throw new ForbiddenActionError('No puedes borrar tu propia cuenta.')
    if (user.isSuperAdmin) throw new ForbiddenActionError('No se puede borrar a un super administrador.')

    await user.deleteOne()

    return { userId, userName: user.name }
  }

  /**
   * Borrado masivo de fin de curso. Siempre conserva a quien lanza la acción y
   * a todos los super administradores; opcionalmente también a los admins.
   *
   * @param {string}  requestedBy  id del super admin que ejecuta la limpieza
   * @param {boolean} keepAdmins   si es true, los administradores sobreviven
   */
  static async deleteAllUsersExcept ({ requestedBy, keepAdmins = true }) {
    if (!requestedBy) throw new ForbiddenActionError('No se ha podido identificar al solicitante.')

    const filter = {
      _id: { $ne: requestedBy },
      isSuperAdmin: { $ne: true }
    }

    if (keepAdmins) filter.isAdmin = { $ne: true }

    const victims = await User.find(filter).select('name email').lean()
    const { deletedCount } = await User.deleteMany(filter)

    return {
      deletedCount,
      deletedUsers: victims.map(({ name, email }) => ({ name, email }))
    }
  }

  /** Deja a todo el mundo a cero sin borrar las cuentas. */
  static async resetAllProgress () {
    const { modifiedCount } = await User.updateMany(
      { isSuperAdmin: { $ne: true } },
      { $set: { points: 0, challenges: [], pendingChallenges: [], extraPoints: [], isExtraWinner: false } }
    )

    return modifiedCount
  }

  static async spinExtraPrize () {
    const users = (await UserRepository.getAllUsers({ sorted: true, showAdmins: false, catchEmail: false }))
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
    if (name.trim().length < 2) throw new ValidationError('El nombre debe tener al menos 2 caracteres.')
    if (name.length > 60) throw new ValidationError('El nombre no puede superar los 60 caracteres.')
  }

  static email (email) {
    if (typeof email !== 'string') throw new ValidationError('El email debe ser una cadena de texto.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError('El email no tiene un formato válido.')
  }

  static password (password) {
    if (typeof password !== 'string') throw new ValidationError('La contraseña debe ser una cadena de texto.')
    if (password.length < 8) throw new ValidationError('La contraseña debe tener al menos 8 caracteres.')
    if (password.length > 128) throw new ValidationError('La contraseña no puede superar los 128 caracteres.')
  }
}
