import DBLocal from 'db-local'

const { Schema } = new DBLocal({ path: './db' })

const Challenge = Schema('Challenge', {
  _id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  points: { type: Number, required: true }
})

export class ChallengeRepository {
  static async create ({ title, description, points }) {
    const auraPointsNumber = Number(points)

    if (auraPointsNumber < 0) throw new Error('Los puntos de aura deben ser positivos.')

    const id = crypto.randomUUID()

    Challenge.create({
      _id: id,
      title,
      description,
      points: auraPointsNumber
    }).save()

    return id
  }

  static async getAllChallenges ({ sorted = false, maxCharacters } = {}) {
    const challenges = Challenge.find()

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
    return Challenge.find({ _id: { $in: challengesIds } })
  }

  static async getPendingChallenges ({ challengesIds }) {
    return Challenge.find({ _id: { $in: challengesIds } })
  }

  static async deleteChallenge ({ challengeId }) {
    const challenge = Challenge.findOne({ _id: challengeId })

    if (!challenge) throw new Error('El desafío no existe.')

    challenge.remove()

    return challengeId
  }
}
