import { Schema, model } from 'mongoose'

const User = new Schema({
  dni: { type: String, required: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  pendingChallenges: { type: Array, required: true, default: [] },
  challenges: { type: Array, required: true, default: [] },
  points: { type: Number, required: true, default: 0 },
  isAdmin: { type: Boolean, required: true, default: false },
  isSuperAdmin: { type: Boolean, required: true, default: false }
})

export default model('User', User)
