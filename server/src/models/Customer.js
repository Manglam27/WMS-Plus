import mongoose from 'mongoose'

const addressSchema = new mongoose.Schema(
  {
    address1: { type: String, trim: true, default: '' },
    address2: { type: String, trim: true, default: '' },
    zipCode: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
  },
  { _id: false },
)

const contactSchema = new mongoose.Schema(
  {
    labelType: { type: String, trim: true, default: '' }, // e.g. Billing / Shipping / Main
    personName: { type: String, trim: true, required: true },
    personType: { type: String, enum: ['Owner', 'Manager', 'Worker'], required: true },
    email: { type: String, trim: true, default: '' },
    mobileNo: { type: String, trim: true, default: '' },
    faxNo: { type: String, trim: true, default: '' },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false },
)

const customerSchema = new mongoose.Schema(
  {
    // Generated after approval (sales_manager/admin)
    customerNumber: { type: String, unique: true, sparse: true, default: null },
    customerName: { type: String, required: true, trim: true },
    customerType: { type: String, enum: ['Retail', 'Wholesale'], required: true },

    status: { type: String, enum: ['pending', 'active', 'inactive'], default: 'pending' },

    priceLevelCode: { type: String, trim: true, default: '' },
    taxId: { type: String, trim: true, default: '' },
    terms: { type: String, trim: true, default: '' },

    businessName: { type: String, trim: true, default: '' },
    otpLicence: { type: String, trim: true, default: '' },
    storeOpenTime: { type: String, trim: true, default: '' },
    storeCloseTime: { type: String, trim: true, default: '' },
    remark: { type: String, trim: true, default: '', maxlength: 2000 },

    billingAddress: { type: addressSchema, default: () => ({}) },
    shippingAddress: { type: addressSchema, default: () => ({}) },
    shippingSameAsBilling: { type: Boolean, default: true },

    contacts: { type: [contactSchema], default: [] },

    // Original request fields (kept for compatibility / reference)
    storeLocation: { type: String, trim: true, default: '' },
    contactName: { type: String, trim: true, default: '' },
    contactPhone: { type: String, trim: true, default: '' },
    contactEmail: { type: String, trim: true, default: '' },
    businessTaxDetails: { type: String, trim: true, default: '' },
    priceLevelMode: {
      type: String,
      enum: ['auto', 'match', 'new'],
      default: 'auto',
    },
    matchedCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    customPriceLevelName: { type: String, trim: true, default: '' },
    extraNotes: { type: String, trim: true, default: '', maxlength: 2000 },
    salesPerson: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    approvedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

export default mongoose.model('Customer', customerSchema)
