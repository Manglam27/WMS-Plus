import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const JWT_SECRET = process.env.JWT_SECRET || 'wms-plus-dev-secret-change-in-production'

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return res.status(401).json({ message: 'Not authorized' })
    }

    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await User.findById(decoded.id).select('-password')

    if (!user) {
      return res.status(401).json({ message: 'User not found' })
    }
    if (user.isActive === false) {
      return res.status(403).json({ message: 'User account is deactivated' })
    }

    req.user = user
    next()
  } catch (error) {
    res.status(401).json({ message: 'Not authorized' })
  }
}

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' })
    }
    next()
  }
}
