import express from 'express'
import Vendor from '../models/Vendor.js'
import { protect, requireRole } from '../middleware/auth.js'

const router = express.Router()

// GET /api/vendors - list vendors with search (vendorName, vendorInvoiceNo, contactPerson)
router.get('/', protect, requireRole('admin', 'inventory_manager', 'inventory_receiver'), async (req, res) => {
  try {
    const {
      limit = '10',
      offset = '0',
      vendorName,
      vendorInvoiceNo,
      contactPerson,
    } = req.query

    const safeLimit = limit === 'all' ? 0 : Math.min(Math.max(parseInt(limit, 10) || 10, 1), 500)
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0)

    const filter = {}
    if (vendorName && String(vendorName).trim()) {
      filter.vendorNameLower = { $regex: String(vendorName).trim().toLowerCase(), $options: 'i' }
    }
    if (vendorInvoiceNo && String(vendorInvoiceNo).trim()) {
      filter.lastVendorInvoiceNo = { $regex: String(vendorInvoiceNo).trim(), $options: 'i' }
    }
    if (contactPerson && String(contactPerson).trim()) {
      filter.contactPerson = { $regex: String(contactPerson).trim(), $options: 'i' }
    }

    const [items, total] = await Promise.all([
      Vendor.find(filter)
        .sort({ vendorId: 1 })
        .skip(safeOffset)
        .limit(safeLimit || 0)
        .lean(),
      Vendor.countDocuments(filter),
    ])

    res.json({ items, total })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('List vendors error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Generate next vendor ID in range VEN001–VEN999
async function getNextVendorId() {
  const docs = await Vendor.find({ vendorId: /^VEN\d{3}$/ })
    .select('vendorId')
    .lean()
  const numbers = docs.map((d) => parseInt(d.vendorId.replace('VEN', ''), 10)).filter((n) => !Number.isNaN(n))
  const max = numbers.length ? Math.max(...numbers) : 0
  const next = Math.min(max + 1, 999)
  const id = `VEN${String(next).padStart(3, '0')}`
  const exists = await Vendor.findOne({ vendorId: id }).select('_id').lean()
  if (exists) {
    throw new Error('No available vendor ID in VEN001–VEN999')
  }
  return id
}

// GET /api/vendors/next-id - get next auto-generated vendor ID (for form display)
router.get('/next-id', protect, requireRole('admin', 'inventory_manager'), async (req, res) => {
  try {
    const vendorId = await getNextVendorId()
    res.json({ vendorId })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Next vendor ID error:', error)
    res.status(500).json({ message: error.message || 'Server error' })
  }
})

// GET /api/vendors/:id - get one vendor by MongoDB _id
router.get('/:id', protect, requireRole('admin', 'inventory_manager'), async (req, res) => {
  try {
    const { id } = req.params
    const doc = await Vendor.findById(id).lean()
    if (!doc) return res.status(404).json({ message: 'Vendor not found' })
    res.json(doc)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Get vendor error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/vendors - create vendor (vendorId auto-generated)
router.post('/', protect, requireRole('admin', 'inventory_manager'), async (req, res) => {
  try {
    const vendorId = await getNextVendorId()
    const {
      vendorName,
      status,
      subType,
      companyName,
      contactPerson,
      designation,
      cell,
      fax,
      emailId,
      office,
      website,
      notes,
      address1,
      address2,
      zipCode,
      city,
      state,
      country,
    } = req.body

    if (!vendorName || !String(vendorName).trim()) {
      return res.status(400).json({ message: 'Vendor name is required' })
    }

    const vendorNameLower = String(vendorName).trim().toLowerCase()
    const doc = await Vendor.create({
      vendorId,
      vendorName: String(vendorName).trim(),
      vendorNameLower,
      status: status === 'Inactive' ? 'Inactive' : 'Active',
      subType: subType ? String(subType).trim() : undefined,
      companyName: companyName ? String(companyName).trim() : undefined,
      contactPerson: contactPerson ? String(contactPerson).trim() : undefined,
      designation: designation ? String(designation).trim() : undefined,
      cell: cell ? String(cell).trim() : undefined,
      fax: fax ? String(fax).trim() : undefined,
      emailId: emailId ? String(emailId).trim() : undefined,
      office: office ? String(office).trim() : undefined,
      website: website ? String(website).trim() : undefined,
      notes: notes ? String(notes).trim() : undefined,
      address1: address1 ? String(address1).trim() : undefined,
      address2: address2 ? String(address2).trim() : undefined,
      zipCode: zipCode ? String(zipCode).trim() : undefined,
      city: city ? String(city).trim() : undefined,
      state: state ? String(state).trim() : undefined,
      country: country ? String(country).trim() : undefined,
      phoneNo: cell ? String(cell).trim() : undefined,
      officeContact: office ? String(office).trim() : undefined,
    })

    res.status(201).json(doc)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Create vendor error:', error)
    if (error.message && error.message.includes('vendor ID')) {
      return res.status(400).json({ message: error.message })
    }
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
