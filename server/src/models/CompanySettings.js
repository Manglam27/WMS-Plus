import mongoose from 'mongoose'

const stateTaxRuleSchema = new mongoose.Schema(
  {
    stateCode: { type: String, trim: true, uppercase: true, default: '' },
    taxPercent: { type: Number, default: 0, min: 0 },
    minAmount: { type: Number, default: 0, min: 0 },
    maxAmount: { type: Number, default: null },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
)

const companySettingsSchema = new mongoose.Schema(
  {
    companyName: { type: String, trim: true, default: '' },
    addressLine1: { type: String, trim: true, default: '' },
    addressLine2: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    zipCode: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    website: { type: String, trim: true, default: '' },
    logoFileName: { type: String, trim: true, default: '' },
    enableSalesTax: { type: Boolean, default: true },
    salesTaxPercent: { type: Number, default: 0, min: 0 },
    salesTaxLabel: { type: String, trim: true, default: 'Sales Tax' },
    stateTaxRules: { type: [stateTaxRuleSchema], default: [] },
    invoiceDisclosure: { type: String, trim: true, default: '' },
    invoiceTerms: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
)

export default mongoose.model('CompanySettings', companySettingsSchema)
