import express from 'express'
import User from '../models/User.js'
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
    })

    res.status(201).json({
      id: user._id,
      name: user.name,
      username: user.username,
      role: user.role,
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
