import express from 'express'
import User from '../models/User.js'
import UserLog from '../models/UserLog.js'
import { protect, requireRole } from '../middleware/auth.js'

const router = express.Router()

// GET /api/users - List all users (admin only)
router.get('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 })
    res.json(users)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/users/stats - user counts for admin dashboard
router.get('/stats', protect, requireRole('admin'), async (req, res) => {
  try {
    const [totalUsers, activeUsers, inactiveUsers] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isActive: { $ne: false } }),
      User.countDocuments({ isActive: false }),
    ])
    res.json({ totalUsers, activeUsers, inactiveUsers })
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/users/logs/users - list users for logs tab
router.get('/logs/users', protect, requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find().select('_id name username role isActive').sort({ createdAt: -1 }).lean()
    res.json(users)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/users/:id/logs - per-user login logs
router.get('/:id/logs', protect, requireRole('admin'), async (req, res) => {
  try {
    const exists = await User.findById(req.params.id).select('_id').lean()
    if (!exists) return res.status(404).json({ message: 'User not found' })
    const logs = await UserLog.find({ user: req.params.id }).sort({ loginAt: -1 }).lean()
    res.json(logs)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/users - Create new user (admin only)
router.post('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const { name, username, password, role } = req.body

    if (!name || !username || !password || !role) {
      return res.status(400).json({ message: 'Name, username, password and role required' })
    }

    const validRoles = [
      'admin',
      'accounts',
      'order_manager',
      'inventory_manager',
      'inventory_receiver',
      'sales_manager',
      'scanner_packer',
      'picker',
      'sales_person',
      'driver',
    ]

    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' })
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' })
    }

    const existing = await User.findOne({ username: username.toLowerCase() })
    if (existing) {
      return res.status(400).json({ message: 'Username already exists' })
    }

    const user = await User.create({
      name,
      username: username.toLowerCase(),
      password,
      role,
      isActive: true,
    })

    res.status(201).json({
      id: user._id,
      name: user.name,
      username: user.username,
      role: user.role,
      isActive: user.isActive !== false,
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// PATCH /api/users/:id/status - activate/deactivate user (admin only)
router.patch('/:id/status', protect, requireRole('admin'), async (req, res) => {
  try {
    const { isActive } = req.body || {}
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive must be boolean' })
    }
    if (String(req.user._id) === String(req.params.id) && isActive === false) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' })
    }
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    user.isActive = isActive
    await user.save()
    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      role: user.role,
      isActive: user.isActive !== false,
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// PATCH /api/users/:id/password - reset user password (admin only)
router.patch('/:id/password', protect, requireRole('admin'), async (req, res) => {
  try {
    const { password } = req.body || {}
    if (!password || String(password).trim().length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' })
    }
    const user = await User.findById(req.params.id).select('+password')
    if (!user) return res.status(404).json({ message: 'User not found' })
    user.password = String(password).trim()
    await user.save()
    res.json({ message: 'Password updated successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
