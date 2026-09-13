import AuditLog from './schemas/AuditLog.js'

export const AUDIT_ACTIONS = {
  USER_CREATED: 'USER_CREATED',
  USERS_IMPORTED: 'USERS_IMPORTED',
  USER_DELETED: 'USER_DELETED',
  USERS_PURGED: 'USERS_PURGED',
  USER_PROMOTED: 'USER_PROMOTED',
  USER_DEMOTED: 'USER_DEMOTED',
  PASSWORD_RESET: 'PASSWORD_RESET',
  CHALLENGE_CREATED: 'CHALLENGE_CREATED',
  CHALLENGE_UPDATED: 'CHALLENGE_UPDATED',
  CHALLENGE_DELETED: 'CHALLENGE_DELETED',
  POINTS_ADDED: 'POINTS_ADDED',
  EXTRA_POINTS_ADDED: 'EXTRA_POINTS_ADDED',
  CHALLENGE_ACCEPTED: 'CHALLENGE_ACCEPTED',
  CHALLENGE_REJECTED: 'CHALLENGE_REJECTED',
  EXTRA_PRIZE_SPUN: 'EXTRA_PRIZE_SPUN'
}

export class AuditRepository {
  /**
   * Nunca debe tumbar la peticion principal: si el registro falla se avisa por
   * consola pero la accion del administrador ya se ha completado.
   */
  static async record ({ action, actor, targetName, detail, amount }) {
    try {
      await AuditLog.create({
        action,
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? 'Sistema',
        targetName,
        detail,
        amount,
        createdAt: new Date()
      })
    } catch (error) {
      console.error('[AUDIT] No se pudo registrar la accion:', action, error.message)
    }
  }

  static async getRecent ({ limit = 150 } = {}) {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(limit)

    return logs.map(({ _id, action, actorName, targetName, detail, amount, createdAt }) => ({
      id: _id.toString(),
      action,
      actorName,
      targetName,
      detail,
      amount,
      createdAt
    }))
  }

  static async clear () {
    const { deletedCount } = await AuditLog.deleteMany({})
    return deletedCount
  }
}
