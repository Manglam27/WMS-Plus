import mongoose from 'mongoose'

const priceLevelProductPriceSchema = new mongoose.Schema(
  {
    priceLevelCode: { type: String, required: true, index: true, trim: true },
    productId: { type: String, required: true, index: true, trim: true },
    unitType: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
)

priceLevelProductPriceSchema.index(
  { priceLevelCode: 1, productId: 1, unitType: 1 },
  { unique: true, name: 'uniq_price_level_product_unit' },
)

export default mongoose.model('PriceLevelProductPrice', priceLevelProductPriceSchema)
