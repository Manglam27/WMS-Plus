import mongoose from 'mongoose'

const warehouseTaskLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    detail: { type: String, trim: true, default: '' },
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byUserName: { type: String, trim: true, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
)

const warehouseTaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, default: '', maxlength: 2000 },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'done', 'blocked'],
      default: 'todo',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    assigneeRole: {
      type: String,
      enum: ['picker', 'scanner_packer'],
      required: true,
      index: true,
    },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date },
    logs: { type: [warehouseTaskLogSchema], default: [] },
  },
  { timestamps: true },
)

export default mongoose.model('WarehouseTask', warehouseTaskSchema)
