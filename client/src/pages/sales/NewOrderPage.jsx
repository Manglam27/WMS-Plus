import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, Col, Form, Row, Table } from 'react-bootstrap'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/api'

const SHIPPING_TYPES = ['Ground Shipping', 'Local Delivery', 'Pickup']
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

function NewOrderPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')

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
    const addr = selectedCustomer.storeLocation || ''
    if (!billingAddress) setBillingAddress(addr)
    if (!shippingAddress) setShippingAddress(addr)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer?._id])

  const productByMongoId = useMemo(() => {
    const map = new Map()
    products.forEach((p) => map.set(p._id, p))
    return map
  }, [products])

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
  const unitOptions = selectedProduct ? (selectedProduct.packings || []).filter((p) => p.enabled !== false) : []
  const currentPacking = selectedProduct && pickUnitType
    ? (selectedProduct.packings || []).find((p) => p.unitType === pickUnitType)
    : null
  const canBeFree = !!currentPacking?.isFree

  useEffect(() => {
    if (!selectedProduct) return
    const first = unitOptions.find((u) => u.unitType === 'Piece') || unitOptions[0]
    if (!pickUnitType && first?.unitType) setPickUnitType(first.unitType)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickProductId])

  const addLine = (product, packing, qtyOverride) => {
    if (!product) return
    const exists = lines.some((l) => l.productId === product.productId)
    if (exists) {
      setError('This product is already in the order. You cannot add it in a different unit.')
      return
    }
    const pack = packing || (product.packings || []).find((p) => p.unitType === pickUnitType) || (product.packings || [])[0]
    const unitType = pack?.unitType || 'Piece'
    const qtyPerUnit = Math.max(1, Number(pack?.qty) || 1)
    const qty = Math.max(1, Number(qtyOverride ?? pickQty) || 1)
    const pieces = qty * qtyPerUnit
    const unitPrice = pickIsFreeItem ? 0 : Math.max(0, Number(pack?.cost ?? pack?.price ?? 0) || 0)
    const srp = Math.max(0, Number(product.srp) || 0)
    const lineTotal = Math.round(qty * unitPrice * 100) / 100
    const discountPercent = 0
    const discountAmount = 0
    const netPrice = lineTotal
    setLines((prev) => [
      ...prev,
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
      },
    ])
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

  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.netPrice) || 0), 0), [lines])

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
    setSaving(true)
    try {
      const payload = {
        customerId: selectedCustomer._id,
        status: submit ? 'submitted' : 'new',
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
    <>
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
                  }}
                  required
                >
                  <option value="">- Select -</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.businessName} ({c.customerNumber || c._id})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Customer Type</Form.Label>
                <Form.Control value={selectedCustomer?.priceLevelCode || ''} readOnly disabled placeholder="" />
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
                <Form.Select value={pickProductId} onChange={(e) => { setPickProductId(e.target.value); setPickUnitType('') }}>
                  <option value="">- Select -</option>
                  {products.map((p) => (
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
                <tr key={`${l.productId}-${idx}`}>
                  <td><Button variant="link" size="sm" className="text-danger p-0" onClick={removeLine(idx)}>Remove</Button></td>
                  <td>{l.productId}</td>
                  <td>{l.productName}</td>
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
        <Button type="button" disabled={saving} variant="secondary" onClick={() => save(false)}>Save</Button>
        <Button type="button" disabled={saving} style={{ backgroundColor: '#F29F67', borderColor: '#F29F67', color: '#1E1E2C' }} onClick={() => save(true)}>
          Submit
        </Button>
        <Button type="button" variant="outline-secondary" onClick={() => navigate('/sales/orders')}>Back</Button>
      </div>
    </>
  )
}

export default NewOrderPage
