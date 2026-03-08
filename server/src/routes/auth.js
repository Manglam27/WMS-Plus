import express from 'express'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'wms-plus-dev-secret-change-in-production'

const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' })
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' })
    }

    const user = await User.findOne({ username: username.toLowerCase() }).select('+password')

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = generateToken(user._id)
    const userData = await User.findById(user._id).select('-password')

    res.json({
      token,
      user: {
        id: userData._id,
        name: userData.name,
        username: userData.username,
        role: userData.role,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json({ user: req.user })
})

export default router
