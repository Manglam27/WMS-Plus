import mongoose from 'mongoose'

const userLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    username: { type: String, required: true },
    role: { type: String, required: true },
    ipAddress: { type: String, default: '' },
    loginAt: { type: Date, default: Date.now, index: true },
    logoutAt: { type: Date },
  },
  { timestamps: true },
)

export default mongoose.model('UserLog', userLogSchema)
