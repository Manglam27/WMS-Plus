import express from 'express'
import Customer from '../models/Customer.js'
import SalesOrder from '../models/SalesOrder.js'
import SalesCreditMemo from '../models/SalesCreditMemo.js'
import SalesPayment from '../models/SalesPayment.js'
import PriceLevelProductPrice from '../models/PriceLevelProductPrice.js'
import WarehouseTask from '../models/WarehouseTask.js'
import User from '../models/User.js'
import { protect, requireRole } from '../middleware/auth.js'

const router = express.Router()
const salesRoles = ['sales_person', 'sales_manager', 'admin']
const orderWorkflowRoles = ['sales_person', 'sales_manager', 'admin', 'order_manager', 'scanner_packer', 'driver', 'accounts']
const canManageAllSalesData = (user) => user?.role === 'admin' || user?.role === 'sales_manager'
const canManageOrderWorkflow = (user) => ['admin', 'sales_manager', 'order_manager'].includes(user?.role)
const getActorName = (user) => String(user?.name || user?.username || user?.role || 'User')

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

async function nextCustomerNumber() {
  const docs = await Customer.find({ customerNumber: { $regex: /^CST\d{5}$/ } })
    .select('customerNumber')
    .lean()
  let max = 0
  for (const d of docs) {
    const raw = String(d.customerNumber || '')
    const n = Number(raw.slice(3))
    if (Number.isFinite(n) && n > max) max = n
  }
  let next = max + 1
  for (let i = 0; i < 20; i += 1) {
    const candidate = `CST${String(next).padStart(5, '0')}`
    const exists = await Customer.exists({ customerNumber: candidate })
    if (!exists) return candidate
    next += 1
  }
  throw new Error('Unable to generate unique customer number')
}

