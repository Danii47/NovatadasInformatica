import { ChallengeNotFoundError, InvalidPointsError, ValidationError } from './errors.js'
import Challenge from './schemas/Challenge.js'
import User from './schemas/User.js'

/**
 * Comprueba y normaliza los campos de un reto. La usan tanto el alta como la
 * edición, para que un reto editado no pueda quedar en un estado que el alta
 * habría rechazado.
 */
const validateChallenge = ({ title, description, points }) => {
  const pointsNumber = Number(points)

  if (!Number.isFinite(pointsNumber)) throw new InvalidPointsError('Los puntos deben ser un número.')
  if (pointsNumber < 0) throw new InvalidPointsError('Los puntos deben ser positivos.')
  if (typeof title !== 'string' || title.trim().length === 0) throw new ValidationError('El título del reto es obligatorio.')
  if (typeof description !== 'string' || description.trim().length === 0) throw new ValidationError('La descripción del reto es obligatoria.')

  return {
    title: title.trim().slice(0, 120),
    description: description.trim().slice(0, 600),
    points: pointsNumber
  }
}

export class ChallengeRepository {
  static async create ({ title, description, points }) {
    const newChallenge = new Challenge(validateChallenge({ title, description, points }))

    await newChallenge.save()

    return newChallenge._id
  }

  /**
   * Edita título, descripción y puntos de un reto.
   *
   * Los puntos de cada usuario son una suma acumulada, no algo que se calcule
   * al vuelo: si un reto validado pasa de 100 a 50 puntos y no se corrige a
   * quien ya lo tenía, el marcador se queda mintiendo para siempre. Por eso se
   * aplica la diferencia a todo el que lo tenga completado.
   */
  static async update ({ challengeId, title, description, points }) {
    const fields = validateChallenge({ title, description, points })

    const challenge = await Challenge.findOne({ _id: challengeId })
    if (!challenge) throw new ChallengeNotFoundError('El reto no existe.')

    const pointsDelta = fields.points - challenge.points

    await challenge.updateOne(fields)

    let affectedUsers = 0

    if (pointsDelta !== 0) {
      const { modifiedCount } = await User.updateMany(
        { challenges: challengeId },
        { $inc: { points: pointsDelta } }
      )
      affectedUsers = modifiedCount
    }

    return { challengeId, ...fields, pointsDelta, affectedUsers }
  }

  static async getAllChallenges ({ sorted = false, maxCharacters } = {}) {
    const challenges = await Challenge.find()

    if (sorted) {
      challenges.sort((a, b) => b.points - a.points)
    }

    return challenges.map(challenge => {
      return {
        _id: challenge._id.toString(),
        points: challenge.points,
        description: challenge.description,
        title: maxCharacters ? challenge.title.slice(0, maxCharacters) + (challenge.title.length > maxCharacters ? '...' : '') : challenge.title
      }
    })
  }

  static async getChallengeById ({ id }) {
    const challenge = await Challenge.findOne({ _id: id })

    if (!challenge) throw new ChallengeNotFoundError('El reto no existe.')

    return challenge
  }

  static async getCompletedChallenges ({ challengesIds }) {
    return await Challenge.find({ _id: { $in: challengesIds } })
  }

  static async getPendingChallenges ({ challengesIds }) {
    return await Challenge.find({ _id: { $in: challengesIds } })
  }

  static async deleteChallenge ({ challengeId }) {
    // Faltaba el `await`: `findOne` devolvía una Query (siempre truthy), así que
    // el reto inexistente nunca lanzaba ChallengeNotFoundError.
    const challenge = await Challenge.findOne({ _id: challengeId })

    if (!challenge) throw new ChallengeNotFoundError('El reto no existe.')

    const title = challenge.title
    await challenge.deleteOne()

    // Sin esto los usuarios conservan un reto fantasma que sigue contando en su
    // total de retos completados y en los pendientes del panel de admin.
    await User.updateMany(
      {},
      { $pull: { challenges: challengeId, pendingChallenges: challengeId } }
    )

    return { challengeId, title }
  }
}
