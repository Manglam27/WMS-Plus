import express from 'express'
import Customer from '../models/Customer.js'
import SalesOrder from '../models/SalesOrder.js'
import SalesCreditMemo from '../models/SalesCreditMemo.js'
import SalesPayment from '../models/SalesPayment.js'
import { protect, requireRole } from '../middleware/auth.js'

const router = express.Router()
const salesRoles = ['sales_person', 'sales_manager', 'admin']

// Address helper (server-side proxy to avoid browser CORS)
router.get('/address/search', protect, requireRole(...salesRoles), async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    if (!q || q.length < 4) return res.json({ items: [] })
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=us&limit=8&q=${encodeURIComponent(q)}`
    const r = await fetch(url, {
      headers: {
        Accept: 'application/json',
        // Nominatim policy requires a valid UA
        'User-Agent': 'WMS-Plus/1.0 (address helper)',
      },
    })
    if (!r.ok) return res.json({ items: [] })
    const data = await r.json().catch(() => [])
    const items = (Array.isArray(data) ? data : []).map((x) => ({
      place_id: x.place_id,
      display_name: x.display_name,
      address: x.address || {},
      country_code: x.address?.country_code || '',
    }))
    res.json({ items })
  } catch (e) {
    res.json({ items: [] })
  }
})

async function nextSeq(prefix, model, field) {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const dayPart = `${y}${m}${d}`
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-${dayPart}-`)
  const count = await model.countDocuments({ [field]: { $regex: re } })
  const n = count + 1
  return `${prefix}-${dayPart}-${String(n).padStart(4, '0')}`
}

