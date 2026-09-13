import { Schema, model } from 'mongoose'

const AuditLog = new Schema({
  action: { type: String, required: true },
  actorId: { type: String },
  actorName: { type: String, required: true },
  targetName: { type: String },
  detail: { type: String },
  amount: { type: Number },
  createdAt: { type: Date, required: true, default: Date.now }
})

AuditLog.index({ createdAt: -1 })

export default model('AuditLog', AuditLog)
