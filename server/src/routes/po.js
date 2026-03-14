import express from 'express'
import multer from 'multer'
import path from 'path'
import PurchaseOrder from '../models/PurchaseOrder.js'
import Product from '../models/Product.js'
import { protect, requireRole } from '../middleware/auth.js'
import { ensureDir, uploadsRoot } from '../uploads.js'

const router = express.Router()
const poUploadsDir = path.join(uploadsRoot(), 'po')
ensureDir(poUploadsDir)

const ALLOWED_MIMES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
]
const ALLOWED_EXT = ['.png', '.jpg', '.jpeg', '.docx', '.pdf']

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, poUploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase()
    const safeExt = ALLOWED_EXT.includes(ext) ? ext : '.pdf'
    cb(null, `invoice-${Date.now()}${safeExt}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ALLOWED_MIMES.includes(file.mimetype)
    cb(ok ? null : new Error('Invalid file type. Allowed: png, jpg, jpeg, docx, pdf. Max 2MB.'), ok)
  },
})

async function getNextPoNumber() {
  const last = await PurchaseOrder.findOne().sort({ poNumber: -1 }).select('poNumber').lean()
  if (!last || !last.poNumber) return 'PO000001'
  const match = last.poNumber.match(/^PO(\d+)$/i)
  const num = match ? parseInt(match[1], 10) + 1 : 1
  const next = Math.min(num, 999999)
  return `PO${String(next).padStart(6, '0')}`
}

// POST /api/po - create PO (multipart: vendor, vendorInvoiceNo, status, date, remark, lineItems, optional file)
router.post(
  '/',
  protect,
  requireRole('admin', 'inventory_manager', 'inventory_receiver'),
  upload.single('invoice'),
  async (req, res) => {
    try {
      const raw = req.body || {}
      const vendor = raw.vendor
      const vendorInvoiceNo = raw.vendorInvoiceNo
      const status = raw.status === 'generated' ? 'generated' : 'draft'
      const dateRaw = raw.date
      const remark = raw.remark != null ? String(raw.remark).trim().slice(0, 200) : ''
      let lineItems = []
      try {
        lineItems = typeof raw.lineItems === 'string' ? JSON.parse(raw.lineItems) : Array.isArray(raw.lineItems) ? raw.lineItems : []
      } catch {
        lineItems = []
      }

      if (!vendor) {
        return res.status(400).json({ message: 'Vendor is required' })
      }
      if (!vendorInvoiceNo || !String(vendorInvoiceNo).trim()) {
        return res.status(400).json({ message: 'Vendor Invoice No is required' })
      }
      const invoiceNoTrim = String(vendorInvoiceNo).trim()
      const existingInvoice = await PurchaseOrder.findOne({ vendorInvoiceNo: invoiceNoTrim }).select('_id').lean()
      if (existingInvoice) {
        return res.status(400).json({ message: 'Vendor Invoice No already exists. It must be unique.' })
      }
      const date = dateRaw ? new Date(dateRaw) : new Date()
      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ message: 'Valid date is required' })
      }

      const productIds = lineItems.map((item) => String(item.productId || '').trim()).filter(Boolean)
      const uniqueIds = [...new Set(productIds)]
      if (productIds.length !== uniqueIds.length) {
        return res.status(400).json({ message: 'Duplicate product in line items. Each product can only appear once per PO.' })
      }

      const poNumber = await getNextPoNumber()

      const doc = await PurchaseOrder.create({
        poNumber,
        vendor,
        vendorInvoiceNo: invoiceNoTrim,
        status,
        date,
        remark,
        lineItems: lineItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
          unitType: item.unitType || 'Piece',
          receiverPOQty: Number(item.receiverPOQty) || 1,
          totalPieces: Number(item.totalPieces) || 0,
        })),
        invoiceFileName: req.file ? req.file.filename : undefined,
        createdBy: req.user._id,
      })

      res.status(201).json(doc)
    } catch (error) {
      if (error.message && error.message.includes('Invalid file')) {
        return res.status(400).json({ message: error.message })
      }
      console.error('Create PO error:', error)
      res.status(500).json({ message: 'Server error' })
    }
  },
)

// GET /api/po/draft - list POs for inventory manager (generated/revert/verified only; filters: vendor, vendorInvoiceNo, poNumber, status, fromDate, toDate)
router.get('/draft', protect, requireRole('admin', 'inventory_manager'), async (req, res) => {
  try {
    const { limit = '50', offset = '0', vendor, vendorInvoiceNo, poNumber, status, fromDate, toDate } = req.query
    const filter = { status: { $in: ['generated', 'revert', 'verified'] } }
    if (vendor && String(vendor).trim()) filter.vendor = String(vendor).trim()
    if (vendorInvoiceNo && String(vendorInvoiceNo).trim()) {
      filter.vendorInvoiceNo = { $regex: String(vendorInvoiceNo).trim(), $options: 'i' }
    }
    if (poNumber && String(poNumber).trim()) {
      filter.poNumber = { $regex: String(poNumber).trim(), $options: 'i' }
    }
    const statusMap = { new: 'generated', revert: 'revert', verified: 'verified' }
    if (status && statusMap[status]) filter.status = statusMap[status]
    if (fromDate || toDate) {
      filter.date = {}
      if (fromDate) filter.date.$gte = new Date(fromDate)
      if (toDate) filter.date.$lte = new Date(toDate)
    }
    const safeLimit = limit === 'all' ? 0 : Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500)
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0)
    const [items, total] = await Promise.all([
      PurchaseOrder.find(filter).sort({ date: -1, createdAt: -1 }).skip(safeOffset).limit(safeLimit || 0).populate('vendor', 'vendorId vendorName').lean(),
      PurchaseOrder.countDocuments(filter),
    ])
    res.json({ items, total })
  } catch (error) {
    console.error('List draft PO error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/po/received - list received POs for inventory manager (status = received only)
router.get('/received', protect, requireRole('admin', 'inventory_manager'), async (req, res) => {
  try {
    const { limit = '50', offset = '0', vendor, vendorInvoiceNo, poNumber, fromDate, toDate } = req.query
    const filter = { status: 'received' }
    if (vendor && String(vendor).trim()) filter.vendor = String(vendor).trim()
    if (vendorInvoiceNo && String(vendorInvoiceNo).trim()) {
      filter.vendorInvoiceNo = { $regex: String(vendorInvoiceNo).trim(), $options: 'i' }
    }
    if (poNumber && String(poNumber).trim()) {
      filter.poNumber = { $regex: String(poNumber).trim(), $options: 'i' }
    }
    if (fromDate || toDate) {
      filter.date = {}
      if (fromDate) filter.date.$gte = new Date(fromDate)
      if (toDate) filter.date.$lte = new Date(toDate)
    }
    const safeLimit = limit === 'all' ? 0 : Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500)
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0)
    const [items, total] = await Promise.all([
      PurchaseOrder.find(filter).sort({ receivedAt: -1, date: -1, createdAt: -1 }).skip(safeOffset).limit(safeLimit || 0).populate('vendor', 'vendorId vendorName').populate('receivedBy', 'name').lean(),
      PurchaseOrder.countDocuments(filter),
    ])
    res.json({ items, total })
  } catch (error) {
    console.error('List received PO error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/po - list POs (filters: vendorInvoiceNo, fromDate, toDate, status). For inventory_receiver only draft and generated (New) are shown.
router.get('/', protect, requireRole('admin', 'inventory_manager', 'inventory_receiver'), async (req, res) => {
  try {
    const { limit = '50', offset = '0', status, vendorInvoiceNo, fromDate, toDate } = req.query
    const filter = {}
    if (req.user?.role === 'inventory_receiver') {
      filter.status = { $in: ['draft', 'generated'] }
    } else if (status && ['draft', 'generated', 'revert', 'verified', 'received'].includes(status)) {
      filter.status = status
    }
    if (vendorInvoiceNo && String(vendorInvoiceNo).trim()) {
      filter.vendorInvoiceNo = { $regex: String(vendorInvoiceNo).trim(), $options: 'i' }
    }
    if (fromDate || toDate) {
      filter.date = {}
      if (fromDate) filter.date.$gte = new Date(fromDate)
      if (toDate) filter.date.$lte = new Date(toDate)
    }
    const safeLimit = limit === 'all' ? 0 : Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500)
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0)
    const [items, total] = await Promise.all([
      PurchaseOrder.find(filter).sort({ date: -1, createdAt: -1 }).skip(safeOffset).limit(safeLimit || 0).populate('vendor', 'vendorId vendorName').lean(),
      PurchaseOrder.countDocuments(filter),
    ])
    res.json({ items, total })
  } catch (error) {
    console.error('List PO error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/po/:id - get one PO (enriches line items with unitPrice from product packing cost when missing)
router.get('/:id', protect, requireRole('admin', 'inventory_manager', 'inventory_receiver'), async (req, res) => {
  try {
    const doc = await PurchaseOrder.findById(req.params.id).populate('vendor', 'vendorId vendorName').lean()
    if (!doc) return res.status(404).json({ message: 'PO not found' })
    if (doc.lineItems && doc.lineItems.length > 0) {
      const productIds = [...new Set(doc.lineItems.map((item) => item.productId).filter(Boolean))]
      const products = await Product.find({ productId: { $in: productIds } }).select('productId packings').lean()
      const byId = Object.fromEntries(products.map((p) => [p.productId, p]))
      doc.lineItems = doc.lineItems.map((item) => {
        const unitPrice = item.unitPrice != null && item.unitPrice > 0 ? item.unitPrice : null
        if (unitPrice != null) return item
        const prod = byId[item.productId]
        const pack = (prod?.packings || []).find((p) => p.unitType === item.unitType)
        const cost = pack?.cost ?? pack?.price ?? 0
        const qty = Number(item.receiverPOQty) || 1
        return { ...item, unitPrice: cost, totalPrice: qty * cost }
      })
    }
    res.json(doc)
  } catch (error) {
    console.error('Get PO error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/po/:id/receive - receive stock: set status received, update product stock/cost/history (inventory_manager only)
router.post('/:id/receive', protect, requireRole('admin', 'inventory_manager'), async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('vendor', 'vendorId vendorName')
    if (!po) return res.status(404).json({ message: 'PO not found' })
    if (!['generated', 'revert', 'verified'].includes(po.status)) {
      return res.status(400).json({ message: 'PO must be verified before receiving stock' })
    }
    const managerName = req.user?.name || req.user?.username || 'Inventory Manager'
    const vendorName = (po.vendor && (po.vendor.vendorName || po.vendor.vendorId)) || 'Vendor'
    const remark = `Stock Received By the ${managerName} from ${vendorName}`

    for (const item of po.lineItems || []) {
      const productId = String(item.productId || '').trim()
      if (!productId) continue
      const product = await Product.findOne({ productId })
      if (!product || !product.packings) continue

      const pack = product.packings.find((p) => p.unitType === (item.unitType || 'Piece'))
      const qtyPerUnit = pack ? Number(pack.qty) || 1 : 1
      const receiverVerifiedQty = Math.max(0, Number(item.receiverVerifiedQty) || 0)
      const piecesToAdd = receiverVerifiedQty * qtyPerUnit

      if (piecesToAdd > 0) {
        const oldStock = Number(product.currentStock) || 0
        const newStock = oldStock + piecesToAdd
        product.currentStock = newStock
        product.stockHistory = product.stockHistory || []
        product.stockHistory.push({
          at: new Date(),
          oldStock,
          delta: piecesToAdd,
          newStock,
          defaultUnitType: item.unitType,
          defaultUnitQty: receiverVerifiedQty,
          referenceId: po.vendorInvoiceNo || '',
          userName: managerName,
          remark,
        })
      }

      const unitPrice = item.unitPrice != null ? Number(item.unitPrice) : null
      if (unitPrice != null && pack) {
        const packIdx = product.packings.findIndex((p) => p.unitType === (item.unitType || 'Piece'))
        if (packIdx >= 0) {
          product.packings[packIdx].cost = unitPrice
        }
      }
      if (item.expiryDate) {
        const d = new Date(item.expiryDate)
        if (!Number.isNaN(d.getTime())) product.expiryDate = d
      }
      await product.save()
    }

    po.status = 'received'
    po.receivedAt = new Date()
    po.receivedBy = req.user._id
    await po.save()

    const updated = await PurchaseOrder.findById(po._id).populate('vendor', 'vendorId vendorName').populate('receivedBy', 'name').lean()
    res.json(updated)
  } catch (error) {
    console.error('Receive PO error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// PUT /api/po/:id - update PO (vendorInvoiceNo, date, remark, lineItems, totals; optional invoice file; updates product cost/expiry when given)
router.put(
  '/:id',
  protect,
  requireRole('admin', 'inventory_manager', 'inventory_receiver'),
  upload.single('invoice'),
  async (req, res) => {
    try {
      const po = await PurchaseOrder.findById(req.params.id)
      if (!po) return res.status(404).json({ message: 'PO not found' })
      const originalStatus = po.status

      const raw = req.body || {}
      const vendorInvoiceNo = raw.vendorInvoiceNo != null ? String(raw.vendorInvoiceNo).trim() : null
      const remark = raw.remark != null ? String(raw.remark).trim().slice(0, 200) : null
      const dateRaw = raw.date
      const vendorCreditPercent = raw.vendorCreditPercent != null ? Number(raw.vendorCreditPercent) : null
      const vendorCreditAmount = raw.vendorCreditAmount != null ? Number(raw.vendorCreditAmount) : null
      const tax = raw.tax != null ? Number(raw.tax) : null
      const shippingHandling = raw.shippingHandling != null ? Number(raw.shippingHandling) : null
      const statusUpdate = raw.status
      let lineItems = null
      if (raw.lineItems !== undefined) {
        try {
          lineItems = typeof raw.lineItems === 'string' ? JSON.parse(raw.lineItems) : Array.isArray(raw.lineItems) ? raw.lineItems : null
        } catch {
          lineItems = null
        }
      }

      if (vendorInvoiceNo !== null) {
        if (!vendorInvoiceNo) {
          return res.status(400).json({ message: 'Vendor Invoice No is required' })
        }
        const existing = await PurchaseOrder.findOne({ vendorInvoiceNo, _id: { $ne: po._id } }).select('_id').lean()
        if (existing) {
          return res.status(400).json({ message: 'Vendor Invoice No already exists. It must be unique.' })
        }
        po.vendorInvoiceNo = vendorInvoiceNo
      }
      if (remark !== null) po.remark = remark
      if (dateRaw) {
        const d = new Date(dateRaw)
        if (!Number.isNaN(d.getTime())) po.date = d
      }
      if (vendorCreditPercent !== null) po.vendorCreditPercent = vendorCreditPercent
      if (vendorCreditAmount !== null) po.vendorCreditAmount = vendorCreditAmount
      if (tax !== null) po.tax = tax
      if (shippingHandling !== null) po.shippingHandling = shippingHandling

      if (statusUpdate && ['revert', 'verified'].includes(statusUpdate)) {
        if (!(statusUpdate === 'revert' && originalStatus === 'received')) {
          po.status = statusUpdate
        }
      }

      if (lineItems !== null && !(statusUpdate === 'revert' && originalStatus === 'received')) {
        const productIds = lineItems.map((item) => String(item.productId || '').trim()).filter(Boolean)
        const uniqueIds = [...new Set(productIds)]
        if (productIds.length !== uniqueIds.length) {
          return res.status(400).json({ message: 'Duplicate product in line items. Each product can only appear once per PO.' })
        }
        let subtotal = 0
        const newLineItems = lineItems.map((item) => {
          const unitPrice = Number(item.unitPrice) || 0
          const receiverVerifiedQty = Number(item.receiverVerifiedQty) || 0
          const totalPrice = receiverVerifiedQty * unitPrice
          subtotal += totalPrice
          return {
            productId: item.productId,
            productName: item.productName,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
            unitType: item.unitType || 'Piece',
            receiverPOQty: Number(item.receiverPOQty) || 1,
            totalPieces: Number(item.totalPieces) || 0,
            receiverVerifiedQty: Number(item.receiverVerifiedQty) || 0,
            unitPrice,
            totalPrice,
          }
        })
        const credit = Number(po.vendorCreditAmount) || 0
        const taxVal = Number(po.tax) || 0
        const shipVal = Number(po.shippingHandling) || 0
        po.totalAmount = Math.max(0, subtotal - credit + taxVal + shipVal)

        // When PO is received and line items change: detect removed lines and deduct stock (with validation)
        if (po.status === 'received' && Array.isArray(po.lineItems) && po.lineItems.length > 0) {
          const key = (item) => `${String(item.productId || '').trim()}|${item.unitType || 'Piece'}`
          const newKeys = new Set(newLineItems.map(key))
          const removed = (po.lineItems || []).filter((item) => !newKeys.has(key(item)))
          for (const item of removed) {
            const productId = String(item.productId || '').trim()
            const unitType = item.unitType || 'Piece'
            const receiverVerifiedQty = Number(item.receiverVerifiedQty) || 0
            const product = await Product.findOne({ productId })
            if (!product || !product.packings) continue
            const pack = product.packings.find((p) => p.unitType === unitType)
            const qtyPerUnit = pack && pack.qty ? Number(pack.qty) : 1
            const piecesToDeduct = receiverVerifiedQty * qtyPerUnit
            const currentStock = Number(product.currentStock) || 0
            if (currentStock < piecesToDeduct) {
              return res.status(400).json({
                message: `Cannot remove line: insufficient stock for product ${productId}. Current stock: ${currentStock}, required to deduct: ${piecesToDeduct}.`,
              })
            }
            const newStock = currentStock - piecesToDeduct
            const at = new Date()
            const historyEntry = {
              at,
              oldStock: currentStock,
              delta: -piecesToDeduct,
              newStock,
              referenceId: po.vendorInvoiceNo || po.poNumber || '',
              userName: req.user && req.user.name ? req.user.name : '',
              remark: 'Item removed from received PO',
            }
            await Product.updateOne(
              { productId },
              {
                $set: { currentStock: newStock },
                $push: { stockHistory: historyEntry },
              },
            )
          }
        }

        po.lineItems = newLineItems

        for (const item of lineItems) {
          const productIdRaw = String(item.productId || '').trim()
          if (!productIdRaw) continue
          const unitType = item.unitType || 'Piece'
          const unitPriceRaw = item.unitPrice
          const unitPrice = unitPriceRaw !== undefined && unitPriceRaw !== null ? Number(unitPriceRaw) : null
          const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null
          let product = await Product.findOne({ productId: productIdRaw }).lean()
          if (!product && /^[a-fA-F0-9]{24}$/.test(productIdRaw)) {
            product = await Product.findById(productIdRaw).lean()
          }
          if (!product || !product.packings) continue
          const productIdForUpdate = product.productId || String(product._id)
          const packIdx = product.packings.findIndex((p) => p.unitType === unitType)
          if (packIdx >= 0 && unitPrice !== null && !Number.isNaN(unitPrice)) {
            await Product.updateOne(
              { productId: productIdForUpdate },
              {
                $set: {
                  [`packings.${packIdx}.cost`]: unitPrice,
                  [`packings.${packIdx}.price`]: unitPrice,
                },
              },
            )
          }
          if (expiryDate != null && !Number.isNaN(expiryDate.getTime())) {
            await Product.updateOne({ productId: productIdForUpdate }, { $set: { expiryDate } })
          }
        }
      }

      // Revert a previously received PO: reverse stock added on receivePo
      if (statusUpdate === 'revert' && originalStatus === 'received') {
        // First pass: validate there is enough stock for every line to be reversed
        for (const item of po.lineItems || []) {
          const productId = String(item.productId || '').trim()
          if (!productId) continue
          const unitType = item.unitType || 'Piece'
          const receiverVerifiedQty = Number(item.receiverVerifiedQty) || 0
          if (receiverVerifiedQty <= 0) continue
          const product = await Product.findOne({ productId })
          if (!product || !product.packings) continue
          const pack = product.packings.find((p) => p.unitType === unitType)
          const qtyPerUnit = pack && pack.qty ? Number(pack.qty) : 1
          const piecesToDeduct = receiverVerifiedQty * qtyPerUnit
          const currentStock = Number(product.currentStock) || 0
          if (currentStock < piecesToDeduct) {
            return res.status(400).json({
              message: `Cannot revert PO. Current stock for product ${product.productId || productId} is less than received quantity.`,
            })
          }
        }

        // Second pass: actually deduct stock and add stock history entries
        const managerName = req.user?.name || req.user?.username || 'Inventory Manager'
        for (const item of po.lineItems || []) {
          const productId = String(item.productId || '').trim()
          if (!productId) continue
          const unitType = item.unitType || 'Piece'
          const receiverVerifiedQty = Number(item.receiverVerifiedQty) || 0
          if (receiverVerifiedQty <= 0) continue
          const product = await Product.findOne({ productId })
          if (!product || !product.packings) continue
          const pack = product.packings.find((p) => p.unitType === unitType)
          const qtyPerUnit = pack && pack.qty ? Number(pack.qty) : 1
          const piecesToDeduct = receiverVerifiedQty * qtyPerUnit
          const currentStock = Number(product.currentStock) || 0
          const newStock = currentStock - piecesToDeduct
          product.currentStock = newStock
          product.stockHistory = product.stockHistory || []
          product.stockHistory.push({
            at: new Date(),
            oldStock: currentStock,
            delta: -piecesToDeduct,
            newStock,
            defaultUnitType: unitType,
            defaultUnitQty: receiverVerifiedQty,
            referenceId: po.vendorInvoiceNo || '',
            userName: managerName,
            remark: 'PO reverted – stock removed',
          })
          await product.save()
        }

        po.status = 'revert'
      }
      if (req.file && req.file.filename) po.invoiceFileName = req.file.filename
      await po.save()
      const updated = await PurchaseOrder.findById(po._id).populate('vendor', 'vendorId vendorName').lean()
      res.json(updated)
    } catch (error) {
      if (error.message && error.message.includes('Invalid file')) {
        return res.status(400).json({ message: error.message })
      }
      console.error('Update PO error:', error)
      res.status(500).json({ message: 'Server error' })
    }
  },
)

// DELETE /api/po/:id
router.delete('/:id', protect, requireRole('admin', 'inventory_manager', 'inventory_receiver'), async (req, res) => {
  try {
    const doc = await PurchaseOrder.findByIdAndDelete(req.params.id)
    if (!doc) return res.status(404).json({ message: 'PO not found' })
    res.json({ message: 'PO deleted' })
  } catch (error) {
    console.error('Delete PO error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
