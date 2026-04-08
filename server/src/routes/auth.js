import express from 'express'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import UserLog from '../models/UserLog.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'wms-plus-dev-secret-change-in-production'

const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' })
}

const extractClientIp = (req) => {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim()
  }
  return req.ip || req.socket?.remoteAddress || ''
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
    if (user.isActive === false) {
      return res.status(403).json({ message: 'User account is deactivated' })
    }
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = generateToken(user._id)
    const userData = await User.findById(user._id).select('-password')
    const userLog = await UserLog.create({
      user: userData._id,
      username: userData.username,
      role: userData.role,
      ipAddress: extractClientIp(req),
      loginAt: new Date(),
    })

    res.json({
      token,
      user: {
        id: userData._id,
        name: userData.name,
        username: userData.username,
        role: userData.role,
      },
      loginLogId: userLog._id,
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

// POST /api/auth/logout
router.post('/logout', protect, async (req, res) => {
  try {
    const { loginLogId } = req.body || {}
    if (loginLogId) {
      const log = await UserLog.findOne({ _id: loginLogId, user: req.user._id, logoutAt: { $exists: false } })
      if (log) {
        log.logoutAt = new Date()
        await log.save()
        return res.json({ message: 'Logged out' })
      }
    }

    const latestOpen = await UserLog.findOne({ user: req.user._id, logoutAt: { $exists: false } }).sort({ loginAt: -1 })
    if (latestOpen) {
      latestOpen.logoutAt = new Date()
      await latestOpen.save()
    }
    res.json({ message: 'Logged out' })
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
