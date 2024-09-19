import { Schema, model } from 'mongoose'

const ExtraPointsSchema = new Schema({
  name: { type: String, required: true },
  points: { type: Number, required: true }
})

const User = new Schema({
  dni: { type: String, required: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  pendingChallenges: { type: Array, required: true, default: [] },
  challenges: { type: Array, required: true, default: [] },
  extraPoints: [ExtraPointsSchema],
  points: { type: Number, required: true, default: 0 },
  isExtraWinner: { type: Boolean, required: true, default: false },
  isAdmin: { type: Boolean, required: true, default: false },
  isSuperAdmin: { type: Boolean, required: true, default: false }
})

export default model('User', User)
