import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, Col, Form, Modal, OverlayTrigger, Row, Table, Tooltip } from 'react-bootstrap'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/api'
import { useAuth } from '../../context/AuthContext'

const SHIPPING_TYPES = [
  'Customer Pickup',
  'Ground Shipping',
  'Sales Pickup',
  'Sales Quote - Customer Pickup',
  'Sales Quote - Ground Shipping',
  'Sales Quote - Sales Pickup',
  'Sales Quote - UPS Regular',
  'UPS Regular',
]
const TAX_TYPES = ['No Tax', 'Sales Tax']
const TERMS_OPTIONS = ['30 days', 'COD', 'ACH']

function toInputDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toISOString().slice(0, 10)
}

function money(n) {
  const v = Number(n) || 0
  return v.toFixed(2)
}

function formatCustomerAddress(addr) {
  if (!addr || typeof addr !== 'object') return ''
  const line1 = String(addr.address1 || '').trim()
  const line2 = String(addr.address2 || '').trim()
  const line3 = [addr.city, addr.state, addr.zipCode].filter(Boolean).join(', ')
  return [line1, line2, line3].filter(Boolean).join('\n')
}

function getSelectablePackings(product) {
  const allPackings = Array.isArray(product?.packings) ? product.packings : []
  const enabledPackings = allPackings.filter((pk) => pk?.enabled !== false)
  return enabledPackings.length > 0 ? enabledPackings : allPackings
}

function getDefaultPacking(product) {
  const options = getSelectablePackings(product)
  return (
    options.find((u) => u?.isDefault === true) ||
    options.find((u) => u?.unitType === 'Piece') ||
    options[0] ||
    null
  )
}

function NewOrderPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const isSalesPerson = user?.role === 'sales_person'
  const canRemoveLine = !(isSalesPerson && !!editId)

  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const [orderDate, setOrderDate] = useState(toInputDate(new Date()))
  const [deliveryDate, setDeliveryDate] = useState('')
  const [terms, setTerms] = useState('')
  const [shippingType, setShippingType] = useState('Ground Shipping')

  const [billingAddress, setBillingAddress] = useState('')
  const [shippingAddress, setShippingAddress] = useState('')

  const [barcodeInput, setBarcodeInput] = useState('')
  const [pickProductSearch, setPickProductSearch] = useState('')
  const [pickProductId, setPickProductId] = useState('')
  const [pickUnitType, setPickUnitType] = useState('')
  const [pickQty, setPickQty] = useState(1)
  const [pickIsExchange, setPickIsExchange] = useState(false)
  const [pickIsTaxable, setPickIsTaxable] = useState(true)
  const [pickIsFreeItem, setPickIsFreeItem] = useState(false)

  const [lines, setLines] = useState([])

  const [salesPersonRemark, setSalesPersonRemark] = useState('')
  const [driverRemark, setDriverRemark] = useState('')

  const [overallDiscountPercent, setOverallDiscountPercent] = useState(0)
  const [overallDiscountAmount, setOverallDiscountAmount] = useState(0)
  const [shippingCharges, setShippingCharges] = useState(0)
  const [taxType, setTaxType] = useState('')
  const [taxPercent, setTaxPercent] = useState(0)
  const [adjustment, setAdjustment] = useState(0)

  const [mlQuantity, setMlQuantity] = useState(0)
  const [mlTax, setMlTax] = useState(0)
  const [weightQuantity, setWeightQuantity] = useState(0)
  const [weightTax, setWeightTax] = useState(0)
  const [vapeTax, setVapeTax] = useState(0)

  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [minPriceViolations, setMinPriceViolations] = useState([])
  const [showMinPriceModal, setShowMinPriceModal] = useState(false)
  const [priceLevelPrices, setPriceLevelPrices] = useState({})
  const [companySettings, setCompanySettings] = useState(null)

  useEffect(() => {
    api.get('/api/sales/customers').then(async (res) => {
      const data = await res.json().catch(() => [])
      if (res.ok && Array.isArray(data)) setCustomers(data)
    })
    api.get('/api/products?limit=all&status=Active').then(async (res) => {
      const data = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(data.items)) setProducts(data.items)
    })
  }, [])

  useEffect(() => {
    api
      .get('/api/company-settings')
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (res.ok && data) setCompanySettings(data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!editId) return
    api.get(`/api/sales/orders/${editId}`).then(async (res) => {
      const o = await res.json().catch(() => null)
      if (!res.ok || !o) return
      const custId = o.customer?._id || o.customer || ''
      const cust = customers.find((c) => c._id === custId) || null
      setSelectedCustomer(cust)
      setOrderDate(toInputDate(o.orderDate || o.createdAt || new Date()))
      setDeliveryDate(toInputDate(o.deliveryDate))
      setTerms(o.terms || '')
      setShippingType(o.shippingType || 'Ground Shipping')
      setBillingAddress(o.billingAddress || '')
      setShippingAddress(o.shippingAddress || '')
      setSalesPersonRemark(o.salesPersonRemark || '')
      setDriverRemark(o.driverRemark || '')
      setOverallDiscountPercent(Number(o.overallDiscountPercent) || 0)
      setOverallDiscountAmount(Number(o.overallDiscountAmount) || 0)
      setShippingCharges(Number(o.shippingCharges) || 0)
      setTaxType(o.taxType || '')
      setTaxPercent(Number(o.taxPercent) || 0)
      setAdjustment(Number(o.adjustment) || 0)
      setMlQuantity(Number(o.mlQuantity) || 0)
      setMlTax(Number(o.mlTax) || 0)
      setWeightQuantity(Number(o.weightQuantity) || 0)
      setWeightTax(Number(o.weightTax) || 0)
      setVapeTax(Number(o.vapeTax) || 0)
      setLines(Array.isArray(o.lineItems) ? o.lineItems : [])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, customers.length])

  useEffect(() => {
    if (!selectedCustomer) return
    if (editId) return
    setBillingAddress(formatCustomerAddress(selectedCustomer.billingAddress))
    setShippingAddress(formatCustomerAddress(selectedCustomer.shippingAddress))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer?._id])

  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.netPrice) || 0), 0), [lines])

  const taxableBase = useMemo(() => {
    return Math.max(0, Number(subtotal) - Number(overallDiscountAmount || 0) + Number(shippingCharges || 0))
  }, [subtotal, overallDiscountAmount, shippingCharges])

  const inferredShippingState = useMemo(() => {
    const explicit = String(selectedCustomer?.shippingAddress?.state || '').trim().toUpperCase()
    if (explicit) return explicit
    const text = String(shippingAddress || '').toUpperCase()
    const match = text.match(/\b([A-Z]{2})\b(?:\s+\d{5}(?:-\d{4})?)?$/m)
    return match?.[1] || ''
  }, [selectedCustomer?.shippingAddress?.state, shippingAddress])

  useEffect(() => {
    const cfg = companySettings
    if (!cfg) return
    if (cfg.enableSalesTax === false) {
      setTaxType('No Tax')
      setTaxPercent(0)
      return
    }
    const rules = Array.isArray(cfg.stateTaxRules) ? cfg.stateTaxRules : []
    const st = inferredShippingState
    const matched = rules.find((r) => {
      if (r?.isActive === false) return false
      if (String(r?.stateCode || '').trim().toUpperCase() !== st) return false
      const minAmt = Math.max(0, Number(r?.minAmount) || 0)
      const maxRaw = r?.maxAmount
      const maxAmt = maxRaw == null || maxRaw === '' ? null : Math.max(0, Number(maxRaw) || 0)
      if (taxableBase < minAmt) return false
      if (maxAmt != null && taxableBase > maxAmt) return false
      return true
    })
    if (matched) {
      setTaxType('Sales Tax')
      setTaxPercent(Math.max(0, Number(matched.taxPercent) || 0))
      return
    }
    setTaxType('Sales Tax')
    setTaxPercent(Math.max(0, Number(cfg.salesTaxPercent) || 0))
  }, [companySettings, inferredShippingState, taxableBase])

  useEffect(() => {
    const customerId = selectedCustomer?._id
    if (!customerId) {
      setPriceLevelPrices({})
      return
    }
    api
      .get(`/api/sales/price-level/${customerId}/prices`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({ items: [] }))
        if (!res.ok) return
        const map = {}
        const items = Array.isArray(data.items) ? data.items : []
        items.forEach((it) => {
          const key = `${String(it.productId || '').trim()}__${String(it.unitType || '').trim()}`
          map[key] = Math.max(0, Number(it.unitPrice) || 0)
        })
        setPriceLevelPrices(map)
      })
      .catch(() => setPriceLevelPrices({}))
  }, [selectedCustomer?._id])

  const productByMongoId = useMemo(() => {
    const map = new Map()
    products.forEach((p) => map.set(p._id, p))
    return map
  }, [products])

  const productByBusinessId = useMemo(() => {
    const map = new Map()
    products.forEach((p) => map.set(p.productId, p))
    return map
  }, [products])

  const filteredProducts = useMemo(() => {
    const query = String(pickProductSearch || '').trim().toLowerCase()
    if (!query) return products
    return products.filter((p) => {
      const idMatch = String(p?.productId || '').toLowerCase().includes(query)
      const nameMatch = String(p?.productName || '').toLowerCase().includes(query)
      return idMatch || nameMatch
    })
  }, [products, pickProductSearch])
  const orderedFilteredProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      const aId = String(a?.productId || '')
      const bId = String(b?.productId || '')
      return aId.localeCompare(bId, undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [filteredProducts])

  const handleProductSearchKeyDown = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const first = filteredProducts[0]
    if (!first) {
      setError('No product found for that search.')
      return
    }
    setError('')
    setPickProductId(first._id)
    const defaultUnit = getDefaultPacking(first)
    setPickUnitType(defaultUnit?.unitType || '')
  }

  const findByBarcode = (barcode) => {
    const q = String(barcode || '').trim().toLowerCase()
    if (!q) return null
    for (const p of products) {
      const packing = (p.packings || []).find((pk) => pk.barcode && String(pk.barcode).toLowerCase() === q)
      if (packing) return { product: p, packing }
    }
    return null
  }

  const selectedProduct = pickProductId ? productByMongoId.get(pickProductId) : null
  const unitOptions = selectedProduct ? getSelectablePackings(selectedProduct) : []
  const currentPacking = selectedProduct && pickUnitType
    ? (selectedProduct.packings || []).find((p) => p.unitType === pickUnitType)
    : null
  const canBeFree = !!currentPacking?.isFree

  useEffect(() => {
    if (!selectedProduct) return
    const hasCurrentInOptions = unitOptions.some((u) => u?.unitType === pickUnitType)
    if (hasCurrentInOptions) return
    const first = getDefaultPacking(selectedProduct)
    setPickUnitType(first?.unitType || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickProductId, selectedProduct, unitOptions, pickUnitType])

  const addLine = (product, packing, qtyOverride) => {
    if (!product) return
    const pack = packing || (product.packings || []).find((p) => p.unitType === pickUnitType) || (product.packings || [])[0]
    const unitType = pack?.unitType || 'Piece'
    const qtyPerUnit = Math.max(1, Number(pack?.qty) || 1)
    const qty = Math.max(1, Number(qtyOverride ?? pickQty) || 1)
    const pieces = qty * qtyPerUnit
    const rememberedPrice = priceLevelPrices[`${product.productId}__${unitType}`]
    const basePrice = Math.max(0, Number(pack?.base ?? pack?.cost ?? pack?.price ?? 0) || 0)
    const unitPrice = pickIsFreeItem
      ? 0
      : (rememberedPrice != null ? Math.max(0, Number(rememberedPrice) || 0) : basePrice)
    const srp = Math.max(0, Number(product.srp) || 0)
    const sameUnitIndex = lines.findIndex((l) => l.productId === product.productId && l.unitType === unitType)
    const differentUnitExists = lines.some((l) => l.productId === product.productId && l.unitType !== unitType)

    if (differentUnitExists && sameUnitIndex === -1) {
      setError('This product is already in the order with a different unit. Only one unit per product is allowed.')
      return
    }

    if (sameUnitIndex >= 0) {
      setError('')
      setLines((prev) => {
        const current = prev[sameUnitIndex]
        if (!current) return prev
        const nextQty = Math.max(0, Number(current.qty || 0)) + qty
        const nextPieces = nextQty * Math.max(1, Number(current.qtyPerUnit || qtyPerUnit))
        const nextLineTotal = Math.round(nextQty * Math.max(0, Number(current.unitPrice || unitPrice)) * 100) / 100
        const discountAmount = Math.max(0, Number(current.discountAmount || 0))
        const updated = {
          ...current,
          qty: nextQty,
          pieces: nextPieces,
          lineTotal: nextLineTotal,
          netPrice: Math.max(0, nextLineTotal - discountAmount),
        }
        const rest = prev.filter((_, idx) => idx !== sameUnitIndex)
        return [updated, ...rest]
      })
      setPickProductSearch('')
      setPickProductId('')
      setPickUnitType('')
      return
    }

    const lineTotal = Math.round(qty * unitPrice * 100) / 100
    const discountPercent = 0
    const discountAmount = 0
    const netPrice = lineTotal
    setError('')
    setLines((prev) => [
      {
        productId: product.productId,
        productName: product.productName,
        unitType,
        qtyPerUnit,
        qty,
        pieces,
        unitPrice,
        srp,
        lineTotal,
        discountPercent,
        discountAmount,
        netPrice,
        isExchange: !!pickIsExchange,
        isTaxable: pickIsTaxable !== false,
        isFreeItem: !!pickIsFreeItem,
        isAddedLater: false,
      },
      ...prev,
    ])
    setPickProductSearch('')
    setPickProductId('')
    setPickUnitType('')
  }

  const handleBarcodeKeyDown = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const match = findByBarcode(barcodeInput)
    if (!match) {
      setError('No product found for that barcode.')
      return
    }
    setError('')
    addLine(match.product, match.packing, 1)
    setBarcodeInput('')
  }

  const updateLine = (idx, patch) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l
        const next = { ...l, ...patch }
        const qty = Math.max(0, Number(next.qty) || 0)
        const unitPrice = Math.max(0, Number(next.unitPrice) || 0)
        const qtyPerUnit = Math.max(1, Number(next.qtyPerUnit) || 1)
        next.pieces = qty * qtyPerUnit
        next.lineTotal = Math.round(qty * unitPrice * 100) / 100
        const hasPct = Object.prototype.hasOwnProperty.call(patch, 'discountPercent')
        const hasAmt = Object.prototype.hasOwnProperty.call(patch, 'discountAmount')
        let pct = Math.max(0, Number(next.discountPercent) || 0)
        let amt = Math.max(0, Number(next.discountAmount) || 0)

        if (hasPct && !hasAmt) {
          if (pct > 100) pct = 100
          amt = Math.round((next.lineTotal * pct / 100) * 100) / 100
        } else if (hasAmt && !hasPct) {
          if (amt > next.lineTotal) amt = next.lineTotal
          pct = next.lineTotal > 0 ? Math.round((amt / next.lineTotal) * 10000) / 100 : 0
        } else {
          // if both changed (or neither), just clamp
          if (pct > 100) pct = 100
          if (amt > next.lineTotal) amt = next.lineTotal
        }

        next.discountPercent = pct
        next.discountAmount = amt
        next.netPrice = Math.max(0, next.lineTotal - next.discountAmount)
        return next
      }),
    )
  }

  const removeLine = (idx) => () => setLines((prev) => prev.filter((_, i) => i !== idx))

  const handleOverallPercentChange = (value) => {
    const pct = Math.max(0, Number(value) || 0)
    setOverallDiscountPercent(pct)
    const amt = Math.round((subtotal * pct / 100) * 100) / 100
    setOverallDiscountAmount(amt)
  }

  const handleOverallAmountChange = (value) => {
    const amt = Math.max(0, Number(value) || 0)
    setOverallDiscountAmount(amt)
    const pct = subtotal > 0 ? Math.round((amt / subtotal) * 10000) / 100 : 0
    setOverallDiscountPercent(pct)
  }

  const totalTax = useMemo(() => {
    if (!taxType || taxType === 'No Tax') return 0
    const pct = Math.max(0, Number(taxPercent) || 0)
    return Math.round(((subtotal - overallDiscountAmount + shippingCharges) * pct / 100) * 100) / 100
  }, [taxType, taxPercent, subtotal, overallDiscountAmount, shippingCharges])

  // Auto compute ML/Weight quantities from selected products (per piece)
  const autoMlQuantity = useMemo(() => {
    let sum = 0
    for (const l of lines) {
      const p = products.find((x) => x.productId === l.productId)
      if (!p || p.applyMlQuantity !== true) continue
      const mlPerPiece = Number(p.mlQuantity) || 0
      const pieces = Number(l.pieces) || 0
      sum += mlPerPiece * pieces
    }
    return Math.round(sum * 100) / 100
  }, [lines, products])

  const autoWeightQuantity = useMemo(() => {
    let sum = 0
    for (const l of lines) {
      const p = products.find((x) => x.productId === l.productId)
      if (!p || p.applyWeightOz !== true) continue
      const ozPerPiece = Number(p.weightOz) || 0
      const pieces = Number(l.pieces) || 0
      sum += ozPerPiece * pieces
    }
    return Math.round(sum * 100) / 100
  }, [lines, products])

  // Taxes from products: current system has no per-ml / per-weight / vape tax rate fields, so default to 0 but keep auto.
  const autoMlTax = 0
  const autoWeightTax = 0
  const autoVapeTax = 0

  const preAdjustmentTotal = useMemo(() => {
    const total =
      subtotal -
      (Number(overallDiscountAmount) || 0) +
      (Number(shippingCharges) || 0) +
      totalTax +
      autoMlTax +
      autoWeightTax +
      autoVapeTax
    return Math.max(0, Math.round(total * 100) / 100)
  }, [subtotal, overallDiscountAmount, shippingCharges, totalTax, autoMlTax, autoWeightTax, autoVapeTax])

  // Adjustment always rounds to nearest whole dollar automatically
  const autoAdjustment = useMemo(() => {
    const rounded = Math.round(preAdjustmentTotal)
    const delta = rounded - preAdjustmentTotal
    return Math.round(delta * 100) / 100
  }, [preAdjustmentTotal])

  const orderTotal = useMemo(() => {
    const total = preAdjustmentTotal + autoAdjustment
    return Math.max(0, Math.round(total * 100) / 100)
  }, [preAdjustmentTotal, autoAdjustment])

  // Keep state in sync for payload (read-only UI)
  useEffect(() => setMlQuantity(autoMlQuantity), [autoMlQuantity])
  useEffect(() => setWeightQuantity(autoWeightQuantity), [autoWeightQuantity])
  useEffect(() => setMlTax(autoMlTax), [autoMlTax])
  useEffect(() => setWeightTax(autoWeightTax), [autoWeightTax])
  useEffect(() => setVapeTax(autoVapeTax), [autoVapeTax])
  useEffect(() => setAdjustment(autoAdjustment), [autoAdjustment])

  const validateMinSellingPrice = () => {
    const customerType = String(selectedCustomer?.customerType || '').toLowerCase()
    const minField = customerType === 'retail' ? 'retailMin' : 'whMin'
    const violations = []
    lines.forEach((line, idx) => {
      const product = productByBusinessId.get(line.productId)
      if (!product) return
      const packing = (product.packings || []).find((pk) => pk.unitType === line.unitType)
      const minPrice = Math.max(0, Number(packing?.[minField]) || 0)
      const enteredPrice = Math.max(0, Number(line.unitPrice) || 0)
      if (minPrice > 0 && enteredPrice < minPrice) {
        violations.push({
          idx,
          productId: line.productId,
          productName: line.productName,
          enteredPrice,
          minPrice,
        })
      }
    })
    return violations
  }

  const currentMinPriceViolations = useMemo(
    () => validateMinSellingPrice(),
    [lines, selectedCustomer, productByBusinessId],
  )

  const getLinePriceMeta = (line) => {
    const product = productByBusinessId.get(line?.productId)
    const packing = (product?.packings || []).find((pk) => pk.unitType === line?.unitType)
    const basePrice = Math.max(0, Number(packing?.base ?? packing?.cost ?? packing?.price ?? 0) || 0)
    const customerType = String(selectedCustomer?.customerType || '').toLowerCase()
    const minField = customerType === 'retail' ? 'retailMin' : 'whMin'
    const minPrice = Math.max(0, Number(packing?.[minField] ?? 0) || 0)
    const customPrice = Math.max(0, Number(line?.unitPrice ?? 0) || 0)
    return { basePrice, minPrice, customPrice }
  }

  const save = async (submit) => {
    setError('')
    if (!selectedCustomer?._id) {
      setError('Customer is required.')
      return
    }
    if (!shippingType) {
      setError('Shipping Type is required.')
      return
    }
    if (submit || !!editId) {
      const violations = currentMinPriceViolations
      if (violations.length > 0) {
        setMinPriceViolations(violations)
        setShowMinPriceModal(true)
        setError('Item price cannot be lower than minimum selling price.')
        return
      }
    }
    setMinPriceViolations([])
    setSaving(true)
    try {
      const payload = {
        customerId: selectedCustomer._id,
        status: 'new',
        orderDate,
        deliveryDate,
        terms,
        shippingType,
        billingAddress,
        shippingAddress,
        salesPersonRemark,
        driverRemark,
        lineItems: lines,
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
        persistPriceLevelOnSubmit: submit === true,
      }
      const res = editId ? await api.put(`/api/sales/orders/${editId}`, payload) : await api.post('/api/sales/orders', payload)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to save order')
      navigate('/sales/orders')
    } catch (e) {
      setError(e.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sales-tablet-page sales-new-order-page">
      <h2 className="mb-4">New Order</h2>
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Card className="mb-3">
        <Card.Body>
          <Row className="g-3">
            <Col md={3}>
              <Form.Group>
                <Form.Label>Order No</Form.Label>
                <Form.Control value="" placeholder="" readOnly disabled />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Order Date</Form.Label>
                <Form.Control type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Delivery Date</Form.Label>
                <Form.Control type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Order Status</Form.Label>
                <div className="mt-1"><Badge bg="info">New</Badge></div>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Terms</Form.Label>
                <Form.Select value={terms} onChange={(e) => setTerms(e.target.value)}>
                  <option value="">- Select Terms -</option>
                  {TERMS_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Customer <span className="text-danger">*</span></Form.Label>
                <Form.Select
                  value={selectedCustomer?._id || ''}
                  onChange={(e) => {
                    const c = customers.find((x) => x._id === e.target.value) || null
                    setSelectedCustomer(c)
                    if (c) {
                      setBillingAddress(formatCustomerAddress(c.billingAddress))
                      setShippingAddress(formatCustomerAddress(c.shippingAddress))
                    } else {
                      setBillingAddress('')
                      setShippingAddress('')
                    }
                  }}
                  required
                >
                  <option value="">- Select -</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {(c.customerName || c.businessName || 'Customer')} - {c.customerNumber || 'No CST'}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Customer Type</Form.Label>
                <Form.Control value={selectedCustomer?.customerType || ''} readOnly disabled placeholder="" />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Shipping Type <span className="text-danger">*</span></Form.Label>
                <Form.Select value={shippingType} onChange={(e) => setShippingType(e.target.value)} required>
                  {SHIPPING_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Billing Address</Form.Label>
                <Form.Control as="textarea" rows={2} value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <div className="d-flex justify-content-between align-items-center">
                  <Form.Label className="mb-0">Shipping Address</Form.Label>
                  <Button size="sm" variant="outline-secondary" onClick={() => setShippingAddress(billingAddress)}>Change Address</Button>
                </div>
                <Form.Control className="mt-1" as="textarea" rows={2} value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} />
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Body>
          <Row className="g-3">
            <Col md={3}>
              <Form.Group>
                <Form.Label>Barcode</Form.Label>
                <Form.Control placeholder="Enter Barcode here" value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} onKeyDown={handleBarcodeKeyDown} />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Product <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  className="mb-2"
                  type="text"
                  placeholder="Search by ID / name"
                  value={pickProductSearch}
                  onChange={(e) => setPickProductSearch(e.target.value)}
                  onKeyDown={handleProductSearchKeyDown}
                />
                <Form.Select
                  value={pickProductId}
                  onChange={(e) => {
                    const nextProductId = e.target.value
                    setPickProductId(nextProductId)
                    const chosen = products.find((p) => p._id === nextProductId)
                    const defaultUnit = getDefaultPacking(chosen)
                    setPickUnitType(defaultUnit?.unitType || '')
                  }}
                >
                  <option value="">- Select -</option>
                  {orderedFilteredProducts.map((p) => (
                    <option key={p._id} value={p._id}>{p.productId} - {p.productName}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Unit Type <span className="text-danger">*</span></Form.Label>
                <Form.Select value={pickUnitType} onChange={(e) => setPickUnitType(e.target.value)} disabled={!selectedProduct}>
                  <option value="">- Select -</option>
                  {unitOptions.map((u) => <option key={u.unitType} value={u.unitType}>{u.unitType}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={1}>
              <Form.Group>
                <Form.Label>Qty <span className="text-danger">*</span></Form.Label>
                <Form.Control type="number" min={1} value={pickQty} onChange={(e) => setPickQty(e.target.value)} />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Flags</Form.Label>
                <div className="d-flex flex-wrap gap-2">
                  <Form.Check label="Is Exchange" checked={pickIsExchange} onChange={(e) => setPickIsExchange(e.target.checked)} />
                  <Form.Check label="Is Taxable" checked={pickIsTaxable} onChange={(e) => setPickIsTaxable(e.target.checked)} />
                  <Form.Check
                    label="Is Free Item"
                    checked={pickIsFreeItem && canBeFree}
                    disabled={!canBeFree}
                    onChange={(e) => setPickIsFreeItem(e.target.checked)}
                  />
                </div>
              </Form.Group>
            </Col>
            <Col md={12}>
              <Button
                type="button"
                variant="outline-primary"
                disabled={!selectedProduct || !pickUnitType}
                onClick={() => addLine(selectedProduct)}
              >
                Add
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0" size="sm">
            <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
              <tr>
                <th>Action</th>
                <th>ID</th>
                <th>Product Name</th>
                <th>Unit</th>
                <th className="text-end">Qty</th>
                <th className="text-end">Total Pieces</th>
                <th className="text-end">Unit Price</th>
                <th className="text-end">SRP</th>
                <th className="text-end">Item Total</th>
                <th className="text-end">Discount (%)</th>
                <th className="text-end">Discount Amount</th>
                <th className="text-end">Net Price</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr><td colSpan={12} className="text-center text-muted py-3">No Product Selected.</td></tr>
              )}
              {lines.map((l, idx) => (
                <tr
                  key={`${l.productId}-${idx}`}
                  style={
                    currentMinPriceViolations.some((v) => v.idx === idx)
                      ? { backgroundColor: '#fee2e2' }
                      : undefined
                  }
                >
                  <td>
                    <Button
                      variant="link"
                      size="sm"
                      className="text-danger p-0"
                      onClick={removeLine(idx)}
                      disabled={!canRemoveLine}
                    >
                      Remove
                    </Button>
                  </td>
                  <td>
                    <OverlayTrigger
                      placement="top"
                      overlay={(
                        <Tooltip id={`line-price-meta-${idx}`}>
                          {(() => {
                            const meta = getLinePriceMeta(l)
                            return `Base: $${money(meta.basePrice)} | Min: $${money(meta.minPrice)} | Custom: $${money(meta.customPrice)}`
                          })()}
                        </Tooltip>
                      )}
                    >
                      <span style={{ cursor: 'help', textDecoration: 'underline dotted' }}>
                        {l.productId}
                      </span>
                    </OverlayTrigger>
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span>{l.productName}</span>
                      {l.isAddedLater && <Badge bg="primary">Added later</Badge>}
                    </div>
                  </td>
                  <td>{l.unitType}</td>
                  <td className="text-end">
                    <Form.Control size="sm" type="number" min={0} value={l.qty ?? 0} onChange={(e) => updateLine(idx, { qty: e.target.value })} className="text-end" />
                  </td>
                  <td className="text-end">{Number(l.pieces || 0)}</td>
                  <td className="text-end">
                    <Form.Control size="sm" type="number" min={0} step={0.01} value={l.unitPrice ?? 0} onChange={(e) => updateLine(idx, { unitPrice: e.target.value })} className="text-end" />
                  </td>
                  <td className="text-end">{money(l.srp)}</td>
                  <td className="text-end">{money(l.lineTotal)}</td>
                  <td className="text-end">
                    <Form.Control size="sm" type="number" min={0} step={0.01} value={l.discountPercent ?? 0} onChange={(e) => updateLine(idx, { discountPercent: e.target.value })} className="text-end" />
                  </td>
                  <td className="text-end">
                    <Form.Control size="sm" type="number" min={0} step={0.01} value={l.discountAmount ?? 0} onChange={(e) => updateLine(idx, { discountAmount: e.target.value })} className="text-end" />
                  </td>
                  <td className="text-end">{money(l.netPrice)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Body>
          <Row className="g-3">
            <Col md={6}>
              <div className="d-flex justify-content-between"><span className="fw-semibold">Sub Total</span><span>$ {money(subtotal)}</span></div>
              <hr />
              <Row className="g-2 align-items-center">
                <Col xs={6}><div className="fw-semibold">Overall Discount</div></Col>
                <Col xs={3}>
                  <Form.Control size="sm" type="number" min={0} step={0.01} value={overallDiscountPercent} onChange={(e) => handleOverallPercentChange(e.target.value)} />
                </Col>
                <Col xs={3}><div className="small text-muted">%</div></Col>
                <Col xs={6}></Col>
                <Col xs={6}>
                  <Form.Control size="sm" type="number" min={0} step={0.01} value={overallDiscountAmount} onChange={(e) => handleOverallAmountChange(e.target.value)} />
                </Col>
              </Row>
              <hr />
              <Row className="g-2 align-items-center">
                <Col xs={6}><div className="fw-semibold">Shipping Charges</div></Col>
                <Col xs={6}><Form.Control size="sm" type="number" min={0} step={0.01} value={shippingCharges} onChange={(e) => setShippingCharges(parseFloat(e.target.value) || 0)} /></Col>
              </Row>
              <hr />
              <Row className="g-2 align-items-center">
                <Col xs={6}><div className="fw-semibold">Tax Type</div></Col>
                <Col xs={6}>
                  <Form.Select size="sm" value={taxType} disabled>
                    <option value="">-Select Tax Type-</option>
                    {TAX_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Form.Select>
                </Col>
                <Col xs={6}><div className="fw-semibold">Tax %</div></Col>
                <Col xs={6}><Form.Control size="sm" type="number" min={0} step={0.01} value={taxPercent} readOnly disabled /></Col>
                <Col xs={6}><div className="fw-semibold">Total Tax</div></Col>
                <Col xs={6} className="text-end">$ {money(totalTax)}</Col>
              </Row>
            </Col>
            <Col md={6}>
              <Row className="g-2 align-items-center">
                <Col xs={6}><div className="fw-semibold">ML Quantity</div></Col>
                <Col xs={6}><Form.Control size="sm" type="number" min={0} step={0.01} value={mlQuantity} readOnly disabled /></Col>
                <Col xs={6}><div className="fw-semibold">ML Tax</div></Col>
                <Col xs={6}><Form.Control size="sm" type="number" min={0} step={0.01} value={mlTax} readOnly disabled /></Col>
                <Col xs={6}><div className="fw-semibold">Weight Quantity</div></Col>
                <Col xs={6}><Form.Control size="sm" type="number" min={0} step={0.01} value={weightQuantity} readOnly disabled /></Col>
                <Col xs={6}><div className="fw-semibold">Weight Tax</div></Col>
                <Col xs={6}><Form.Control size="sm" type="number" min={0} step={0.01} value={weightTax} readOnly disabled /></Col>
                <Col xs={6}><div className="fw-semibold">Vape Tax</div></Col>
                <Col xs={6}><Form.Control size="sm" type="number" min={0} step={0.01} value={vapeTax} readOnly disabled /></Col>
                <Col xs={6}><div className="fw-semibold">Adjustment</div></Col>
                <Col xs={6}><Form.Control size="sm" type="number" step={0.01} value={adjustment} readOnly disabled /></Col>
              </Row>
              <hr />
              <div className="d-flex justify-content-between fs-5">
                <strong>Order Total</strong>
                <strong>$ {money(orderTotal)}</strong>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Header>Payment Details</Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0" size="sm">
            <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
              <tr>
                <th>Payment ID</th>
                <th>Payment Date</th>
                <th>Payment Mode</th>
                <th className="text-end">Settled Amount</th>
                <th>Settled By</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="text-center text-muted py-3">No payment records (coming soon).</td>
              </tr>
            </tbody>
          </Table>
        </Card.Body>
        <Card.Footer className="text-end">
          <strong>Total Settled Amount</strong> $ {money(0)}
        </Card.Footer>
      </Card>

      <Card className="mb-3">
        <Card.Header>Sales Person Details</Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Remark</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={salesPersonRemark}
                  onChange={(e) => setSalesPersonRemark(e.target.value.slice(0, 500))}
                  placeholder="Write remark upto 500 character..."
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Driver Remark</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={driverRemark}
                  onChange={(e) => setDriverRemark(e.target.value.slice(0, 500))}
                  placeholder="Write remark upto 500 character..."
                />
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <div className="d-flex flex-wrap gap-2">
        {!editId && (
          <Button type="button" disabled={saving} variant="secondary" onClick={() => save(false)}>Save</Button>
        )}
        <Button
          type="button"
          disabled={saving}
          style={{ backgroundColor: '#F29F67', borderColor: '#F29F67', color: '#1E1E2C' }}
          onClick={() => save(true)}
        >
          {editId ? 'Update' : 'Submit'}
        </Button>
        <Button type="button" variant="outline-secondary" onClick={() => navigate('/sales/orders')}>Back</Button>
      </div>

      <Modal show={showMinPriceModal} onHide={() => setShowMinPriceModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Price Validation</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">Items price can not be lower then min selling price.</p>
          <ul className="mb-0 ps-3">
            {minPriceViolations.map((v) => (
              <li key={`${v.productId}-${v.idx}`}>
                {v.productId} - {v.productName}: entered ${money(v.enteredPrice)} / min ${money(v.minPrice)}
              </li>
            ))}
          </ul>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowMinPriceModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default NewOrderPage
