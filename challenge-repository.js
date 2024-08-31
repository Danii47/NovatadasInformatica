import Challenge from './schemas/Challenge.js'

export class ChallengeRepository {
  static async create ({ title, description, points }) {
    const auraPointsNumber = Number(points)

    if (auraPointsNumber < 0) throw new Error('Los puntos deben ser positivos.')

    const newChallenge = new Challenge({
      title,
      description,
      points: auraPointsNumber
    })

    await newChallenge.save()

    return newChallenge._id
  }

  static async getAllChallenges ({ sorted = false, maxCharacters } = {}) {
    const challenges = await Challenge.find()

    if (sorted) {
      challenges.sort((a, b) => b.points - a.points)
    }

    if (maxCharacters) {
      return challenges.map(challenge => ({
        ...challenge,
        title: challenge.title.slice(0, maxCharacters) + (challenge.title.length > maxCharacters ? '...' : '')
      }))
    }

    return challenges
  }

  static async getChallengeById ({ id }) {
    const challenge = await Challenge.findOne({ _id: id })

    if (!challenge) throw new Error('El reto no existe.')

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

    if (!challenge) throw new Error('El desafío no existe.')

    // TODO: Remove challenge from users

    await challenge.deleteOne()

    return challengeId
  }
}
