import { ChallengeNotFoundError, InvalidPointsError } from './errors.js'
import Challenge from './schemas/Challenge.js'
import User from './schemas/User.js'

export class ChallengeRepository {
  static async create ({ title, description, points }) {
    const pointsNumber = Number(points)

    if (!Number.isFinite(pointsNumber)) throw new InvalidPointsError('Los puntos deben ser un número.')
    if (pointsNumber < 0) throw new InvalidPointsError('Los puntos deben ser positivos.')
    if (typeof title !== 'string' || title.trim().length === 0) throw new InvalidPointsError('El título del reto es obligatorio.')
    if (typeof description !== 'string' || description.trim().length === 0) throw new InvalidPointsError('La descripción del reto es obligatoria.')

    const newChallenge = new Challenge({
      title: title.trim().slice(0, 120),
      description: description.trim().slice(0, 600),
      points: pointsNumber
    })

    await newChallenge.save()

    return newChallenge._id
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
