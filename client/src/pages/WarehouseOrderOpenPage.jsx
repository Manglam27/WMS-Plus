import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, Col, Form, Row, Table } from 'react-bootstrap'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/api'

function WarehouseOrderOpenPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [products, setProducts] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [draftLine, setDraftLine] = useState({
    productMongoId: '',
    unitType: '',
    qty: '1',
  })

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [orderRes, productsRes] = await Promise.all([
        api.get(`/api/sales/orders/${id}`),
        api.get('/api/products?status=Active&limit=200'),
      ])
      const [orderData, productsData] = await Promise.all([
        orderRes.json().catch(() => null),
        productsRes.json().catch(() => ({ items: [] })),
      ])
      if (!orderRes.ok || !orderData) throw new Error(orderData?.message || 'Failed to load order.')
      if (!['new', 'processed', 'add-on'].includes(String(orderData.status || ''))) {
        throw new Error('Warehouse editing is only available for new, processed, and add-on orders.')
      }
      setOrder(orderData)
      const rows = Array.isArray(productsData?.items) ? productsData.items : []
      setProducts(rows)
    } catch (e) {
      setError(e.message || 'Failed to load order.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const selectedProduct = useMemo(
    () => products.find((p) => p._id === draftLine.productMongoId) || null,
    [products, draftLine.productMongoId],
  )

  const unitOptions = useMemo(() => {
    const list = Array.isArray(selectedProduct?.packings) ? selectedProduct.packings : []
    return list.filter((p) => (Number(p.qty) || 0) > 0)
  }, [selectedProduct])

  const getPacking = (prod, unitType) => {
    const list = Array.isArray(prod?.packings) ? prod.packings : []
    return list.find((x) => String(x.unitType || '') === String(unitType || '')) || null
  }

  const addLine = () => {
    if (!order || !selectedProduct || !draftLine.unitType) return
    const qty = Math.max(1, Number(draftLine.qty) || 1)
    const packing = getPacking(selectedProduct, draftLine.unitType)
    if (!packing) return

    const nextLines = Array.isArray(order.lineItems) ? [...order.lineItems] : []
    const existingIdx = nextLines.findIndex(
      (l) => String(l.productId || '') === String(selectedProduct.productId || '') && String(l.unitType || '') === String(draftLine.unitType),
    )
    if (existingIdx >= 0) {
      const current = nextLines[existingIdx]
      const nextQty = Math.max(0, Number(current.qty || 0) + qty)
      const qtyPerUnit = Math.max(1, Number(current.qtyPerUnit || packing.qty || 1))
      const pieces = nextQty * qtyPerUnit
      nextLines[existingIdx] = {
        ...current,
        qty: nextQty,
        qtyPerUnit,
        pieces,
        lineTotal: Number(current.unitPrice || 0) * nextQty,
        netPrice: Math.max(0, Number(current.unitPrice || 0) * nextQty - Number(current.discountAmount || 0)),
      }
    } else {
      const qtyPerUnit = Math.max(1, Number(packing.qty || 1))
      const unitPrice = Math.max(0, Number(packing.base || packing.price || 0))
      const lineTotal = unitPrice * qty
      nextLines.push({
        productId: selectedProduct.productId,
        productName: selectedProduct.productName,
        unitType: draftLine.unitType,
        qtyPerUnit,
        qty,
        pieces: qty * qtyPerUnit,
        unitPrice,
        srp: Math.max(0, Number(packing.price || 0)),
        lineTotal,
        discountPercent: 0,
        discountAmount: 0,
        netPrice: lineTotal,
        isExchange: false,
        isTaxable: true,
        isFreeItem: false,
      })
    }

    setOrder((prev) => ({ ...prev, lineItems: nextLines }))
    setDraftLine({ productMongoId: '', unitType: '', qty: '1' })
    setShowAdd(false)
  }

  const removeLine = (idx) => {
    if (String(order?.status || '') === 'processed') {
      setError('For processed orders, items cannot be removed.')
      return
    }
    setOrder((prev) => {
      const lines = Array.isArray(prev?.lineItems) ? [...prev.lineItems] : []
      lines.splice(idx, 1)
      return { ...prev, lineItems: lines }
    })
  }

  const saveOrder = async () => {
    if (!order) return
    setSaving(true)
    setError('')
    const payload = {
      lineItems: Array.isArray(order.lineItems) ? order.lineItems : [],
    }
    const res = await api.put(`/api/sales/orders/${order._id}`, payload)
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(data?.message || 'Failed to update order.')
      return
    }
    setOrder(data)
  }

  if (loading) return <p>Loading order...</p>
  if (!order) return <Alert variant="danger">{error || 'Order not found.'}</Alert>

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="mb-0">Warehouse Order Open</h3>
        <Badge bg="primary">{order.status}</Badge>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="mb-3">
        <Card.Header>Customer & Sales Info</Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={3}><Form.Label>Order No</Form.Label><Form.Control value={order.orderNumber || ''} readOnly /></Col>
            <Col md={3}><Form.Label>Customer</Form.Label><Form.Control value={order.customer?.customerName || order.customer?.businessName || ''} readOnly /></Col>
            <Col md={3}><Form.Label>Sales Person</Form.Label><Form.Control value={order.salesPerson?.name || order.salesPerson?.username || ''} readOnly /></Col>
            <Col md={3}><Form.Label>Shipping Type</Form.Label><Form.Control value={order.shippingType || ''} readOnly /></Col>
            <Col md={6}><Form.Label>Billing Address</Form.Label><Form.Control as="textarea" rows={2} value={order.billingAddress || ''} readOnly /></Col>
            <Col md={6}><Form.Label>Shipping Address</Form.Label><Form.Control as="textarea" rows={2} value={order.shippingAddress || ''} readOnly /></Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>Items (No price data shown)</span>
          <Button size="sm" onClick={() => setShowAdd((v) => !v)}>+ Add Item</Button>
        </Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0" size="sm">
            <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
              <tr>
                <th>ID</th>
                <th>Product Name</th>
                <th>Unit</th>
                <th className="text-end">Qty</th>
                <th className="text-end">Total Pieces</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(order.lineItems || []).map((l, idx) => (
                <tr key={`${l.productId}-${l.unitType}-${idx}`}>
                  <td>{l.productId}</td>
                  <td>{l.productName}</td>
                  <td>{l.unitType}</td>
                  <td className="text-end">{Number(l.qty || 0)}</td>
                  <td className="text-end">{Number(l.pieces || 0)}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => removeLine(idx)}
                      disabled={String(order?.status || '') === 'processed'}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
              {(order.lineItems || []).length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-3">No items.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {showAdd && (
        <Card className="mb-3">
          <Card.Header>Add Item</Card.Header>
          <Card.Body>
            <Row className="g-2">
              <Col md={5}>
                <Form.Select
                  value={draftLine.productMongoId}
                  onChange={(e) => setDraftLine((p) => ({ ...p, productMongoId: e.target.value, unitType: '' }))}
                >
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.productId} - {p.productName}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={3}>
                <Form.Select
                  value={draftLine.unitType}
                  onChange={(e) => setDraftLine((p) => ({ ...p, unitType: e.target.value }))}
                  disabled={!selectedProduct}
                >
                  <option value="">Select unit</option>
                  {unitOptions.map((u, idx) => (
                    <option key={`${u.unitType}-${idx}`} value={u.unitType}>
                      {u.unitType}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Control
                  type="number"
                  min={1}
                  value={draftLine.qty}
                  onChange={(e) => setDraftLine((p) => ({ ...p, qty: e.target.value }))}
                />
              </Col>
              <Col md={2}>
                <Button className="w-100" onClick={addLine}>
                  Add
                </Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      <div className="d-flex justify-content-end gap-2">
        <Button variant="secondary" onClick={() => navigate('/warehouse/orders/processing')}>
          Back
        </Button>
        <Button variant="primary" onClick={saveOrder} disabled={saving}>
          {saving ? 'Saving...' : 'Update'}
        </Button>
      </div>
    </>
  )
}

export default WarehouseOrderOpenPage
