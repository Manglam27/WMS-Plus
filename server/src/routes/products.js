import express from 'express'
import multer from 'multer'
import path from 'path'
import Product from '../models/Product.js'
import { protect, requireRole } from '../middleware/auth.js'
import { ensureDir, uploadsRoot } from '../uploads.js'

const router = express.Router()

const productUploadsDir = path.join(uploadsRoot(), 'products')
ensureDir(productUploadsDir)

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, productUploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase()
    const safeExt = ext && ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.jpg'
    const productId = String(req.body?.productId || 'product').replace(/[^a-zA-Z0-9-_]/g, '_')
    cb(null, `${productId}-${Date.now()}${safeExt}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)
    cb(ok ? null : new Error('Invalid image type'), ok)
  },
})

async function generateUniqueBarcode() {
  // 8 digit numeric string
  // Try a few times to avoid collisions
  for (let i = 0; i < 10; i += 1) {
    const code = String(Math.floor(10000000 + Math.random() * 90000000))
    // eslint-disable-next-line no-await-in-loop
    const existing = await Product.findOne({ 'packings.barcode': code }).select('_id').lean()
    if (!existing) return code
  }
  throw new Error('Unable to generate unique barcode')
}

// GET /api/products - list products (filters + pagination)
router.get('/', protect, requireRole('admin', 'inventory_manager'), async (req, res) => {
  try {
    const {
      limit = '10',
      offset = '0',
      category,
      subcategory,
      brand,
      location,
      productId,
      productName,
      barcode,
      fromExpiryDate,
      toExpiryDate,
    } = req.query

    const safeLimit = limit === 'all' ? 0 : Math.min(Math.max(parseInt(limit, 10) || 10, 1), 500)
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0)

    const filter = {}
    if (category && category !== 'all') filter.category = category
    if (subcategory && subcategory !== 'all') filter.subcategory = subcategory
    if (brand && brand !== 'all') filter.brand = brand
    if (location) filter.location = { $regex: String(location).trim(), $options: 'i' }
    if (productId) filter.productId = { $regex: String(productId).trim(), $options: 'i' }
    if (productName) filter.productNameLower = { $regex: String(productName).trim().toLowerCase(), $options: 'i' }
    if (barcode) filter['packings.barcode'] = { $regex: String(barcode).trim(), $options: 'i' }

    if (fromExpiryDate || toExpiryDate) {
      filter.expiryDate = {}
      if (fromExpiryDate) filter.expiryDate.$gte = new Date(fromExpiryDate)
      if (toExpiryDate) filter.expiryDate.$lte = new Date(toExpiryDate)
    }

    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip(safeOffset)
        .limit(safeLimit || 0),
      Product.countDocuments(filter),
    ])

    res.json({ items, total })
  } catch (error) {
    console.error('List products error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/products/:id - get single product
router.get('/:id', protect, requireRole('admin', 'inventory_manager'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: 'Product not found' })
    res.json(product)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/products - create a new product
router.post('/', protect, requireRole('admin', 'inventory_manager'), upload.single('image'), async (req, res) => {
  try {
    const body = req.body || {}
    const {
      category,
      subcategory,
      productId,
      productName,
      brand,
      commissionPercent,
      srp,
      reorderMark,
      mlQuantity,
      applyMlQuantity,
      weightOz,
      applyWeightOz,
      expiryDate,
      location,
      notes,
    } = body

    let packings = body.packings ? JSON.parse(body.packings) : []

    if (!category || !subcategory || !productId || !productName || !brand || !commissionPercent || !srp) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    const productNameLower = String(productName).trim().toLowerCase()

    const existing = await Product.findOne({
      $or: [{ productId }, { productNameLower }],
    })
    if (existing) {
      if (existing.productId === productId) {
        return res.status(400).json({ message: 'Product ID already exists' })
      }
      return res.status(400).json({ message: 'Product name already exists' })
    }

    // Auto-generate missing barcodes and enforce uniqueness across products
    if (!Array.isArray(packings)) packings = []

    for (let i = 0; i < packings.length; i += 1) {
      if (!packings[i]) continue
      if (!packings[i].barcode) {
        // eslint-disable-next-line no-await-in-loop
        packings[i].barcode = await generateUniqueBarcode()
      }
    }

    const barcodes = packings
      .map((p) => String(p.barcode || '').trim())
      .filter((b) => b.length > 0)

    if (barcodes.length > 0) {
      const duplicateBarcodeOwner = await Product.findOne({
        'packings.barcode': { $in: barcodes },
      }).select('productId').lean()

      if (duplicateBarcodeOwner) {
        return res.status(400).json({ message: 'One or more barcodes are already used by another product' })
      }
    }

    const imageFileName = req.file?.filename || null

    const product = await Product.create({
      category,
      subcategory,
      productId,
      productName,
      productNameLower,
      brand,
      commissionPercent: Number(commissionPercent),
      srp: Number(srp),
      reorderMark: reorderMark === '' || reorderMark == null ? undefined : Number(reorderMark),
      mlQuantity: mlQuantity === '' || mlQuantity == null ? undefined : Number(mlQuantity),
      applyMlQuantity: String(applyMlQuantity) === 'true',
      weightOz: weightOz === '' || weightOz == null ? undefined : Number(weightOz),
      applyWeightOz: String(applyWeightOz) === 'true',
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      location,
      notes,
      imageFileName,
      isActive: String(body.isActive ?? 'true') !== 'false',
      packings,
    })

    res.status(201).json(product)
  } catch (error) {
    console.error('Create product error:', error)
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0]
      if (field === 'productId') return res.status(400).json({ message: 'Product ID already exists' })
      if (field === 'productNameLower') return res.status(400).json({ message: 'Product name already exists' })
      return res.status(400).json({ message: 'Duplicate product' })
    }
    if (String(error?.message || '').toLowerCase().includes('invalid image type')) {
      return res.status(400).json({ message: 'Invalid image type (PNG/JPG/WEBP only)' })
    }
    res.status(500).json({ message: 'Server error' })
  }
})

export default router

