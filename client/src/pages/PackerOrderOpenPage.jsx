import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/api'

function PackerOrderOpenPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showLogModal, setShowLogModal] = useState(false)

  const loadOrder = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get(`/api/sales/orders/${id}`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) throw new Error(data?.message || 'Failed to load order.')
      setOrder(data)
    } catch (e) {
      setError(e.message || 'Failed to load order.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrder()
  }, [id])

  const updatePackedQty = (idx, value) => {
    const packedQty = Math.max(0, Number(value) || 0)
    setOrder((prev) => {
      const lines = Array.isArray(prev?.lineItems) ? [...prev.lineItems] : []
      lines[idx] = { ...lines[idx], packedQty }
      return { ...prev, lineItems: lines }
    })
  }

  const savePacking = async () => {
    if (!order) return
    setSaving(true)
    setError('')
    const packedItems = (order.lineItems || []).map((l) => ({
      productId: l.productId,
      unitType: l.unitType,
      packedQty: Math.max(0, Number(l.packedQty) || 0),
    }))
    const res = await api.patch(`/api/sales/orders/${order._id}/packing`, { packedItems })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(data?.message || 'Failed to save packing.')
      return
    }
    setOrder(data)
  }

  const markPacked = async () => {
    if (!order) return
    await savePacking()
    const res = await api.patch(`/api/sales/orders/${order._id}/workflow`, { action: 'mark_packed' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data?.message || 'Failed to pack order.')
      return
    }
    setOrder(data)
  }

  const printOrder = () => {
    if (!order) return
    const w = window.open('', '_blank', 'width=950,height=800')
    if (!w) return
    const orderNo = String(order.orderNumber || '')
    w.document.write(`
      <html>
        <head>
          <title>${orderNo || 'Order'}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
        </head>
        <body style="font-family:Arial;padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
            <h3 style="margin:0;">Order ${orderNo}</h3>
            <svg id="order-barcode"></svg>
          </div>
          <div>Status: ${order.status || ''}</div>
          <div>Customer: ${order.customer?.customerName || order.customer?.businessName || ''}</div>
          <div>Sales Person: ${order.salesPerson?.name || order.salesPerson?.username || ''}</div>
          <hr/>
          <table border="1" cellspacing="0" cellpadding="6" style="width:100%;border-collapse:collapse;">
            <thead><tr><th>ID</th><th>Product</th><th>Unit</th><th>Ordered Qty</th><th>Packed Qty</th></tr></thead>
            <tbody>
              ${(order.lineItems || []).map((l) => `<tr><td>${l.productId || ''}</td><td>${l.productName || ''}</td><td>${l.unitType || ''}</td><td>${Number(l.qty || 0)}</td><td>${Number(l.packedQty || 0)}</td></tr>`).join('')}
            </tbody>
          </table>
          <script>
            try { JsBarcode('#order-barcode', ${JSON.stringify(orderNo)}, { format:'CODE128', width:2, height:40, displayValue:true }); } catch (e) {}
          </script>
        </body>
      </html>
    `)
    w.document.close()
    w.print()
  }

  const totals = useMemo(() => {
    const lines = Array.isArray(order?.lineItems) ? order.lineItems : []
    return lines.reduce(
      (acc, l) => {
        const ordered = Math.max(0, Number(l.qty) || 0)
        const packed = Math.max(0, Number(l.packedQty) || 0)
        const pieces = Math.max(0, Number(l.qtyPerUnit) || 1) * packed
        acc.ordered += ordered
        acc.packed += packed
        acc.pieces += pieces
        return acc
      },
      { ordered: 0, packed: 0, pieces: 0 },
    )
  }, [order])

  if (loading) return <p>Loading order...</p>
  if (!order) return <Alert variant="danger">{error || 'Order not found.'}</Alert>

  return (
    <>
      {error && <Alert variant="danger">{error}</Alert>}
      <Card className="mb-3">
        <Card.Header>
          <h4 className="mb-0">
            Order Details - <strong>{order.orderNumber}</strong>{' '}
            <Badge bg="primary">{order.status}</Badge>{' '}
            <Badge bg="warning" text="dark">{order.shippingType || '-'}</Badge>
          </h4>
        </Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={2}><Form.Label>Order Date</Form.Label><Form.Control value={order.orderDate ? new Date(order.orderDate).toLocaleDateString() : ''} readOnly /></Col>
            <Col md={2}><Form.Label>Sales Person</Form.Label><Form.Control value={order.salesPerson?.name || order.salesPerson?.username || ''} readOnly /></Col>
            <Col md={4}><Form.Label>Customer</Form.Label><Form.Control value={order.customer?.customerName || order.customer?.businessName || ''} readOnly /></Col>
            <Col md={4}><Form.Label>Shipping Address</Form.Label><Form.Control value={order.shippingAddress || ''} readOnly /></Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0" size="sm">
            <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
              <tr>
                <th>ID</th>
                <th>Product Name</th>
                <th>Unit</th>
                <th className="text-end">Ordered Qty</th>
                <th className="text-end">Packed Qty</th>
                <th className="text-end">Not Packed Qty</th>
                <th className="text-end">Total Pieces</th>
              </tr>
            </thead>
            <tbody>
              {(order.lineItems || []).map((l, idx) => {
                const ordered = Math.max(0, Number(l.qty) || 0)
                const packed = Math.max(0, Number(l.packedQty) || 0)
                const remain = Math.max(0, ordered - packed)
                const pieces = Math.max(0, Number(l.qtyPerUnit) || 1) * packed
                return (
                  <tr key={`${l.productId}-${l.unitType}-${idx}`}>
                    <td>{l.productId}</td>
                    <td>{l.productName}</td>
                    <td>{l.unitType}</td>
                    <td className="text-end">{ordered}</td>
                    <td className="text-end" style={{ width: 120 }}>
                      <Form.Control
                        size="sm"
                        type="number"
                        min={0}
                        max={ordered}
                        value={packed}
                        onChange={(e) => updatePackedQty(idx, e.target.value)}
                      />
                    </td>
                    <td className="text-end">{remain}</td>
                    <td className="text-end">{pieces}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="text-end"><strong>Totals</strong></td>
                <td className="text-end"><strong>{totals.ordered}</strong></td>
                <td className="text-end"><strong>{totals.packed}</strong></td>
                <td className="text-end"><strong>{Math.max(0, totals.ordered - totals.packed)}</strong></td>
                <td className="text-end"><strong>{totals.pieces}</strong></td>
              </tr>
            </tfoot>
          </Table>
        </Card.Body>
      </Card>

      <Card>
        <Card.Footer className="d-flex flex-wrap gap-2 justify-content-end">
          <Button variant="primary" onClick={printOrder}>Print Order</Button>
          <Button variant="success" onClick={markPacked} disabled={saving}>{saving ? 'Saving...' : 'Pack'}</Button>
          <Button variant="dark" onClick={() => setShowLogModal(true)}>View Log</Button>
          <Button variant="secondary" onClick={() => navigate('/')}>Back</Button>
        </Card.Footer>
      </Card>

      <Modal show={showLogModal} onHide={() => setShowLogModal(false)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Order Log</Modal.Title></Modal.Header>
        <Modal.Body>
          <Table bordered size="sm" className="mb-0">
            <thead>
              <tr><th>Action By</th><th>Date</th><th>Action</th></tr>
            </thead>
            <tbody>
              {(order.logs || []).slice().reverse().map((l, idx) => (
                <tr key={`${idx}-${l.at || ''}`}>
                  <td>{l.byUserName || 'User'}</td>
                  <td>{l.at ? new Date(l.at).toLocaleString() : '-'}</td>
                  <td>{l.action || '-'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={() => setShowLogModal(false)}>Close</Button></Modal.Footer>
      </Modal>
    </>
  )
}

export default PackerOrderOpenPage
