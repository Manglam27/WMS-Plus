import mongoose from 'mongoose'

const packingSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    isFree: { type: Boolean, default: false },
    unitType: { type: String, enum: ['Piece', 'Box', 'Case'], required: true },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number },
    barcode: { type: String },
    rack: { type: String },
    section: { type: String },
    row: { type: String },
    boxNo: { type: String },
    cost: { type: Number },
    whMin: { type: Number },
    retailMin: { type: Number },
    base: { type: Number },
  },
  { _id: false },
)

const productSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    subcategory: { type: String, required: true },
    productId: { type: String, required: true, unique: true },
    productName: { type: String, required: true },
    productNameLower: { type: String, required: true, unique: true },
    brand: { type: String, required: true },
    commissionPercent: { type: Number, min: 1, max: 20, required: true },
    srp: { type: Number, required: true },
    reorderMark: { type: Number },
    mlQuantity: { type: Number },
    applyMlQuantity: { type: Boolean, default: false },
    weightOz: { type: Number },
    applyWeightOz: { type: Boolean, default: false },
    expiryDate: { type: Date },
    location: { type: String },
    notes: { type: String },
    imageFileName: { type: String },
    isActive: { type: Boolean, default: true },
    packings: [packingSchema],
  },
  { timestamps: true },
)

productSchema.pre('validate', function (next) {
  if (this.productName) this.productNameLower = String(this.productName).trim().toLowerCase()
  next()
})

export default mongoose.model('Product', productSchema)

