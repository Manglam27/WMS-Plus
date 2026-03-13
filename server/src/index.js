import express from 'express'
import cors from 'cors'
import path from 'path'
import connectDB from './config/db.js'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import productRoutes from './routes/products.js'
import User from './models/User.js'
import { ensureDir, uploadsRoot } from './uploads.js'

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

// Serve uploaded product images
ensureDir(path.join(uploadsRoot(), 'products'))
app.use('/uploads', express.static(uploadsRoot()))

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/products', productRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'WMS-Plus API is running' })
})

// Ensure admin exists - call on startup and optionally via GET (dev only)
app.get('/api/seed-admin', async (req, res) => {
  try {
    const existing = await User.findOne({ username: 'admin' })
    if (existing) {
      return res.json({ message: 'Admin user already exists' })
    }
    await User.create({
      name: 'Admin',
      username: 'admin',
      password: 'admin123',
      role: 'admin',
    })
    res.json({ message: 'Admin user created (username: admin, password: admin123)' })
  } catch (err) {
    console.error('Seed error:', err)
    res.status(500).json({ message: err.message || 'Seed failed' })
  }
})

const start = async () => {
  await connectDB()

  const seedAdminIfNeeded = async () => {
    const existing = await User.findOne({ username: 'admin' })
    if (!existing) {
      await User.create({
        name: 'Admin',
        username: 'admin',
        password: 'admin123',
        role: 'admin',
      })
      console.log('Admin user seeded (username: admin, password: admin123)')
    }
  }

  await seedAdminIfNeeded()

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`)
  })
}

start().catch((err) => {
  console.error('Startup error:', err)
  process.exit(1)
})
