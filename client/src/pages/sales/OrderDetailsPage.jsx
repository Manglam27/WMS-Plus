import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/api'
import { useAuth } from '../../context/AuthContext'

function money(v) {
  return (Number(v) || 0).toFixed(2)
}

function OrderDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showLogModal, setShowLogModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [drivers, setDrivers] = useState([])
  const [assignChoice, setAssignChoice] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [showPackedLabelModal, setShowPackedLabelModal] = useState(false)
  const [totalBoxesInput, setTotalBoxesInput] = useState('1')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelRemark, setCancelRemark] = useState('')

  useEffect(() => {
    api
      .get(`/api/sales/orders/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok || !data) throw new Error(data?.message || 'Failed to load order.')
        setOrder(data)
      })
      .catch((e) => setError(e.message || 'Failed to load order.'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    api
      .get('/api/sales/drivers')
      .then(async (res) => {
        const data = await res.json().catch(() => [])
        if (res.ok) setDrivers(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
  }, [])

  const historyRows = useMemo(() => {
    if (!order) return []
    const rawLogs = Array.isArray(order.logs) ? order.logs : []
    if (rawLogs.length > 0) {
      return rawLogs
        .map((log, i) => ({
          id: `${log.at || i}-${log.action || i}`,
          action: log.action || 'Action',
          by: log.byUserName || 'User',
          at: log.at ? new Date(log.at).getTime() : 0,
          atLabel: log.at ? new Date(log.at).toLocaleString() : '—',
        }))
        .sort((a, b) => b.at - a.at)
    }
    const events = [
      { title: 'Order created', when: order.createdAt },
      { title: 'Packed', when: order.packedAt },
      { title: 'Shipped', when: order.shippedAt },
      { title: 'Delivered / Undelivered', when: order.deliveredAt },
      { title: 'Cancelled', when: order.cancelledAt },
      { title: 'Closed', when: order.closedAt },
    ]
    return events
      .filter((e) => e.when)
      .map((e, i) => ({ id: `${e.title}-${i}`, action: e.title, by: 'System', atLabel: new Date(e.when).toLocaleString() }))
  }, [order])

  const getShippingRowClass = (shippingType) => {
    const raw = String(shippingType || '').toLowerCase()
    if (raw.includes('ups')) return 'order-row--shipping-ups'
    if (raw.includes('sales pickup')) return 'order-row--shipping-sales-pickup'
    if (raw.includes('customer pickup')) return 'order-row--shipping-customer-pickup'
    return ''
  }

  const getPackedRowClass = (line) => {
    const ordered = Number(line?.qty || 0)
    const packed = Number(line?.packedQty ?? 0)
    if (ordered <= 0) return ''
    if (packed <= 0) return 'order-detail-row--packed-zero'
    if (packed < ordered) return 'order-detail-row--packed-partial'
    return ''
  }

  const canAssignDriver = ['packed', 'add-on-packed'].includes(order?.status)
  const canCancel = order?.status === 'new'
  const canPrintPackedLabel = ['packed', 'add-on-packed', 'ready-to-ship', 'shipped', 'delivered', 'undelivered', 'close'].includes(order?.status)
  const isSalesPerson = user?.role === 'sales_person'
  const isSalesPersonViewOnly = isSalesPerson && ['shipped', 'delivered', 'undelivered', 'close', 'cancelled'].includes(String(order?.status || ''))

  const assignDriver = async () => {
    if (!order) return
    setActionMessage('')
    if (assignChoice === 'customer_pickup') {
      const res = await api.put(`/api/sales/orders/${order._id}`, { shippingType: 'Customer Pickup' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setActionMessage(data.message || 'Failed to set Customer Pickup.')
        return
      }
      setOrder(data)
      setShowAssignModal(false)
      return
    }
    if (!assignChoice) {
      setActionMessage('Select a driver or Customer Pickup.')
      return
    }
    const res = await api.patch(`/api/sales/orders/${order._id}/workflow`, {
      action: 'assign_driver',
      driverId: assignChoice,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setActionMessage(data.message || 'Failed to assign driver.')
      return
    }
    setOrder(data)
    setShowAssignModal(false)
  }

  const cancelOrder = async () => {
    if (!order) return
    const remark = String(cancelRemark || '').trim()
    if (!remark) {
      setError('Reason for canceling the order is required.')
      return
    }
    const res = await api.patch(`/api/sales/orders/${order._id}/workflow`, { action: 'cancel_new', remark })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.message || 'Failed to cancel order.')
      return
    }
    setOrder(data)
    setCancelRemark('')
    setShowCancelModal(false)
  }

  const printPackedBoxLabels = () => {
    if (!order) return
    const totalBoxes = Math.max(1, Number(totalBoxesInput) || 1)
    const orderNo = String(order.orderNumber || '')
    const customerNo = String(order.customer?.customerNumber || order.customer?.customerId || 'N/A')
    const salesPerson = String(order.salesPerson?.name || order.salesPerson?.username || 'N/A')

    const labelHtml = Array.from({ length: totalBoxes }).map((_, i) => {
      const boxNo = i + 1
      const barcodeValue = `${orderNo}/${boxNo}`
      return `
        <div class="label">
          <div class="order-no">${orderNo}</div>
          <svg id="barcode-${boxNo}" class="barcode"></svg>
          <div class="box-count">${boxNo}/${totalBoxes}</div>
          <div class="meta">Customer: ${customerNo}</div>
          <div class="meta">Sales: ${salesPerson}</div>
          <script>window.__barcodeQueue = window.__barcodeQueue || []; window.__barcodeQueue.push({ id: "barcode-${boxNo}", value: "${barcodeValue}" });<\/script>
        </div>
      `
    }).join('')

    const win = window.open('', '_blank', 'width=1024,height=900')
    if (!win) return
    win.document.open()
    win.document.write(`
      <html>
        <head>
          <title>Packed Box Barcode Labels</title>
          <style>
            @page { size: 4in 6in; margin: 0; }
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
            .label {
              width: 4in;
              height: 6in;
              box-sizing: border-box;
              padding: 0.2in;
              border: 1px solid #111;
              page-break-after: always;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
              align-items: center;
              gap: 0.15in;
            }
            .order-no { font-size: 22px; font-weight: 700; margin-top: 0.1in; }
            .barcode { width: 3.3in; height: 1.8in; }
            .box-count { font-size: 20px; font-weight: 700; margin-top: 0.1in; }
            .meta { font-size: 13px; width: 100%; text-align: left; }
          </style>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
        </head>
        <body>
          ${labelHtml}
          <script>
            (window.__barcodeQueue || []).forEach(function (item) {
              try {
                JsBarcode('#' + item.id, item.value, {
                  format: 'CODE128',
                  width: 2.2,
                  height: 90,
                  displayValue: true,
                  fontSize: 18,
                  margin: 4
                });
              } catch (e) {}
            });
            setTimeout(function () { window.print(); }, 250);
          </script>
        </body>
      </html>
    `)
    win.document.close()
    setShowPackedLabelModal(false)
  }

  if (loading) return <p>Loading order details...</p>
  if (!order) return <Alert variant="danger">{error || 'Order not found.'}</Alert>

  return (
    <div className="sales-tablet-page sales-order-details-page">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="mb-1">Order Detail</h3>
        </div>
      </div>
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Card className="mb-3">
        <Card.Header>Order Information</Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={3}><Form.Label>Order No</Form.Label><Form.Control value={order.orderNumber || ''} readOnly /></Col>
            <Col md={3}><Form.Label>Order Date</Form.Label><Form.Control value={order.orderDate ? new Date(order.orderDate).toLocaleDateString() : ''} readOnly /></Col>
            <Col md={3}><Form.Label>Order Status</Form.Label><div className="mt-1"><Badge bg="primary">{order.status || 'new'}</Badge></div></Col>
            <Col md={3}><Form.Label>Delivery Date</Form.Label><Form.Control value={order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : ''} readOnly /></Col>
            <Col md={3}><Form.Label>Sales Person</Form.Label><Form.Control value={order.salesPerson?.name || order.salesPerson?.username || ''} readOnly /></Col>
            <Col md={3}><Form.Label>Customer</Form.Label><Form.Control value={order.customer?.customerName || order.customer?.businessName || ''} readOnly /></Col>
            <Col md={3}><Form.Label>Terms</Form.Label><Form.Control value={order.terms || ''} readOnly /></Col>
            <Col md={3}><Form.Label>Shipping Type</Form.Label><Form.Control value={order.shippingType || ''} readOnly /></Col>
            <Col md={6}><Form.Label>Billing Address</Form.Label><Form.Control as="textarea" rows={2} value={order.billingAddress || ''} readOnly /></Col>
            <Col md={6}><Form.Label>Shipping Address</Form.Label><Form.Control as="textarea" rows={2} value={order.shippingAddress || ''} readOnly /></Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Header>Item Details</Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0" size="sm">
            <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
              <tr>
                <th>ID</th>
                <th>Product Name</th>
                <th>Unit</th>
                <th className="text-end">Ordered Qty</th>
                <th>Barcode</th>
                <th className="text-end">Packed Qty</th>
                <th className="text-end">Total Pieces</th>
                <th className="text-end">Unit Price</th>
                <th className="text-end">SRP</th>
                <th className="text-end">Item Total</th>
                <th className="text-end">Discount (%)</th>
                <th className="text-end">Discount Amount</th>
                <th className="text-end">Net Price</th>
                <th>Item Scan Time</th>
              </tr>
            </thead>
            <tbody>
              {(order.lineItems || []).map((l, idx) => (
                <tr
                  key={`${l.productId}-${idx}`}
                  className={`${getShippingRowClass(order.shippingType)} ${getPackedRowClass(l)}`.trim()}
                >
                  <td>{l.productId}</td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span>{l.productName}</span>
                      {l.isAddedLater && <Badge bg="primary">Added later</Badge>}
                    </div>
                  </td>
                  <td>{l.unitType}</td>
                  <td className="text-end">{Number(l.qty || 0)}</td>
                  <td>{l.barcode || '—'}</td>
                  <td className="text-end">{Number(l.packedQty ?? l.qty ?? 0)}</td>
                  <td className="text-end">{Number(l.pieces || 0)}</td>
                  <td className="text-end">{money(l.unitPrice)}</td>
                  <td className="text-end">{money(l.srp)}</td>
                  <td className="text-end">{money(l.lineTotal)}</td>
                  <td className="text-end">{money(l.discountPercent)}</td>
                  <td className="text-end">{money(l.discountAmount)}</td>
                  <td className="text-end">{money(l.netPrice)}</td>
                  <td>{l.itemScanTime ? new Date(l.itemScanTime).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Body>
          <Row>
            <Col md={6}>
              <div className="small"><strong>Total Amount:</strong> $ {money(order.subtotal)}</div>
              <div className="small"><strong>Shipping Charges:</strong> $ {money(order.shippingCharges)}</div>
              <div className="small"><strong>Total Tax:</strong> $ {money(order.totalTax)}</div>
            </Col>
            <Col md={6} className="text-md-end">
              <div><strong>Grand Total:</strong> $ {money(order.orderTotal)}</div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card>
        <Card.Footer className="d-flex flex-wrap justify-content-end gap-2">
          {isSalesPersonViewOnly ? (
            <>
              <Button variant="dark" onClick={() => setShowLogModal(true)}>View Log</Button>
              <Button variant="secondary" onClick={() => navigate('/sales/orders')}>Back</Button>
            </>
          ) : (
            <>
              <Button variant="primary" onClick={() => navigate(`/sales/orders/new?edit=${order._id}`)}>Edit</Button>
              {!isSalesPerson && (
                <>
                  <Button variant="warning" onClick={() => setShowAssignModal(true)} disabled={!canAssignDriver}>Assign Driver</Button>
                  <Button variant="info" onClick={() => setShowPackedLabelModal(true)} disabled={!canPrintPackedLabel}>
                    Packed Box Barcode
                  </Button>
                  <Button variant="danger" onClick={() => setShowCancelModal(true)} disabled={!canCancel}>Cancel Order</Button>
                </>
              )}
              <Button variant="dark" onClick={() => setShowLogModal(true)}>View Log</Button>
              <Button variant="secondary" onClick={() => navigate('/sales/orders')}>Back</Button>
            </>
          )}
        </Card.Footer>
      </Card>

      <Modal show={showLogModal} onHide={() => setShowLogModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>Order Log</Modal.Title></Modal.Header>
        <Modal.Body>
          {historyRows.length === 0 ? (
            <div className="text-muted">No log entries yet.</div>
          ) : (
            <Table bordered size="sm" className="mb-0">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>User</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((h) => (
                  <tr key={h.id}>
                    <td>{h.action}</td>
                    <td>{h.by}</td>
                    <td>{h.atLabel}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={() => setShowLogModal(false)}>Close</Button></Modal.Footer>
      </Modal>

      <Modal show={showAssignModal} onHide={() => setShowAssignModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>Assign Driver</Modal.Title></Modal.Header>
        <Modal.Body>
          {drivers.map((d) => (
            <Form.Check
              key={d._id}
              type="radio"
              name="driver-choice"
              label={d.name || d.username}
              checked={assignChoice === d._id}
              onChange={() => setAssignChoice(d._id)}
            />
          ))}
          <Form.Check
            type="radio"
            name="driver-choice"
            label="Customer Pickup"
            checked={assignChoice === 'customer_pickup'}
            onChange={() => setAssignChoice('customer_pickup')}
          />
          {actionMessage && <div className="text-danger small mt-2">{actionMessage}</div>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAssignModal(false)}>Close</Button>
          <Button variant="primary" onClick={assignDriver}>Assign</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showPackedLabelModal} onHide={() => setShowPackedLabelModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>Packed Box Barcode</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Total Boxes</Form.Label>
            <Form.Control
              type="number"
              min={1}
              value={totalBoxesInput}
              onChange={(e) => setTotalBoxesInput(e.target.value)}
            />
          </Form.Group>
          <div className="small text-muted mt-2">
            Label includes Order No, barcode (OrderNo/BoxNo), current/total box number, customer ID and sales person.
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPackedLabelModal(false)}>Close</Button>
          <Button variant="primary" onClick={printPackedBoxLabels}>Print 4x6</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showCancelModal} onHide={() => setShowCancelModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>Cancel Order Warning</Modal.Title></Modal.Header>
        <Modal.Body>
          <Alert variant="warning" className="mb-2">
            You are about to cancel this order. Reason for canceling the order.
          </Alert>
          <Form.Group>
            <Form.Label>Reason for canceling the order <span className="text-danger">*</span></Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={500}
              value={cancelRemark}
              onChange={(e) => setCancelRemark(e.target.value)}
              placeholder="Reason for canceling the order..."
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCancelModal(false)}>Close</Button>
          <Button variant="danger" onClick={cancelOrder}>Cancel Order</Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default OrderDetailsPage
