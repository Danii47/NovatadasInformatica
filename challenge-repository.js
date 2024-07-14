import DBLocal from 'db-local'

const { Schema } = new DBLocal({ path: './db' })

const Challenge = Schema('Challenge', {
  _id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  auraPoints: { type: Number, required: true }
})

export class ChallengeRepository {
  static async create ({ title, description, auraPoints }) {
    const auraPointsNumber = Number(auraPoints)

    if (auraPointsNumber < 0) throw new Error('Los puntos de aura deben ser positivos.')

    const id = crypto.randomUUID()

    Challenge.create({
      _id: id,
      title,
      description,
      auraPoints: auraPointsNumber
    }).save()

    return id
  }

  static async getAllChallenges ({ sorted = false, maxCharacters } = {}) {
    const challenges = Challenge.find()

    if (sorted) {
      challenges.sort((a, b) => b.auraPoints - a.auraPoints)
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
    const challenge = Challenge.findOne({ _id: id })

    if (!challenge) throw new Error('El reto no existe.')

    return challenge
  }

  static async deleteChallenge (id) {
    const challenge = Challenge.findOne({ _id: id })

    if (!challenge) throw new Error('El desafío no existe.')

    Challenge.delete({ _id: id }).save()
  }
}
