import { ChallengeNotFoundError, InvalidPointsError } from './errors.js'
import Challenge from './schemas/Challenge.js'

export class ChallengeRepository {
  static async create ({ title, description, points }) {
    const pointsNumber = Number(points)

    if (pointsNumber < 0) throw new InvalidPointsError('Los puntos deben ser positivos.')

    const newChallenge = new Challenge({
      title,
      description,
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
        _id: challenge._id,
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
    const challenge = Challenge.findOne({ _id: challengeId })

    if (!challenge) throw new ChallengeNotFoundError('El reto no existe.')

    // TODO: Remove challenge from users

    await challenge.deleteOne()

    return challengeId
  }
}
