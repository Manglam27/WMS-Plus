import mongoose from 'mongoose'

const vendorSchema = new mongoose.Schema(
  {
    vendorId: { type: String, required: true, unique: true },
    vendorName: { type: String, required: true },
    vendorNameLower: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    subType: { type: String },
    companyName: { type: String },
    contactPerson: { type: String },
    designation: { type: String },
    cell: { type: String },
    fax: { type: String },
    emailId: { type: String },
    office: { type: String },
    website: { type: String },
    notes: { type: String },
    address1: { type: String },
    address2: { type: String },
    zipCode: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    // Legacy / list display
    phoneNo: { type: String },
    officeContact: { type: String },
    vendorCredit: { type: Number, default: 0 },
    totalPO: { type: Number, default: 0 },
    poAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
    lastPODate: { type: Date },
    lastVendorInvoiceNo: { type: String },
  },
  { timestamps: true },
)

vendorSchema.pre('validate', function (next) {
  if (this.vendorName) {
    this.vendorNameLower = String(this.vendorName).trim().toLowerCase()
  }
  next()
})

export default mongoose.model('Vendor', vendorSchema)
