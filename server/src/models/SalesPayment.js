import mongoose from 'mongoose'

const salesPaymentSchema = new mongoose.Schema(
  {
    paymentNumber: { type: String, unique: true, sparse: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    salesPerson: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, trim: true, default: 'cash' },
    reference: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '', maxlength: 1000 },
  },
  { timestamps: true },
)

export default mongoose.model('SalesPayment', salesPaymentSchema)
