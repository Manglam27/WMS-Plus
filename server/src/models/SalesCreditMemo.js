import mongoose from 'mongoose'

const salesCreditMemoSchema = new mongoose.Schema(
  {
    memoNumber: { type: String, unique: true, sparse: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    salesPerson: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true, default: '', maxlength: 1000 },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'rejected'],
      default: 'draft',
    },
  },
  { timestamps: true },
)

export default mongoose.model('SalesCreditMemo', salesCreditMemoSchema)
