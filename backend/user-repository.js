import crypto from 'node:crypto'

import DBLocal from 'db-local'
import bcrypt from 'bcrypt'

import { SALT_ROUNDS } from './config.js'

const { Schema } = new DBLocal({ path: './db' })

const User = Schema('User', {
  _id: { type: String, required: true },
  dni: { type: String, required: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  points: { type: Number, required: true, default: 0 },
  isAdmin: { type: Boolean, required: true, default: false }
})

export class UserRepository {
  static async create ({ name, dni, password }) {
    Validation.name(name)
    Validation.dni(dni)
    Validation.password(password)

    const user = User.findOne({ dni })
    if (user) throw new Error('user already exists')

    const id = crypto.randomUUID()
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

    User.create({
      _id: id,
      name,
      dni,
      password: hashedPassword,
      isAdmin: false
    }).save()

    return id
  }

  static async login ({ dni, password }) {
    Validation.dni(dni)
    Validation.password(password)

    const user = User.findOne({ dni })
    if (!user) throw new Error('user not found')

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) throw new Error('invalid password')

    return {
      name: user.name,
      points: user.points
    }
  }
}

class Validation {
  static name (name) {
    if (typeof name !== 'string') throw new Error('name must be a string')
  }

  static dni (dni) {
    if (typeof dni !== 'string') throw new Error('dni must be a string')
  }

  static password (password) {
    if (typeof password !== 'string') throw new Error('password must be a string')
  }
}
