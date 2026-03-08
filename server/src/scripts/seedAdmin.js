import mongoose from 'mongoose'
import User from '../models/User.js'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/wmsplus'

async function seedAdmin() {
  try {
    await mongoose.connect(MONGODB_URI)
    const existing = await User.findOne({ username: 'admin' })
    if (existing) {
      console.log('Admin user already exists')
      process.exit(0)
      return
    }
    await User.create({
      name: 'Admin',
      username: 'admin',
      password: 'admin',
      role: 'admin',
    })
    console.log('Admin user created (username: admin, password: admin)')
    process.exit(0)
  } catch (error) {
    console.error('Seed error:', error)
    process.exit(1)
  }
}

seedAdmin()
