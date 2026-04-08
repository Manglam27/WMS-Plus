import mongoose from 'mongoose'

const lineItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    unitType: { type: String, default: 'Piece' },
    qtyPerUnit: { type: Number, default: 1, min: 1 },
    qty: { type: Number, default: 0, min: 0 },
    pieces: { type: Number, default: 0, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0 },
    srp: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, default: 0, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    netPrice: { type: Number, default: 0, min: 0 },
    isExchange: { type: Boolean, default: false },
    isTaxable: { type: Boolean, default: true },
    isFreeItem: { type: Boolean, default: false },
  },
  { _id: false },
)

const salesOrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, sparse: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    salesPerson: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['new', 'draft', 'submitted', 'confirmed', 'cancelled'],
      default: 'new',
    },
    orderDate: { type: Date, default: Date.now },
    deliveryDate: { type: Date },
    terms: { type: String, trim: true, default: '' },
    shippingType: { type: String, trim: true, default: 'Ground Shipping' },
    billingAddress: { type: String, trim: true, default: '' },
    shippingAddress: { type: String, trim: true, default: '' },
    lineItems: [lineItemSchema],
    notes: { type: String, trim: true, default: '', maxlength: 2000 },
    salesPersonRemark: { type: String, trim: true, default: '', maxlength: 500 },
    driverRemark: { type: String, trim: true, default: '', maxlength: 500 },
    subtotal: { type: Number, default: 0 },
    overallDiscountPercent: { type: Number, default: 0, min: 0 },
    overallDiscountAmount: { type: Number, default: 0, min: 0 },
    shippingCharges: { type: Number, default: 0, min: 0 },
    taxType: { type: String, trim: true, default: '' },
    taxPercent: { type: Number, default: 0, min: 0 },
    totalTax: { type: Number, default: 0, min: 0 },
    mlQuantity: { type: Number, default: 0, min: 0 },
    mlTax: { type: Number, default: 0, min: 0 },
    weightQuantity: { type: Number, default: 0, min: 0 },
    weightTax: { type: Number, default: 0, min: 0 },
    vapeTax: { type: Number, default: 0, min: 0 },
    adjustment: { type: Number, default: 0 },
    orderTotal: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export default mongoose.model('SalesOrder', salesOrderSchema)
