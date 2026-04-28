import express from 'express'
import multer from 'multer'
import path from 'path'
import Product from '../models/Product.js'
import User from '../models/User.js'
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
router.get('/', protect, requireRole('admin', 'inventory_manager', 'inventory_receiver', 'sales_person', 'sales_manager', 'order_manager'), async (req, res) => {
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
      status,
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
    if (status === 'Active') filter.isActive = { $ne: false }
    if (status === 'Inactive') filter.isActive = false

    if (fromExpiryDate || toExpiryDate) {
      filter.expiryDate = {}
      if (fromExpiryDate) filter.expiryDate.$gte = new Date(fromExpiryDate)
      if (toExpiryDate) filter.expiryDate.$lte = new Date(toExpiryDate)
    }

    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort({ productId: 1 }) // ascending by productId
        .skip(safeOffset)
        .limit(safeLimit || 0),
      Product.countDocuments(filter),
    ])

    res.json({ items, total })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('List products error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/products/:id - get single product
router.get('/:id', protect, requireRole('admin', 'inventory_manager', 'inventory_receiver', 'sales_person', 'sales_manager', 'order_manager'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: 'Product not found' })
    res.json(product)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/products/:id/stock-adjust - manual stock adjustment (absolute pieces)
router.post(
  '/:id/stock-adjust',
  protect,
  requireRole('admin', 'inventory_manager', 'inventory_receiver'),
  async (req, res) => {
    try {
      const { newStockPieces, defaultUnitType, defaultUnitQty, remark, referenceId, securityCode } = req.body || {}

      if (!securityCode || typeof securityCode !== 'string') {
        return res.status(403).json({ message: 'Access denied' })
      }
      const userWithPassword = await User.findById(req.user._id).select('+password')
      if (!userWithPassword) {
        return res.status(500).json({ message: 'Server error' })
      }
      const passwordValid = await userWithPassword.comparePassword(securityCode.trim())
      if (!passwordValid) {
        return res.status(403).json({ message: 'Access denied' })
      }

      const requested = Number(newStockPieces)
      if (!Number.isFinite(requested) || requested < 0) {
        return res.status(400).json({ message: 'Invalid stock quantity' })
      }

      if (!remark || String(remark).trim().length < 10) {
        return res.status(400).json({ message: 'Remark must be at least 10 characters' })
      }

      const product = await Product.findById(req.params.id)
      if (!product) return res.status(404).json({ message: 'Product not found' })

      const oldStock = Number(product.currentStock || 0)
      const newStock = Math.max(0, requested)
      const delta = newStock - oldStock

      product.currentStock = newStock

      product.stockHistory = product.stockHistory || []
      product.stockHistory.unshift({
        at: new Date(),
        oldStock,
        delta,
        newStock,
        defaultUnitType: defaultUnitType || null,
        defaultUnitQty:
          defaultUnitQty === undefined || defaultUnitQty === null ? null : Number(defaultUnitQty),
        referenceId: referenceId || null,
        userName: req.user?.name || req.user?.username || 'System',
        remark: String(remark).trim(),
      })

      await product.save()

      res.json(product)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Stock adjust error:', error)
      res.status(500).json({ message: 'Server error' })
    }
  },
)

// PUT /api/products/:id - update existing product (no productId/name change)
router.put('/:id', protect, requireRole('admin', 'inventory_manager'), upload.single('image'), async (req, res) => {
  try {
    const body = req.body || {}
    const {
      category,
      subcategory,
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
      isActive,
    } = body

    let packings = body.packings ? JSON.parse(body.packings) : []

    const existing = await Product.findById(req.params.id)
    if (!existing) return res.status(404).json({ message: 'Product not found' })

    // Ensure required fields still present
    const finalCategory = category ?? existing.category
    const finalSubcategory = subcategory ?? existing.subcategory
    const finalBrand = brand ?? existing.brand
    const finalCommission = commissionPercent ?? existing.commissionPercent
    const finalSrp = srp ?? existing.srp

    if (!finalCategory || !finalSubcategory || !finalBrand || !finalCommission || !finalSrp) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    if (!Array.isArray(packings) || packings.length === 0) {
      packings = existing.packings || []
    }

    // Fill missing barcodes and enforce uniqueness across products (excluding this one)
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

    // Ensure no barcode is repeated inside this product itself
    const withinProductSet = new Set(barcodes)
    if (withinProductSet.size !== barcodes.length) {
      return res
        .status(400)
        .json({ message: 'The same barcode cannot be used more than once in the same product' })
    }

    if (barcodes.length > 0) {
      const duplicateBarcodeOwner = await Product.findOne({
        _id: { $ne: existing._id },
        'packings.barcode': { $in: barcodes },
      })
        .select('productId packings.unitType packings.barcode')
        .lean()

      if (duplicateBarcodeOwner) {
        const match = (duplicateBarcodeOwner.packings || []).find((p) =>
          barcodes.includes(String(p.barcode || '').trim()),
        )
        const usedBarcode = String(match?.barcode || '').trim()
        const usedUnit = match?.unitType || 'Piece'
        const msg = `Barcode "${usedBarcode}" has been already used for product Id "${duplicateBarcodeOwner.productId}" under "${usedUnit}" unit.`
        return res.status(400).json({
          message: msg,
          barcode: usedBarcode,
          productId: duplicateBarcodeOwner.productId,
          unitType: usedUnit,
        })
      }
    }

    const imageFileName = req.file?.filename || existing.imageFileName || null

    existing.category = finalCategory
    existing.subcategory = finalSubcategory
    existing.brand = finalBrand
    existing.commissionPercent = Number(finalCommission)
    existing.srp = Number(finalSrp)
    existing.reorderMark = reorderMark === '' || reorderMark == null ? existing.reorderMark : Number(reorderMark)
    existing.mlQuantity = mlQuantity === '' || mlQuantity == null ? existing.mlQuantity : Number(mlQuantity)
    existing.applyMlQuantity = applyMlQuantity != null ? String(applyMlQuantity) === 'true' : existing.applyMlQuantity
    existing.weightOz = weightOz === '' || weightOz == null ? existing.weightOz : Number(weightOz)
    existing.applyWeightOz = applyWeightOz != null ? String(applyWeightOz) === 'true' : existing.applyWeightOz
    existing.expiryDate = expiryDate ? new Date(expiryDate) : existing.expiryDate
    existing.location = location ?? existing.location
    existing.notes = notes ?? existing.notes
    existing.imageFileName = imageFileName
    existing.isActive = isActive != null ? String(isActive) !== 'false' : existing.isActive
    existing.packings = packings

    await existing.save()

    res.json(existing)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Update product error:', error)
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

// POST /api/products - create a new product
router.post(
  '/',
  protect,
  requireRole('admin', 'inventory_manager'),
  upload.single('image'),
  async (req, res) => {
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

      // Ensure no barcode is repeated inside this product itself
      const withinProductSet = new Set(barcodes)
      if (withinProductSet.size !== barcodes.length) {
        return res
          .status(400)
          .json({ message: 'The same barcode cannot be used more than once in the same product' })
      }

      if (barcodes.length > 0) {
        const duplicateBarcodeOwner = await Product.findOne({
          'packings.barcode': { $in: barcodes },
        })
          .select('productId packings.unitType packings.barcode')
          .lean()

        if (duplicateBarcodeOwner) {
          const match = (duplicateBarcodeOwner.packings || []).find((p) =>
            barcodes.includes(String(p.barcode || '').trim()),
          )
          const usedBarcode = String(match?.barcode || '').trim()
          const usedUnit = match?.unitType || 'Piece'
          const msg = `Barcode "${usedBarcode}" has been already used for product Id "${duplicateBarcodeOwner.productId}" under "${usedUnit}" unit.`
          return res.status(400).json({
            message: msg,
            barcode: usedBarcode,
            productId: duplicateBarcodeOwner.productId,
            unitType: usedUnit,
          })
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
      // eslint-disable-next-line no-console
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
  },
)

export default router

