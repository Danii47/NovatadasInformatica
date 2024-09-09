export class ValidationError extends Error {
  constructor (message) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class UserAlreadyExistsError extends Error {
  constructor (message) {
    super(message)
    this.name = 'UserAlreadyExistsError'
  }
}

export class UserNotFoundError extends Error {
  constructor (message) {
    super(message)
    this.name = 'UserNotFoundError'
  }
}

export class UserAlreadyAdministratorError extends Error {
  constructor (message) {
    super(message)
    this.name = 'UserAlreadyAdministratorError'
  }
}

export class InvalidCredentialsError extends Error {
  constructor (message) {
    super(message)
    this.name = 'InvalidCredentialsError'
  }
}

export class UnauthorizedError extends Error {
  constructor (message) {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ChallengeNotFoundError extends Error {
  constructor (message) {
    super(message)
    this.name = 'ChallengeNotFoundError'
  }
}

export class ChallengeAlreadyCompletedError extends Error {
  constructor (message) {
    super(message)
    this.name = 'ChallengeAlreadyCompletedError'
  }
}

export class ChallengeAlreadyPendingError extends Error {
  constructor (message) {
    super(message)
    this.name = 'ChallengeAlreadyPendingError'
  }
}

export class ChallengeAlreadyAcceptedError extends Error {
  constructor (message) {
    super(message)
    this.name = 'ChallengeAlreadyAcceptedError'
  }
}

export class ChallengeNotRequestedError extends Error {
  constructor (message) {
    super(message)
    this.name = 'ChallengeNotRequestedError'
  }
}

export class InvalidPointsError extends Error {
  constructor (message) {
    super(message)
    this.name = 'InvalidPointsError'
  }
}

export class ConnectionError extends Error {
  constructor (message) {
    super(message)
    this.name = 'ConnectionError'
  }
}
