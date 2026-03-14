import express from 'express'
import multer from 'multer'
import path from 'path'
import PurchaseOrder from '../models/PurchaseOrder.js'
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

// GET /api/po - list POs (filters: vendorInvoiceNo, fromDate, toDate, status)
router.get('/', protect, requireRole('admin', 'inventory_manager', 'inventory_receiver'), async (req, res) => {
  try {
    const { limit = '50', offset = '0', status, vendorInvoiceNo, fromDate, toDate } = req.query
    const filter = {}
    if (status && ['draft', 'generated'].includes(status)) filter.status = status
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

// GET /api/po/:id - get one PO
router.get('/:id', protect, requireRole('admin', 'inventory_manager', 'inventory_receiver'), async (req, res) => {
  try {
    const doc = await PurchaseOrder.findById(req.params.id).populate('vendor', 'vendorId vendorName').lean()
    if (!doc) return res.status(404).json({ message: 'PO not found' })
    res.json(doc)
  } catch (error) {
    console.error('Get PO error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// PUT /api/po/:id - update PO (vendorInvoiceNo, remark, lineItems; optional invoice file)
router.put(
  '/:id',
  protect,
  requireRole('admin', 'inventory_manager', 'inventory_receiver'),
  upload.single('invoice'),
  async (req, res) => {
    try {
      const po = await PurchaseOrder.findById(req.params.id)
      if (!po) return res.status(404).json({ message: 'PO not found' })

      const raw = req.body || {}
      const vendorInvoiceNo = raw.vendorInvoiceNo != null ? String(raw.vendorInvoiceNo).trim() : null
      const remark = raw.remark != null ? String(raw.remark).trim().slice(0, 200) : null
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
      if (lineItems !== null) {
        const productIds = lineItems.map((item) => String(item.productId || '').trim()).filter(Boolean)
        const uniqueIds = [...new Set(productIds)]
        if (productIds.length !== uniqueIds.length) {
          return res.status(400).json({ message: 'Duplicate product in line items. Each product can only appear once per PO.' })
        }
        po.lineItems = lineItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
          unitType: item.unitType || 'Piece',
          receiverPOQty: Number(item.receiverPOQty) || 1,
          totalPieces: Number(item.totalPieces) || 0,
        }))
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
