import { Schema, model } from 'mongoose'

const Challenge = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  points: { type: Number, required: true }
})

export default model('Challenge', Challenge)