async function nextOrderNumber() {
  const docs = await SalesOrder.find({ orderNumber: { $regex: /^ORD\d{7}$/ } })
    .select('orderNumber')
    .lean()
  let max = 0
  for (const d of docs) {
    const raw = String(d.orderNumber || '')
    const n = Number(raw.slice(3))
    if (Number.isFinite(n) && n > max) max = n
  }
  let next = max + 1
  for (let i = 0; i < 50; i += 1) {
    const candidate = `ORD${String(next).padStart(7, '0')}`
    const exists = await SalesOrder.exists({ orderNumber: candidate })
    if (!exists) return candidate
    next += 1
  }
  throw new Error('Unable to generate unique order number')
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
      salesPersonId,
      autoApprove,
    } = req.body || {}

    if (!customerName || !customerType) {
      return res.status(400).json({ message: 'Customer name and customer type are required.' })
    }
    if (!['Retail', 'Wholesale'].includes(customerType)) {
      return res.status(400).json({ message: 'Customer type must be Retail or Wholesale.' })
    }

    const billing = typeof billingAddress === 'object' && billingAddress ? billingAddress : {}
    const billingAddress1 = String(billing.address1 || '').trim()
    const billingZip = String(billing.zipCode || '').trim()
    const billingState = String(billing.state || '').trim()
    const billingCity = String(billing.city || '').trim()

    // Prevent creating duplicate customers for the same billing address.
    if (billingAddress1 && billingZip) {
      const duplicate = await Customer.findOne({
        'billingAddress.address1': billingAddress1,
        'billingAddress.zipCode': billingZip,
        'billingAddress.state': billingState,
        'billingAddress.city': billingCity,
      }).lean()
      if (duplicate) {
        return res.status(400).json({
          message: 'A customer with the same billing address already exists.',
        })
      }
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
        ...(canManageAllSalesData(req.user) ? {} : { salesPerson: req.user._id }),
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

    let assignedSalesPersonId = req.user._id
    if (canManageAllSalesData(req.user) && !salesPersonId) {
      return res.status(400).json({ message: 'Associated sales person is required.' })
    }
    if (canManageAllSalesData(req.user) && salesPersonId) {
      const assignedUser = await User.findOne({
        _id: salesPersonId,
        role: 'sales_person',
        isActive: { $ne: false },
      }).lean()
      if (!assignedUser) {
        return res.status(400).json({ message: 'Selected sales person is invalid or inactive.' })
      }
      assignedSalesPersonId = assignedUser._id
    }

    const managerAutoApprove = canManageAllSalesData(req.user) && autoApprove !== false
    const doc = await Customer.create({
      // customerNumber is generated on approval
      customerNumber: managerAutoApprove ? await nextCustomerNumber() : null,
      customerName: String(customerName).trim(),
      customerType,
      taxId: taxId != null ? String(taxId).trim() : '',
      terms: terms != null ? String(terms).trim() : '',
      businessName: businessName != null ? String(businessName).trim() : '',
      otpLicence: otpLicence != null ? String(otpLicence).trim() : '',
      storeOpenTime: storeOpenTime != null ? String(storeOpenTime).trim() : '',
      storeCloseTime: storeCloseTime != null ? String(storeCloseTime).trim() : '',
      remark: remark != null ? String(remark).trim().slice(0, 2000) : '',
      billingAddress: billing,
      shippingAddress: typeof shippingAddress === 'object' && shippingAddress ? shippingAddress : {},
      shippingSameAsBilling: shippingSameAsBilling !== false,
      contacts: Array.isArray(contacts) ? contacts : [],
      priceLevelMode: mode,
      matchedCustomer: mode === 'match' ? matchedCustomer._id : null,
      customPriceLevelName: mode === 'new' ? String(customPriceLevelName).trim() : '',
      priceLevelCode,
      extraNotes: extraNotes != null ? String(extraNotes).trim().slice(0, 2000) : '',
      salesPerson: assignedSalesPersonId,
      status: managerAutoApprove ? 'active' : 'pending',
      approvedAt: managerAutoApprove ? new Date() : undefined,
      approvedBy: managerAutoApprove ? req.user._id : undefined,
    })

    res.status(201).json(doc)
  } catch (e) {
    if (e && e.code === 11000 && e.keyPattern?.customerNumber) {
      return res.status(409).json({ message: 'Customer ID already exists. Please retry.' })
    }
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
    const customerNumber = await nextCustomerNumber()
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

// Decline customer request (sales_manager/admin): moves pending request to inactive
router.patch('/customers/:id/decline', protect, requireRole('sales_manager', 'admin'), async (req, res) => {
  try {
    const doc = await Customer.findById(req.params.id)
    if (!doc) return res.status(404).json({ message: 'Customer not found' })
    if (doc.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending customers can be declined.' })
    }
    doc.status = 'inactive'
    doc.approvedAt = new Date()
    doc.approvedBy = req.user._id
    await doc.save()
    res.json(doc)
  } catch (e) {
    console.error('Decline customer error:', e)
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/customers', protect, requireRole(...salesRoles), async (req, res) => {
  try {
    const q = { salesPerson: req.user._id }
    if (canManageAllSalesData(req.user)) {
      delete q.salesPerson
    }
    const list = await Customer.find(q).populate('salesPerson', 'name username').sort({ createdAt: -1 }).lean()
    res.json(list)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/customers/:id', protect, requireRole(...salesRoles), async (req, res) => {
  try {
    const q = { _id: req.params.id }
    if (!canManageAllSalesData(req.user)) q.salesPerson = req.user._id
    const doc = await Customer.findOne(q).populate('salesPerson', 'name username').lean()
    if (!doc) return res.status(404).json({ message: 'Customer not found' })
    res.json(doc)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/price-level/:customerId/prices', protect, requireRole(...salesRoles), async (req, res) => {
  try {
    const customerQuery = { _id: req.params.customerId }
    if (!canManageAllSalesData(req.user)) customerQuery.salesPerson = req.user._id
    const customer = await Customer.findOne(customerQuery).select('priceLevelCode').lean()
    if (!customer) return res.status(404).json({ message: 'Customer not found' })
    const priceLevelCode = String(customer.priceLevelCode || '').trim()
    if (!priceLevelCode) return res.json({ priceLevelCode: '', items: [] })
    const items = await PriceLevelProductPrice.find({ priceLevelCode })
      .select('productId unitType unitPrice')
      .lean()
    return res.json({ priceLevelCode, items })
  } catch (e) {
    return res.status(500).json({ message: 'Server error' })
  }
})

// ——— Orders ———
router.post('/orders', protect, requireRole(...salesRoles), async (req, res) => {
  try {
    const {
      customerId,
      lineItems,
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
      persistPriceLevelOnSubmit,
    } = req.body || {}
    if (!customerId) return res.status(400).json({ message: 'Customer is required.' })

    const customer = await Customer.findOne({
      _id: customerId,
      ...(!canManageAllSalesData(req.user) ? { salesPerson: req.user._id } : {}),
    })
    if (!customer) return res.status(404).json({ message: 'Customer not found' })
    if (customer.status === 'inactive') {
      return res.status(400).json({ message: 'Cannot create order for an inactive customer.' })
    }

    const orderNumber = await nextOrderNumber()
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
      status: 'new',
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
      logs: [
        {
          action: 'Order created',
          byUserId: req.user._id,
          byUserName: getActorName(req.user),
          at: new Date(),
        },
      ],
    })

    if (persistPriceLevelOnSubmit === true) {
      const priceLevelCode = String(customer.priceLevelCode || '').trim()
      if (priceLevelCode) {
        for (const item of normalized) {
          const productId = String(item.productId || '').trim()
          const unitType = String(item.unitType || '').trim() || 'Piece'
          const unitPrice = Math.max(0, Number(item.unitPrice) || 0)
          if (!productId) continue
          await PriceLevelProductPrice.updateOne(
            { priceLevelCode, productId, unitType },
            { $set: { unitPrice } },
            { upsert: true },
          )
        }
      }
    }
    res.status(201).json(doc)
  } catch (e) {
    console.error('Create sales order error:', e)
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/orders', protect, requireRole(...orderWorkflowRoles), async (req, res) => {
  try {
    const q = {}
    if (req.user.role === 'sales_person') q.salesPerson = req.user._id
    if (req.user.role === 'scanner_packer') q.assignedPacker = req.user._id
    if (req.user.role === 'picker') q.assignedPicker = req.user._id
    const { status } = req.query
    if (status) q.status = status
    const list = await SalesOrder.find(q)
      .populate('customer', 'businessName customerNumber customerName customerType billingAddress shippingAddress')
      .populate('salesPerson', 'name username')
      .populate('assignedPicker', 'name username')
      .populate('assignedPacker', 'name username')
      .populate('assignedDriver', 'name username')
      .sort({ createdAt: -1 })
      .lean()
    res.json(list)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/orders/:id', protect, requireRole(...orderWorkflowRoles), async (req, res) => {
  try {
    const q = { _id: req.params.id }
    if (req.user.role === 'sales_person') q.salesPerson = req.user._id
    if (req.user.role === 'scanner_packer') q.assignedPacker = req.user._id
    if (req.user.role === 'picker') q.assignedPicker = req.user._id
    const doc = await SalesOrder.findOne(q)
      .populate('customer')
      .populate('salesPerson', 'name username')
      .populate('assignedPicker', 'name username')
      .populate('assignedPacker', 'name username')
      .populate('assignedDriver', 'name username')
      .lean()
    if (!doc) return res.status(404).json({ message: 'Order not found' })
    res.json(doc)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

router.put('/orders/:id', protect, requireRole(...orderWorkflowRoles), async (req, res) => {
  try {
    const q = { _id: req.params.id }
    if (req.user.role === 'sales_person') q.salesPerson = req.user._id
    const doc = await SalesOrder.findOne(q)
    if (!doc) return res.status(404).json({ message: 'Order not found' })
    const isLineItemEdit = req.body && Object.prototype.hasOwnProperty.call(req.body, 'lineItems')
    const role = req.user.role
    const salesPersonEditableStatuses = ['new', 'processed', 'packed', 'add-on', 'add-on-packed']
    const canEditBySalesPerson =
      role === 'sales_person' && salesPersonEditableStatuses.includes(doc.status)
    const canEditWarehouseOrManagerOnNew =
      doc.status === 'new' && ['sales_manager', 'admin', 'order_manager'].includes(role)
    const canOrderManagerEditProcessed = role === 'order_manager' && doc.status === 'processed'
    const canEditPackedForManager =
      ['packed', 'add-on-packed'].includes(doc.status) &&
      ['sales_manager', 'admin'].includes(role)
    if (
      isLineItemEdit &&
      !canEditBySalesPerson &&
      !canEditWarehouseOrManagerOnNew &&
      !canOrderManagerEditProcessed &&
      !canEditPackedForManager
    ) {
      return res.status(400).json({ message: 'You cannot edit line items for this order status.' })
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
      persistPriceLevelOnSubmit,
    } = req.body || {}
    const previousLineItems = Array.isArray(doc.lineItems)
      ? doc.lineItems.map((x) => ({
          productId: String(x.productId || '').trim(),
          productName: String(x.productName || '').trim(),
          unitType: String(x.unitType || '').trim() || 'Piece',
          qty: Number(x.qty) || 0,
          unitPrice: Number(x.unitPrice) || 0,
          discountAmount: Number(x.discountAmount) || 0,
        }))
      : []

    const previousByKey = new Map(
      previousLineItems.map((x) => [`${x.productId}__${x.unitType}`, x]),
    )
    if (lineItems != null) {
      const items = Array.isArray(lineItems) ? lineItems : []
      const allowAddedLaterBubble = role === 'sales_person' && !['processed', 'packed'].includes(doc.status)
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
          packedQty: Math.max(0, Number(row.packedQty ?? row.qty) || 0),
          pieces,
          barcode: String(row.barcode || '').trim().slice(0, 100),
          itemScanTime: row.itemScanTime ? new Date(row.itemScanTime) : undefined,
          unitPrice,
          srp,
          lineTotal,
          discountPercent,
          discountAmount,
          netPrice,
          isExchange: !!row.isExchange,
          isTaxable: row.isTaxable !== false,
          isFreeItem: !!row.isFreeItem,
          isAddedLater: !!row.isAddedLater,
        }
      })
      doc.subtotal = Math.round(subtotal * 100) / 100

      const nextByKey = new Map(
        doc.lineItems.map((x) => [
          `${String(x.productId || '').trim()}__${String(x.unitType || '').trim() || 'Piece'}`,
          {
            productId: String(x.productId || '').trim(),
            productName: String(x.productName || '').trim(),
            unitType: String(x.unitType || '').trim() || 'Piece',
            qty: Number(x.qty) || 0,
            unitPrice: Number(x.unitPrice) || 0,
            discountAmount: Number(x.discountAmount) || 0,
          },
        ]),
      )

      if (canOrderManagerEditProcessed) {
        for (const key of previousByKey.keys()) {
          if (!nextByKey.has(key)) {
            return res.status(400).json({ message: 'For processed orders, warehouse manager can add items but cannot delete existing items.' })
          }
        }
      }

      for (const [key, nextItem] of nextByKey.entries()) {
        const prevItem = previousByKey.get(key)
        if (!prevItem) {
          if (allowAddedLaterBubble) {
            const targetLine = doc.lineItems.find(
              (li) => `${String(li.productId || '').trim()}__${String(li.unitType || '').trim() || 'Piece'}` === key,
            )
            if (targetLine) targetLine.isAddedLater = true
          }
          doc.logs.push({
            action: `Item added: ${nextItem.productId} (${nextItem.unitType})`,
            byUserId: req.user._id,
            byUserName: getActorName(req.user),
            at: new Date(),
          })
          continue
        }

        if (Math.abs(prevItem.unitPrice - nextItem.unitPrice) > 0.0001) {
          doc.logs.push({
            action: `Price updated: ${nextItem.productId} ${prevItem.unitPrice.toFixed(2)} -> ${nextItem.unitPrice.toFixed(2)}`,
            byUserId: req.user._id,
            byUserName: getActorName(req.user),
            at: new Date(),
          })
        }
        if (Math.abs(prevItem.qty - nextItem.qty) > 0.0001) {
          doc.logs.push({
            action: `Qty updated: ${nextItem.productId} ${prevItem.qty} -> ${nextItem.qty}`,
            byUserId: req.user._id,
            byUserName: getActorName(req.user),
            at: new Date(),
          })
        }
        if (Math.abs(prevItem.discountAmount - nextItem.discountAmount) > 0.0001) {
          doc.logs.push({
            action: `Discount updated: ${nextItem.productId} ${prevItem.discountAmount.toFixed(2)} -> ${nextItem.discountAmount.toFixed(2)}`,
            byUserId: req.user._id,
            byUserName: getActorName(req.user),
            at: new Date(),
          })
        }
      }

      for (const [key, prevItem] of previousByKey.entries()) {
        if (!nextByKey.has(key)) {
          doc.logs.push({
            action: `Item removed: ${prevItem.productId} (${prevItem.unitType})`,
            byUserId: req.user._id,
            byUserName: getActorName(req.user),
            at: new Date(),
          })
        }
      }
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

    if (isLineItemEdit && ['packed', 'add-on-packed'].includes(doc.status) && ['sales_manager', 'admin', 'sales_person'].includes(role)) {
      doc.status = 'add-on'
      doc.logs.push({
        action: 'Order updated (set to add-on)',
        byUserId: req.user._id,
        byUserName: getActorName(req.user),
        at: new Date(),
      })
    } else if (isLineItemEdit) {
      doc.logs.push({
        action: 'Order updated',
        byUserId: req.user._id,
        byUserName: getActorName(req.user),
        at: new Date(),
      })
    }
    if (status === 'cancelled' && doc.status === 'new' && ['sales_manager', 'admin'].includes(req.user.role)) {
      const cancelRemark = String(req.body?.cancelRemark || req.body?.cancellationRemark || '').trim()
      if (!cancelRemark) {
        return res.status(400).json({ message: 'Cancellation remark is required.' })
      }
      doc.status = 'cancelled'
      doc.cancelledAt = new Date()
      doc.cancelledRemark = cancelRemark.slice(0, 500)
      doc.logs.push({
        action: `Order cancelled: ${doc.cancelledRemark}`,
        byUserId: req.user._id,
        byUserName: getActorName(req.user),
        at: new Date(),
      })
    }
    await doc.save()

    if (persistPriceLevelOnSubmit === true && Array.isArray(doc.lineItems) && doc.lineItems.length > 0) {
      const customer = await Customer.findById(doc.customer).select('priceLevelCode').lean()
      const priceLevelCode = String(customer?.priceLevelCode || '').trim()
      if (priceLevelCode) {
        for (const item of doc.lineItems) {
          const productId = String(item.productId || '').trim()
          const unitType = String(item.unitType || '').trim() || 'Piece'
          const unitPrice = Math.max(0, Number(item.unitPrice) || 0)
          if (!productId) continue
          await PriceLevelProductPrice.updateOne(
            { priceLevelCode, productId, unitType },
            { $set: { unitPrice } },
            { upsert: true },
          )
        }
      }
    }
    const updated = await SalesOrder.findById(doc._id).populate('customer').lean()
    res.json(updated)
  } catch (e) {
    console.error('Update sales order error:', e)
    res.status(500).json({ message: 'Server error' })
  }
})

router.patch('/orders/:id/packing', protect, requireRole('scanner_packer', 'admin'), async (req, res) => {
  try {
    const q = { _id: req.params.id }
    if (req.user.role === 'scanner_packer') q.assignedPacker = req.user._id
    const doc = await SalesOrder.findOne(q)
    if (!doc) return res.status(404).json({ message: 'Order not found' })
    if (!['new', 'processed', 'add-on', 'packed', 'add-on-packed'].includes(doc.status)) {
      return res.status(400).json({ message: 'Packing update is not allowed for this order status.' })
    }
    const packedItems = Array.isArray(req.body?.packedItems) ? req.body.packedItems : []
    const packedMap = new Map(
      packedItems.map((x) => [
        `${String(x.productId || '').trim()}__${String(x.unitType || '').trim() || 'Piece'}`,
        Math.max(0, Number(x.packedQty) || 0),
      ]),
    )
    doc.lineItems = (doc.lineItems || []).map((li) => {
      const key = `${String(li.productId || '').trim()}__${String(li.unitType || '').trim() || 'Piece'}`
      if (!packedMap.has(key)) return li
      const nextPacked = Math.max(0, packedMap.get(key))
      const changed = Math.abs((Number(li.packedQty) || 0) - nextPacked) > 0.0001
      li.packedQty = nextPacked
      if (changed) li.itemScanTime = new Date()
      return li
    })
    doc.logs.push({
      action: 'Packing quantities updated',
      byUserId: req.user._id,
      byUserName: getActorName(req.user),
      at: new Date(),
    })
    await doc.save()
    const updated = await SalesOrder.findById(doc._id)
      .populate('customer')
      .populate('salesPerson', 'name username')
      .populate('assignedPicker', 'name username')
      .populate('assignedPacker', 'name username')
      .lean()
    res.json(updated)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

router.patch('/orders/:id/workflow', protect, requireRole(...orderWorkflowRoles), async (req, res) => {
  try {
    const q = { _id: req.params.id }
    if (req.user.role === 'sales_person') q.salesPerson = req.user._id
    const doc = await SalesOrder.findOne(q)
    if (!doc) return res.status(404).json({ message: 'Order not found' })

    const action = String(req.body?.action || '').trim()
    const role = req.user.role

    if (action === 'cancel_new') {
      if (!['sales_manager', 'admin'].includes(role)) {
        return res.status(403).json({ message: 'Only sales manager can cancel new orders.' })
      }
      if (doc.status !== 'new') return res.status(400).json({ message: 'Only new orders can be cancelled.' })
      const cancelRemark = String(req.body?.remark || req.body?.cancelRemark || '').trim()
      if (!cancelRemark) return res.status(400).json({ message: 'Cancellation remark is required.' })
      doc.status = 'cancelled'
      doc.cancelledAt = new Date()
      doc.cancelledRemark = cancelRemark.slice(0, 500)
      doc.logs.push({
        action: `Order cancelled: ${doc.cancelledRemark}`,
        byUserId: req.user._id,
        byUserName: getActorName(req.user),
        at: new Date(),
      })
    } else if (action === 'assign_packer') {
      if (!['order_manager', 'admin'].includes(role)) {
        return res.status(403).json({ message: 'Only warehouse manager can assign packer.' })
      }
      if (!['new', 'processed', 'add-on'].includes(doc.status)) {
        return res.status(400).json({ message: 'Packer can only be assigned on new/processed/add-on orders.' })
      }
      const packerId = req.body?.packerId
      if (!packerId) return res.status(400).json({ message: 'packerId is required.' })
      const packer = await User.findOne({ _id: packerId, role: 'scanner_packer', isActive: { $ne: false } }).lean()
      if (!packer) return res.status(400).json({ message: 'Invalid packer selected.' })
      const minutesRaw = Number(req.body?.assignMinutes)
      const assignMinutes = Number.isFinite(minutesRaw)
        ? Math.min(1440, Math.max(1, Math.round(minutesRaw)))
        : 30
      const wasAssigned = !!doc.assignedPacker
      doc.assignedPacker = packer._id
      doc.packerAssignMinutes = assignMinutes
      if (doc.status === 'new') doc.status = 'processed'
      doc.logs.push({
        action: `${wasAssigned ? 'Packer reassigned' : 'Packer assigned'} (${packer.name || packer.username || 'Packer'}) - ${assignMinutes} min`,
        byUserId: req.user._id,
        byUserName: getActorName(req.user),
        at: new Date(),
      })
    } else if (action === 'assign_picker') {
      if (!['order_manager', 'admin'].includes(role)) {
        return res.status(403).json({ message: 'Only warehouse manager can assign picker.' })
      }
      if (!['new', 'processed', 'add-on'].includes(doc.status)) {
        return res.status(400).json({ message: 'Picker can only be assigned on new/processed/add-on orders.' })
      }
      const pickerId = req.body?.pickerId
      if (!pickerId) return res.status(400).json({ message: 'pickerId is required.' })
      const picker = await User.findOne({ _id: pickerId, role: 'picker', isActive: { $ne: false } }).lean()
      if (!picker) return res.status(400).json({ message: 'Invalid picker selected.' })
      doc.assignedPicker = picker._id
      doc.logs.push({
        action: `Picker assigned (${picker.name || picker.username || 'Picker'})`,
        byUserId: req.user._id,
        byUserName: getActorName(req.user),
        at: new Date(),
      })
    } else if (action === 'set_warehouse_todo') {
      if (!['order_manager', 'admin'].includes(role)) {
        return res.status(403).json({ message: 'Only warehouse manager can update todo.' })
      }
      const todo = String(req.body?.todo || '').trim()
      doc.warehouseTodo = todo.slice(0, 2000)
      doc.logs.push({
        action: `Warehouse todo updated${doc.warehouseTodo ? '' : ' (cleared)'}`,
        byUserId: req.user._id,
        byUserName: getActorName(req.user),
        at: new Date(),
      })
    } else if (action === 'mark_packed') {
      if (!['scanner_packer', 'admin'].includes(role)) {
        return res.status(403).json({ message: 'Only packer can mark order packed.' })
      }
      if (doc.status === 'new' || doc.status === 'processed') doc.status = 'packed'
      else if (doc.status === 'add-on') doc.status = 'add-on-packed'
      else return res.status(400).json({ message: 'Only new/add-on orders can be packed.' })
      doc.packedAt = new Date()
      doc.logs.push({
        action: `Order packed (${doc.status})`,
        byUserId: req.user._id,
        byUserName: getActorName(req.user),
        at: new Date(),
      })
    } else if (action === 'assign_driver') {
      if (!['sales_manager', 'admin'].includes(role)) {
        return res.status(403).json({ message: 'Only sales manager can assign driver.' })
      }
      if (!['packed', 'add-on-packed'].includes(doc.status)) {
        return res.status(400).json({ message: 'Only packed/add-on-packed orders can be assigned to a driver.' })
      }
      const driverId = req.body?.driverId
      if (!driverId) return res.status(400).json({ message: 'driverId is required.' })
      const driver = await User.findOne({ _id: driverId, role: 'driver', isActive: { $ne: false } }).lean()
      if (!driver) return res.status(400).json({ message: 'Invalid driver selected.' })
      doc.assignedDriver = driver._id
      doc.status = 'ready-to-ship'
      doc.logs.push({
        action: `Driver assigned (${driver.name || driver.username || 'Driver'})`,
        byUserId: req.user._id,
        byUserName: getActorName(req.user),
        at: new Date(),
      })
    } else if (action === 'mark_shipped') {
      if (!['driver', 'admin'].includes(role)) {
        return res.status(403).json({ message: 'Only driver can mark order shipped.' })
      }
      if (doc.status !== 'ready-to-ship') {
        return res.status(400).json({ message: 'Only ready-to-ship orders can be marked shipped.' })
      }
      doc.status = 'shipped'
      doc.shippedAt = new Date()
      doc.logs.push({
        action: 'Order shipped',
        byUserId: req.user._id,
        byUserName: getActorName(req.user),
        at: new Date(),
      })
    } else if (action === 'mark_delivered' || action === 'mark_undelivered') {
      if (!['driver', 'admin'].includes(role)) {
        return res.status(403).json({ message: 'Only driver can complete delivery.' })
      }
      if (doc.status !== 'shipped') {
        return res.status(400).json({ message: 'Only shipped orders can be marked delivered/undelivered.' })
      }
      doc.status = action === 'mark_delivered' ? 'delivered' : 'undelivered'
      doc.deliveredAt = new Date()
      doc.logs.push({
        action: action === 'mark_delivered' ? 'Order delivered' : 'Order undelivered',
        byUserId: req.user._id,
        byUserName: getActorName(req.user),
        at: new Date(),
      })
    } else if (action === 'close_order') {
      if (!['accounts', 'admin'].includes(role)) {
        return res.status(403).json({ message: 'Only accounts can close orders.' })
      }
      if (!['delivered', 'undelivered'].includes(doc.status)) {
        return res.status(400).json({ message: 'Only delivered/undelivered orders can be closed.' })
      }
      doc.status = 'close'
      doc.closedAt = new Date()
      doc.logs.push({
        action: 'Order closed',
        byUserId: req.user._id,
        byUserName: getActorName(req.user),
        at: new Date(),
      })
    } else {
      return res.status(400).json({ message: 'Invalid workflow action.' })
    }

    await doc.save()
    const updated = await SalesOrder.findById(doc._id)
      .populate('customer')
      .populate('salesPerson', 'name username')
      .populate('assignedPicker', 'name username')
      .populate('assignedPacker', 'name username')
      .populate('assignedDriver', 'name username')
      .lean()
    return res.json(updated)
  } catch (e) {
    console.error('Update sales workflow error:', e)
    return res.status(500).json({ message: 'Server error' })
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
      ...(!canManageAllSalesData(req.user) ? { salesPerson: req.user._id } : {}),
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
    if (canManageAllSalesData(req.user)) delete q.salesPerson
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
      ...(!canManageAllSalesData(req.user) ? { salesPerson: req.user._id } : {}),
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
    if (canManageAllSalesData(req.user)) delete q.salesPerson
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
      SalesOrder.countDocuments({ ...sp, status: { $in: ['new', 'add-on'] } }),
      SalesOrder.countDocuments({ ...sp, status: { $in: ['packed', 'add-on-packed', 'ready-to-ship', 'shipped'] } }),
    ])
    res.json({ customers, draftOrders, openOrders })
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Sales manager dashboard data (grouped by sales person)
router.get('/manager/dashboard', protect, requireRole('sales_manager', 'admin'), async (req, res) => {
  try {
    const period = String(req.query.period || 'today').trim()
    const now = new Date()

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfYesterday = new Date(startOfToday)
    startOfYesterday.setDate(startOfYesterday.getDate() - 1)
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    let dateFilter = {}
    if (period === 'today') dateFilter = { $gte: startOfToday, $lte: now }
    else if (period === 'yesterday') dateFilter = { $gte: startOfYesterday, $lt: startOfToday }
    else if (period === 'this_month') dateFilter = { $gte: startOfThisMonth, $lte: now }
    else if (period === 'last_month') dateFilter = { $gte: startOfLastMonth, $lt: startOfThisMonth }

    const match = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}

    const [summary, bySalesPersonRaw] = await Promise.all([
      SalesOrder.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalSales: { $sum: { $ifNull: ['$orderTotal', 0] } },
          },
        },
      ]),
      SalesOrder.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$salesPerson',
            totalOrders: { $sum: 1 },
            totalSales: { $sum: { $ifNull: ['$orderTotal', 0] } },
          },
        },
      ]),
    ])

    const salesPeople = await User.find({ role: 'sales_person' }).select('_id name username').lean()
    const personMap = new Map(salesPeople.map((u) => [String(u._id), u]))

    const bySalesPerson = bySalesPersonRaw.map((row) => {
      const u = personMap.get(String(row._id))
      const totalOrders = Number(row.totalOrders) || 0
      const totalSales = Number(row.totalSales) || 0
      return {
        salesPersonId: row._id,
        salesPersonName: u?.name || u?.username || 'Unknown',
        totalOrders,
        totalSales,
        aov: totalOrders > 0 ? totalSales / totalOrders : 0,
      }
    })

    bySalesPerson.sort((a, b) => b.totalSales - a.totalSales)

    const totals = summary[0] || { totalOrders: 0, totalSales: 0 }
    const totalOrders = Number(totals.totalOrders) || 0
    const totalSales = Number(totals.totalSales) || 0

    res.json({
      period,
      totalOrders,
      totalSales,
      aov: totalOrders > 0 ? totalSales / totalOrders : 0,
      bySalesPerson,
    })
  } catch (e) {
    console.error('Sales manager dashboard error:', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Active sales people list for manager filters
router.get('/salespeople', protect, requireRole('sales_manager', 'admin'), async (req, res) => {
  try {
    const list = await User.find({ role: 'sales_person', isActive: { $ne: false } })
      .select('_id name username')
      .sort({ name: 1, username: 1 })
      .lean()
    res.json(list)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Active drivers list for assign-driver popup
router.get('/drivers', protect, requireRole('sales_manager', 'admin'), async (req, res) => {
  try {
    const list = await User.find({ role: 'driver', isActive: { $ne: false } })
      .select('_id name username')
      .sort({ name: 1, username: 1 })
      .lean()
    res.json(list)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/packers', protect, requireRole('order_manager', 'admin', 'sales_manager'), async (req, res) => {
  try {
    const list = await User.find({ role: 'scanner_packer', isActive: { $ne: false } })
      .select('_id name username')
      .sort({ name: 1, username: 1 })
      .lean()
    res.json(list)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/pickers', protect, requireRole('order_manager', 'admin', 'sales_manager'), async (req, res) => {
  try {
    const list = await User.find({ role: 'picker', isActive: { $ne: false } })
      .select('_id name username')
      .sort({ name: 1, username: 1 })
      .lean()
    res.json(list)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/warehouse/tasks', protect, requireRole('order_manager', 'admin', 'picker', 'scanner_packer'), async (req, res) => {
  try {
    const query = {}
    if (req.user.role === 'picker' || req.user.role === 'scanner_packer') {
      query.assignee = req.user._id
    }
    const list = await WarehouseTask.find(query)
      .populate('assignee', 'name username role')
      .populate('createdBy', 'name username')
      .sort({ createdAt: -1 })
      .lean()
    res.json(list)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

router.post('/warehouse/tasks', protect, requireRole('order_manager', 'admin'), async (req, res) => {
  try {
    const { title, description, assigneeId, assigneeRole, priority, dueDate } = req.body || {}
    if (!title || !assigneeId || !assigneeRole) {
      return res.status(400).json({ message: 'Title, assignee and role are required.' })
    }
    if (!['picker', 'scanner_packer'].includes(String(assigneeRole))) {
      return res.status(400).json({ message: 'Assignee role must be picker or packer.' })
    }
    const assignee = await User.findOne({
      _id: assigneeId,
      role: assigneeRole,
      isActive: { $ne: false },
    }).lean()
    if (!assignee) {
      return res.status(400).json({ message: 'Selected assignee is invalid or inactive.' })
    }

    const doc = await WarehouseTask.create({
      title: String(title).trim().slice(0, 200),
      description: String(description || '').trim().slice(0, 2000),
      assignee: assignee._id,
      assigneeRole,
      priority: ['low', 'medium', 'high'].includes(String(priority)) ? priority : 'medium',
      createdBy: req.user._id,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      logs: [
        {
          action: 'Task created',
          byUserId: req.user._id,
          byUserName: getActorName(req.user),
          at: new Date(),
        },
      ],
    })

    const populated = await WarehouseTask.findById(doc._id)
      .populate('assignee', 'name username role')
      .populate('createdBy', 'name username')
      .lean()

    res.status(201).json(populated)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

router.patch('/warehouse/tasks/:id', protect, requireRole('order_manager', 'admin', 'picker', 'scanner_packer'), async (req, res) => {
  try {
    const task = await WarehouseTask.findById(req.params.id)
    if (!task) return res.status(404).json({ message: 'Task not found' })

    const isManager = ['order_manager', 'admin'].includes(req.user.role)
    const isAssignee = String(task.assignee) === String(req.user._id)
    if (!isManager && !isAssignee) {
      return res.status(403).json({ message: 'Not allowed to update this task.' })
    }

    const updates = req.body || {}
    if (updates.status && ['todo', 'in_progress', 'done', 'blocked'].includes(String(updates.status))) {
      const next = String(updates.status)
      if (task.status !== next) {
        task.status = next
        task.logs.push({
          action: `Status changed to ${next}`,
          byUserId: req.user._id,
          byUserName: getActorName(req.user),
          at: new Date(),
        })
      }
    }

    if (isManager) {
      if (typeof updates.title === 'string') task.title = updates.title.trim().slice(0, 200)
      if (typeof updates.description === 'string') task.description = updates.description.trim().slice(0, 2000)
      if (updates.priority && ['low', 'medium', 'high'].includes(String(updates.priority))) task.priority = String(updates.priority)
      if (typeof updates.dueDate !== 'undefined') {
        task.dueDate = updates.dueDate ? new Date(updates.dueDate) : null
      }
      if (updates.assigneeId || updates.assigneeRole) {
        const role = String(updates.assigneeRole || task.assigneeRole)
        const id = String(updates.assigneeId || task.assignee)
        if (!['picker', 'scanner_packer'].includes(role)) {
          return res.status(400).json({ message: 'Assignee role must be picker or packer.' })
        }
        const assignee = await User.findOne({ _id: id, role, isActive: { $ne: false } }).lean()
        if (!assignee) return res.status(400).json({ message: 'Selected assignee is invalid or inactive.' })
        task.assignee = assignee._id
        task.assigneeRole = role
        task.logs.push({
          action: 'Task reassigned',
          detail: `${assignee.name || assignee.username} (${role})`,
          byUserId: req.user._id,
          byUserName: getActorName(req.user),
          at: new Date(),
        })
      }
    }

    if (typeof updates.comment === 'string' && updates.comment.trim()) {
      task.logs.push({
        action: 'Comment added',
        detail: updates.comment.trim().slice(0, 500),
        byUserId: req.user._id,
        byUserName: getActorName(req.user),
        at: new Date(),
      })
    }

    await task.save()
    const populated = await WarehouseTask.findById(task._id)
      .populate('assignee', 'name username role')
      .populate('createdBy', 'name username')
      .lean()
    res.json(populated)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
