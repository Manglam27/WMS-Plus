import mongoose from 'mongoose'

const lineItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    expiryDate: { type: Date },
    unitType: { type: String, required: true },
    receiverPOQty: { type: Number, required: true, min: 1 },
    totalPieces: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const poSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    vendorInvoiceNo: { type: String, required: true },
    status: { type: String, enum: ['draft', 'generated'], default: 'draft' },
    date: { type: Date, required: true },
    remark: { type: String, maxlength: 200 },
    lineItems: [lineItemSchema],
    invoiceFileName: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

poSchema.index({ vendorInvoiceNo: 1 }, { unique: true })
poSchema.index({ poNumber: 1 }, { unique: true })

export default mongoose.model('PurchaseOrder', poSchema)