// ——— Customers ———
router.post('/customers', protect, requireRole(...salesRoles), async (req, res) => {
  try {
    const {
      customerName,
      customerType,
      taxId,
      terms,
      businessName,
      otpLicence,
      storeOpenTime,
      storeCloseTime,
      remark,
      billingAddress,
      shippingAddress,
      shippingSameAsBilling,
      contacts,
      priceLevelMode,
      matchedCustomerId,
      customPriceLevelName,
      extraNotes,
    } = req.body || {}

    if (!customerName || !customerType) {
      return res.status(400).json({ message: 'Customer name and customer type are required.' })
    }
    if (!['Retail', 'Wholesale'].includes(customerType)) {
      return res.status(400).json({ message: 'Customer type must be Retail or Wholesale.' })
    }

    const mode = ['auto', 'match', 'new'].includes(priceLevelMode) ? priceLevelMode : 'auto'
    let priceLevelCode = ''
    let matchedCustomer = null

    if (mode === 'match') {
      if (!matchedCustomerId) {
        return res.status(400).json({ message: 'Select a customer to match price level.' })
      }
      matchedCustomer = await Customer.findOne({
        _id: matchedCustomerId,
        salesPerson: req.user._id,
      }).lean()
      if (!matchedCustomer) {
        return res.status(400).json({ message: 'Matched customer not found or not assigned to you.' })
      }
      priceLevelCode = matchedCustomer.priceLevelCode || `PL-MATCH-${matchedCustomer._id}`
    } else if (mode === 'new') {
      if (!customPriceLevelName || !String(customPriceLevelName).trim()) {
        return res.status(400).json({ message: 'Enter a name for the new price level.' })
      }
      priceLevelCode = `PL-${String(customPriceLevelName).trim().replace(/\s+/g, '-').slice(0, 40).toUpperCase()}`
    } else {
      priceLevelCode = await nextSeq('PL-AUTO', Customer, 'priceLevelCode')
    }

    const doc = await Customer.create({
      // customerNumber is generated on approval
      customerNumber: null,
      customerName: String(customerName).trim(),
      customerType,
      taxId: taxId != null ? String(taxId).trim() : '',
      terms: terms != null ? String(terms).trim() : '',
      businessName: businessName != null ? String(businessName).trim() : '',
      otpLicence: otpLicence != null ? String(otpLicence).trim() : '',
      storeOpenTime: storeOpenTime != null ? String(storeOpenTime).trim() : '',
      storeCloseTime: storeCloseTime != null ? String(storeCloseTime).trim() : '',
      remark: remark != null ? String(remark).trim().slice(0, 2000) : '',
      billingAddress: typeof billingAddress === 'object' && billingAddress ? billingAddress : {},
      shippingAddress: typeof shippingAddress === 'object' && shippingAddress ? shippingAddress : {},
      shippingSameAsBilling: shippingSameAsBilling !== false,
      contacts: Array.isArray(contacts) ? contacts : [],
      priceLevelMode: mode,
      matchedCustomer: mode === 'match' ? matchedCustomer._id : null,
      customPriceLevelName: mode === 'new' ? String(customPriceLevelName).trim() : '',
      priceLevelCode,
      extraNotes: extraNotes != null ? String(extraNotes).trim().slice(0, 2000) : '',
      salesPerson: req.user._id,
      status: 'pending',
    })

    res.status(201).json(doc)
  } catch (e) {
    console.error('Create customer error:', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Approve customer request (sales_manager/admin): generates Customer ID and activates
router.patch('/customers/:id/approve', protect, requireRole('sales_manager', 'admin'), async (req, res) => {
  try {
    const doc = await Customer.findById(req.params.id)
    if (!doc) return res.status(404).json({ message: 'Customer not found' })
    if (doc.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending customers can be approved.' })
    }
    const customerNumber = await nextSeq('CUS', Customer, 'customerNumber')
    doc.customerNumber = customerNumber
    doc.status = 'active'
    doc.approvedAt = new Date()
    doc.approvedBy = req.user._id
    await doc.save()
    res.json(doc)
  } catch (e) {
    console.error('Approve customer error:', e)
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/customers', protect, requireRole(...salesRoles), async (req, res) => {
  try {
    const q = { salesPerson: req.user._id }
    if (req.user.role === 'admin') {
      delete q.salesPerson
    }
    const list = await Customer.find(q).sort({ createdAt: -1 }).lean()
    res.json(list)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/customers/:id', protect, requireRole(...salesRoles), async (req, res) => {
  try {
    const q = { _id: req.params.id }
    if (req.user.role !== 'admin') q.salesPerson = req.user._id
    const doc = await Customer.findOne(q).populate('salesPerson', 'name username').lean()
    if (!doc) return res.status(404).json({ message: 'Customer not found' })
    res.json(doc)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

// ——— Orders ———
router.post('/orders', protect, requireRole(...salesRoles), async (req, res) => {
  try {
    const {
      customerId,
      lineItems,
      status,
      orderDate,
      deliveryDate,
      terms,
      shippingType,
      billingAddress,
      shippingAddress,
      salesPersonRemark,
      driverRemark,
      overallDiscountPercent,
      overallDiscountAmount,
      shippingCharges,
      taxType,
      taxPercent,
      totalTax,
      mlQuantity,
      mlTax,
      weightQuantity,
      weightTax,
      vapeTax,
      adjustment,
    } = req.body || {}
    if (!customerId) return res.status(400).json({ message: 'Customer is required.' })

    const customer = await Customer.findOne({
      _id: customerId,
      ...(req.user.role !== 'admin' ? { salesPerson: req.user._id } : {}),
    })
    if (!customer) return res.status(404).json({ message: 'Customer not found' })
    if (customer.status === 'inactive') {
      return res.status(400).json({ message: 'Cannot create order for an inactive customer.' })
    }

    const orderNumber = await nextSeq('SO', SalesOrder, 'orderNumber')
    const items = Array.isArray(lineItems) ? lineItems : []
    let subtotal = 0
    const normalized = items.map((row) => {
      const qty = Math.max(0, Number(row.qty) || 0)
      const qtyPerUnit = Math.max(1, Number(row.qtyPerUnit) || 1)
      const pieces = Math.max(0, qty * qtyPerUnit)
      const unitPrice = Math.max(0, Number(row.unitPrice) || 0)
      const srp = Math.max(0, Number(row.srp) || 0)
      const lineTotal = Math.round(qty * unitPrice * 100) / 100
      const discountPercent = Math.max(0, Number(row.discountPercent) || 0)
      const discountAmount = Math.max(0, Number(row.discountAmount) || 0)
      const netPrice = Math.max(0, lineTotal - discountAmount)
      subtotal += netPrice
      return {
        productId: String(row.productId || '').trim(),
        productName: String(row.productName || '').trim() || 'Product',
        unitType: row.unitType || 'Piece',
        qtyPerUnit,
        qty,
        pieces,
        unitPrice,
        srp,
        lineTotal,
        discountPercent,
        discountAmount,
        netPrice,
        isExchange: !!row.isExchange,
        isTaxable: row.isTaxable !== false,
        isFreeItem: !!row.isFreeItem,
      }
    })

    const orderDateVal = orderDate ? new Date(orderDate) : new Date()
    const deliveryDateVal = deliveryDate ? new Date(deliveryDate) : null
    const discPct = Math.max(0, Number(overallDiscountPercent) || 0)
    const discAmt = Math.max(0, Number(overallDiscountAmount) || 0)
    const ship = Math.max(0, Number(shippingCharges) || 0)
    const taxPct = Math.max(0, Number(taxPercent) || 0)
    const totalTaxVal = Math.max(0, Number(totalTax) || 0)
    const mlQty = Math.max(0, Number(mlQuantity) || 0)
    const mlTaxVal = Math.max(0, Number(mlTax) || 0)
    const wtQty = Math.max(0, Number(weightQuantity) || 0)
    const wtTaxVal = Math.max(0, Number(weightTax) || 0)
    const vapeTaxVal = Math.max(0, Number(vapeTax) || 0)
    const adj = Number(adjustment) || 0
    const orderTotal = Math.max(0, subtotal - discAmt + ship + totalTaxVal + mlTaxVal + wtTaxVal + vapeTaxVal + adj)

    const doc = await SalesOrder.create({
      orderNumber,
      customer: customer._id,
      salesPerson: req.user._id,
      status: status === 'submitted' ? 'submitted' : 'new',
      orderDate: Number.isNaN(orderDateVal.getTime()) ? new Date() : orderDateVal,
      deliveryDate: deliveryDateVal && !Number.isNaN(deliveryDateVal.getTime()) ? deliveryDateVal : undefined,
      terms: terms != null ? String(terms).trim().slice(0, 200) : '',
      shippingType: shippingType != null ? String(shippingType).trim().slice(0, 100) : 'Ground Shipping',
      billingAddress: billingAddress != null ? String(billingAddress).trim().slice(0, 1000) : '',
      shippingAddress: shippingAddress != null ? String(shippingAddress).trim().slice(0, 1000) : '',
      lineItems: normalized,
      salesPersonRemark: salesPersonRemark != null ? String(salesPersonRemark).trim().slice(0, 500) : '',
      driverRemark: driverRemark != null ? String(driverRemark).trim().slice(0, 500) : '',
      subtotal: Math.round(subtotal * 100) / 100,
      overallDiscountPercent: discPct,
      overallDiscountAmount: discAmt,
      shippingCharges: ship,
      taxType: taxType != null ? String(taxType).trim().slice(0, 100) : '',
      taxPercent: taxPct,
      totalTax: totalTaxVal,
      mlQuantity: mlQty,
      mlTax: mlTaxVal,
      weightQuantity: wtQty,
      weightTax: wtTaxVal,
      vapeTax: vapeTaxVal,
      adjustment: adj,
      orderTotal: Math.round(orderTotal * 100) / 100,
    })
    res.status(201).json(doc)
  } catch (e) {
    console.error('Create sales order error:', e)
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/orders', protect, requireRole(...salesRoles), async (req, res) => {
  try {
    const q = { salesPerson: req.user._id }
    if (req.user.role === 'admin') delete q.salesPerson
    const { status } = req.query
    if (status) q.status = status
    const list = await SalesOrder.find(q)
      .populate('customer', 'businessName customerNumber')
      .populate('salesPerson', 'name username')
      .sort({ createdAt: -1 })
      .lean()
    res.json(list)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/orders/:id', protect, requireRole(...salesRoles), async (req, res) => {
  try {
    const q = { _id: req.params.id }
    if (req.user.role !== 'admin') q.salesPerson = req.user._id
    const doc = await SalesOrder.findOne(q).populate('customer').lean()
    if (!doc) return res.status(404).json({ message: 'Order not found' })
    res.json(doc)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

router.put('/orders/:id', protect, requireRole(...salesRoles), async (req, res) => {
  try {
    const q = { _id: req.params.id }
    if (req.user.role !== 'admin') q.salesPerson = req.user._id
    const doc = await SalesOrder.findOne(q)
    if (!doc) return res.status(404).json({ message: 'Order not found' })
    if (!['draft', 'new'].includes(doc.status)) {
      return res.status(400).json({ message: 'Only new/draft orders can be edited.' })
    }

    const {
      lineItems,
      status,
      orderDate,
      deliveryDate,
      terms,
      shippingType,
      billingAddress,
      shippingAddress,
      salesPersonRemark,
      driverRemark,
      overallDiscountPercent,
      overallDiscountAmount,
      shippingCharges,
      taxType,
      taxPercent,
      totalTax,
      mlQuantity,
      mlTax,
      weightQuantity,
      weightTax,
      vapeTax,
      adjustment,
    } = req.body || {}
    if (lineItems != null) {
      const items = Array.isArray(lineItems) ? lineItems : []
      let subtotal = 0
      doc.lineItems = items.map((row) => {
        const qty = Math.max(0, Number(row.qty) || 0)
        const qtyPerUnit = Math.max(1, Number(row.qtyPerUnit) || 1)
        const pieces = Math.max(0, qty * qtyPerUnit)
        const unitPrice = Math.max(0, Number(row.unitPrice) || 0)
        const srp = Math.max(0, Number(row.srp) || 0)
        const lineTotal = Math.round(qty * unitPrice * 100) / 100
        const discountPercent = Math.max(0, Number(row.discountPercent) || 0)
        const discountAmount = Math.max(0, Number(row.discountAmount) || 0)
        const netPrice = Math.max(0, lineTotal - discountAmount)
        subtotal += netPrice
        return {
          productId: String(row.productId || '').trim(),
          productName: String(row.productName || '').trim() || 'Product',
          unitType: row.unitType || 'Piece',
          qtyPerUnit,
          qty,
          pieces,
          unitPrice,
          srp,
          lineTotal,
          discountPercent,
          discountAmount,
          netPrice,
          isExchange: !!row.isExchange,
          isTaxable: row.isTaxable !== false,
          isFreeItem: !!row.isFreeItem,
        }
      })
      doc.subtotal = Math.round(subtotal * 100) / 100
    }
    if (orderDate) {
      const d = new Date(orderDate)
      if (!Number.isNaN(d.getTime())) doc.orderDate = d
    }
    if (deliveryDate) {
      const d = new Date(deliveryDate)
      if (!Number.isNaN(d.getTime())) doc.deliveryDate = d
    }
    if (terms != null) doc.terms = String(terms).trim().slice(0, 200)
    if (shippingType != null) doc.shippingType = String(shippingType).trim().slice(0, 100)
    if (billingAddress != null) doc.billingAddress = String(billingAddress).trim().slice(0, 1000)
    if (shippingAddress != null) doc.shippingAddress = String(shippingAddress).trim().slice(0, 1000)
    if (salesPersonRemark != null) doc.salesPersonRemark = String(salesPersonRemark).trim().slice(0, 500)
    if (driverRemark != null) doc.driverRemark = String(driverRemark).trim().slice(0, 500)
    if (overallDiscountPercent != null) doc.overallDiscountPercent = Math.max(0, Number(overallDiscountPercent) || 0)
    if (overallDiscountAmount != null) doc.overallDiscountAmount = Math.max(0, Number(overallDiscountAmount) || 0)
    if (shippingCharges != null) doc.shippingCharges = Math.max(0, Number(shippingCharges) || 0)
    if (taxType != null) doc.taxType = String(taxType).trim().slice(0, 100)
    if (taxPercent != null) doc.taxPercent = Math.max(0, Number(taxPercent) || 0)
    if (totalTax != null) doc.totalTax = Math.max(0, Number(totalTax) || 0)
    if (mlQuantity != null) doc.mlQuantity = Math.max(0, Number(mlQuantity) || 0)
    if (mlTax != null) doc.mlTax = Math.max(0, Number(mlTax) || 0)
    if (weightQuantity != null) doc.weightQuantity = Math.max(0, Number(weightQuantity) || 0)
    if (weightTax != null) doc.weightTax = Math.max(0, Number(weightTax) || 0)
    if (vapeTax != null) doc.vapeTax = Math.max(0, Number(vapeTax) || 0)
    if (adjustment != null) doc.adjustment = Number(adjustment) || 0

    const subtotalVal = Number(doc.subtotal) || 0
    const discAmt = Number(doc.overallDiscountAmount) || 0
    const ship = Number(doc.shippingCharges) || 0
    const orderTotal = Math.max(
      0,
      subtotalVal - discAmt + ship + (Number(doc.totalTax) || 0) + (Number(doc.mlTax) || 0) + (Number(doc.weightTax) || 0) + (Number(doc.vapeTax) || 0) + (Number(doc.adjustment) || 0),
    )
    doc.orderTotal = Math.round(orderTotal * 100) / 100

    if (status === 'submitted' && ['draft', 'new'].includes(doc.status)) doc.status = 'submitted'
    await doc.save()
    const updated = await SalesOrder.findById(doc._id).populate('customer').lean()
    res.json(updated)
  } catch (e) {
    console.error('Update sales order error:', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// ——— Credit memos ———
router.post('/credit-memos', protect, requireRole(...salesRoles), async (req, res) => {
  try {
    const { customerId, amount, reason, status } = req.body || {}
    if (!customerId) return res.status(400).json({ message: 'Customer is required.' })
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt < 0) return res.status(400).json({ message: 'Valid amount is required.' })

    const customer = await Customer.findOne({
      _id: customerId,
      ...(req.user.role !== 'admin' ? { salesPerson: req.user._id } : {}),
    })
    if (!customer) return res.status(404).json({ message: 'Customer not found' })

    const memoNumber = await nextSeq('CM', SalesCreditMemo, 'memoNumber')
    const doc = await SalesCreditMemo.create({
      memoNumber,
      customer: customer._id,
      salesPerson: req.user._id,
      amount: amt,
      reason: reason != null ? String(reason).trim().slice(0, 1000) : '',
      status: status === 'submitted' ? 'submitted' : 'draft',
    })
    res.status(201).json(doc)
  } catch (e) {
    console.error('Create credit memo error:', e)
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/credit-memos', protect, requireRole(...salesRoles), async (req, res) => {
  try {
    const q = { salesPerson: req.user._id }
    if (req.user.role === 'admin') delete q.salesPerson
    const list = await SalesCreditMemo.find(q).populate('customer', 'businessName customerNumber').sort({ createdAt: -1 }).lean()
    res.json(list)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

// ——— Payments ———
router.post('/payments', protect, requireRole(...salesRoles), async (req, res) => {
  try {
    const { customerId, amount, method, reference, notes } = req.body || {}
    if (!customerId) return res.status(400).json({ message: 'Customer is required.' })
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ message: 'Valid amount is required.' })

    const customer = await Customer.findOne({
      _id: customerId,
      ...(req.user.role !== 'admin' ? { salesPerson: req.user._id } : {}),
    })
    if (!customer) return res.status(404).json({ message: 'Customer not found' })

    const paymentNumber = await nextSeq('PAY', SalesPayment, 'paymentNumber')
    const doc = await SalesPayment.create({
      paymentNumber,
      customer: customer._id,
      salesPerson: req.user._id,
      amount: amt,
      method: method != null ? String(method).trim() : 'cash',
      reference: reference != null ? String(reference).trim() : '',
      notes: notes != null ? String(notes).trim().slice(0, 1000) : '',
    })
    res.status(201).json(doc)
  } catch (e) {
    console.error('Create payment error:', e)
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/payments', protect, requireRole(...salesRoles), async (req, res) => {
  try {
    const q = { salesPerson: req.user._id }
    if (req.user.role === 'admin') delete q.salesPerson
    const list = await SalesPayment.find(q).populate('customer', 'businessName customerNumber').sort({ createdAt: -1 }).lean()
    res.json(list)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Dashboard counts
router.get('/stats', protect, requireRole(...salesRoles), async (req, res) => {
  try {
    const sp = req.user.role === 'admin' ? {} : { salesPerson: req.user._id }
    const [customers, draftOrders, openOrders] = await Promise.all([
      Customer.countDocuments(sp),
      SalesOrder.countDocuments({ ...sp, status: 'draft' }),
      SalesOrder.countDocuments({ ...sp, status: { $in: ['submitted', 'confirmed'] } }),
    ])
    res.json({ customers, draftOrders, openOrders })
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
