import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'

const PACKER_VISIBLE_STATUSES = new Set(['processed', 'packed', 'add-on', 'add-on-packed'])

function ScannerPackerPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [salesPeople, setSalesPeople] = useState([])
  const [customers, setCustomers] = useState([])
  const [showLogModal, setShowLogModal] = useState(false)
  const [logRows, setLogRows] = useState([])
  const [logOrderMeta, setLogOrderMeta] = useState({ orderNumber: '', orderDate: '' })
  const [filtersDraft, setFiltersDraft] = useState({
    salesPerson: 'all',
    customer: 'all',
    orderNo: '',
    status: 'processed',
    fromOrderDate: '',
    toOrderDate: '',
    shippingTypes: ['all'],
  })
  const [filtersApplied, setFiltersApplied] = useState({
    salesPerson: 'all',
    customer: 'all',
    orderNo: '',
    status: 'processed',
    fromOrderDate: '',
    toOrderDate: '',
    shippingTypes: ['all'],
  })
  const [pageSize, setPageSize] = useState('10')
  const [todoOpenCount, setTodoOpenCount] = useState(0)

  const loadOrders = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/api/sales/orders')
      const data = await res.json().catch(() => [])
      if (!res.ok) throw new Error(data?.message || 'Failed to load assigned orders.')
      const rows = Array.isArray(data) ? data : []
      setOrders(rows)
      const nextSales = new Map()
      const nextCustomers = new Map()
      rows.forEach((o) => {
        if (o.salesPerson?._id) nextSales.set(o.salesPerson._id, o.salesPerson)
        if (o.customer?._id) nextCustomers.set(o.customer._id, o.customer)
      })
      setSalesPeople(Array.from(nextSales.values()))
      setCustomers(Array.from(nextCustomers.values()))
    } catch (e) {
      setError(e.message || 'Failed to load assigned orders.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  useEffect(() => {
    api
      .get('/api/sales/warehouse/tasks')
      .then(async (res) => {
        const data = await res.json().catch(() => [])
        if (!res.ok || !Array.isArray(data)) {
          setTodoOpenCount(0)
          return
        }
        const pending = data.filter((t) => ['todo', 'in_progress'].includes(String(t?.status || ''))).length
        setTodoOpenCount(pending)
      })
      .catch(() => setTodoOpenCount(0))
  }, [])

  const counts = useMemo(() => {
    const out = {
      all: 0,
      new: 0,
      processed: 0,
      'add-on': 0,
      packed: 0,
      'add-on-packed': 0,
      'ready-to-ship': 0,
    }
    orders.forEach((o) => {
      const s = String(o.status || '')
      if (PACKER_VISIBLE_STATUSES.has(s)) out.all += 1
      if (Object.prototype.hasOwnProperty.call(out, s)) out[s] += 1
    })
    return out
  }, [orders])

  const shippingTypeOptions = useMemo(() => {
    const set = new Set()
    orders.forEach((o) => {
      if (o.shippingType) set.add(o.shippingType)
    })
    return ['all', ...Array.from(set).sort((a, b) => String(a).localeCompare(String(b)))]
  }, [orders])

  const filteredOrders = useMemo(() => {
    const f = filtersApplied
    const orderNoNeedle = String(f.orderNo || '').trim().toLowerCase()
    const selectedShipping = Array.isArray(f.shippingTypes) ? f.shippingTypes.filter((x) => x !== 'all') : []
    const rows = orders.filter((o) => {
      if (!PACKER_VISIBLE_STATUSES.has(String(o.status || ''))) return false
      if (f.salesPerson !== 'all' && String(o.salesPerson?._id || '') !== String(f.salesPerson)) return false
      if (f.customer !== 'all' && String(o.customer?._id || '') !== String(f.customer)) return false
      if (f.status !== 'all' && String(o.status || '') !== String(f.status)) return false
      if (selectedShipping.length > 0 && !selectedShipping.includes(String(o.shippingType || ''))) return false
      if (orderNoNeedle && !String(o.orderNumber || '').toLowerCase().includes(orderNoNeedle)) return false
      const orderDateMs = o.orderDate ? new Date(o.orderDate).getTime() : null
      if (f.fromOrderDate && orderDateMs != null && orderDateMs < new Date(f.fromOrderDate).getTime()) return false
      if (f.toOrderDate && orderDateMs != null && orderDateMs > new Date(f.toOrderDate).getTime() + 86400000 - 1) return false
      return true
    })
    rows.sort((a, b) => {
      const aNo = Number(String(a.orderNumber || '').replace(/\D/g, '')) || 0
      const bNo = Number(String(b.orderNumber || '').replace(/\D/g, '')) || 0
      return aNo - bNo
    })
    return rows
  }, [orders, filtersApplied])

  const visibleOrders = useMemo(() => {
    if (pageSize === 'all') return filteredOrders
    const n = Math.max(1, Number(pageSize) || 10)
    return filteredOrders.slice(0, n)
  }, [filteredOrders, pageSize])

  const getShippingRowClass = (shippingType) => {
    const raw = String(shippingType || '').toLowerCase()
    if (raw.includes('ups')) return 'order-row--shipping-ups'
    if (raw.includes('sales pickup')) return 'order-row--shipping-sales-pickup'
    if (raw.includes('customer pickup')) return 'order-row--shipping-customer-pickup'
    return ''
  }

  const showHistory = (order) => {
    const rows = (Array.isArray(order.logs) ? order.logs : [])
      .map((l, i) => ({
        key: `${order._id}-${i}`,
        by: l.byUserName || 'User',
        action: l.action || '-',
        at: l.at ? new Date(l.at).toLocaleString() : '-',
      }))
      .reverse()
    setLogRows(rows)
    setLogOrderMeta({
      orderNumber: String(order.orderNumber || ''),
      orderDate: order.orderDate ? new Date(order.orderDate).toLocaleDateString() : '',
    })
    setShowLogModal(true)
  }

  const printOrder = (order) => {
    const w = window.open('', '_blank', 'width=950,height=800')
    if (!w) return
    const orderNo = String(order.orderNumber || '')
    w.document.write(`
      <html>
        <head>
          <title>${orderNo || 'Order'}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 18px;
              color: #0f172a;
            }
            .print-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 16px;
              margin-bottom: 10px;
            }
            .print-title {
              margin: 0;
              font-size: 24px;
              font-weight: 800;
            }
            .print-meta {
              margin: 10px 0 14px;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 10px 12px;
              background: #f8fafc;
              line-height: 1.45;
              font-size: 14px;
            }
            .print-meta strong {
              color: #1e293b;
            }
            .print-address {
              margin-top: 8px;
              border-top: 1px dashed #94a3b8;
              padding-top: 8px;
              white-space: pre-wrap;
              word-break: break-word;
            }
            .print-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 13px;
            }
            .print-table th {
              background: #1e293b;
              color: #fff;
              padding: 8px;
              border: 1px solid #334155;
              text-align: left;
            }
            .print-table td {
              border: 1px solid #cbd5e1;
              padding: 7px 8px;
              vertical-align: top;
            }
            .text-end {
              text-align: right;
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h3 class="print-title">Order ${orderNo}</h3>
            <svg id="order-barcode"></svg>
          </div>
          <div class="print-meta">
            <div><strong>Status:</strong> ${order.status || ''}</div>
            <div><strong>Customer:</strong> ${order.customer?.customerName || order.customer?.businessName || ''}</div>
            <div><strong>Sales Person:</strong> ${order.salesPerson?.name || order.salesPerson?.username || ''}</div>
            <div><strong>Shipping Type:</strong> ${order.shippingType || '-'}</div>
            <div class="print-address"><strong>Shipping Address:</strong><br/>${order.shippingAddress || '-'}</div>
          </div>
          <table class="print-table">
            <thead><tr><th>ID</th><th>Product</th><th>Unit</th><th class="text-end">Ordered Qty</th></tr></thead>
            <tbody>
              ${(order.lineItems || []).map((l) => `<tr><td>${l.productId || ''}</td><td>${l.productName || ''}</td><td>${l.unitType || ''}</td><td class="text-end">${Number(l.qty || 0)}</td></tr>`).join('')}
            </tbody>
          </table>
          <script>
            window.__orderBarcodeReady = false;
            function renderAndPrintOrder() {
              if (window.__orderBarcodeReady) return;
              if (typeof JsBarcode !== 'function') return;
              window.__orderBarcodeReady = true;
              try {
                JsBarcode('#order-barcode', ${JSON.stringify(orderNo)}, {
                  format: 'CODE128',
                  width: 2,
                  height: 40,
                  displayValue: true,
                  margin: 0,
                });
              } catch (e) {}
              requestAnimationFrame(() => {
                setTimeout(() => {
                  window.focus();
                  window.print();
                }, 120);
              });
            }
            window.addEventListener('load', () => setTimeout(renderAndPrintOrder, 50));
          </script>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js" onload="renderAndPrintOrder()"></script>
        </body>
      </html>
    `)
    w.document.close()
  }

  const applyFilters = () => setFiltersApplied({ ...filtersDraft })

  const toggleShippingType = (value) => {
    setFiltersDraft((prev) => {
      const current = Array.isArray(prev.shippingTypes) ? prev.shippingTypes : ['all']
      if (value === 'all') return { ...prev, shippingTypes: ['all'] }
      const withoutAll = current.filter((x) => x !== 'all')
      const exists = withoutAll.includes(value)
      const next = exists ? withoutAll.filter((x) => x !== value) : [...withoutAll, value]
      return { ...prev, shippingTypes: next.length > 0 ? next : ['all'] }
    })
  }

  const todoBtnStyle = useMemo(() => {
    if (todoOpenCount === 0) {
      return { backgroundColor: '#ffffff', borderColor: '#dee2e6', color: '#1E1E2C' }
    }
    if (todoOpenCount > 5) {
      return { backgroundColor: '#dc2626', borderColor: '#dc2626', color: '#ffffff' }
    }
    return { backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#ffffff' }
  }, [todoOpenCount])

  return (
    <>
      <h2 className="mb-3">Packer Dashboard</h2>
      {error && <div className="alert alert-danger py-2">{error}</div>}

      <Card className="mb-3 packer-top-strip">
        <Card.Body className="d-flex flex-wrap gap-3 align-items-center">
          <Button size="sm" variant="light" className="packer-top-link-btn" onClick={() => navigate('/')}>
            All Orders
          </Button>
          <Button size="sm" className="packer-top-link-btn" style={todoBtnStyle} onClick={() => navigate('/packer/todo')}>
            TO-DO ({todoOpenCount})
          </Button>
          <div className="packer-top-stat"><span>Total Orders</span><strong>{counts.all}</strong></div>
          <div className="packer-top-stat"><span>Add-On</span><strong>{counts['add-on']}</strong></div>
          <div className="packer-top-stat"><span>Add-On-Packed</span><strong>{counts['add-on-packed']}</strong></div>
          <div className="packer-top-stat"><span>Packed</span><strong>{counts.packed}</strong></div>
          <div className="packer-top-stat"><span>Processed</span><strong>{counts.processed}</strong></div>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Body>
          <Row className="g-2">
            <Col md={3}>
              <Form.Select
                value={filtersDraft.salesPerson}
                onChange={(e) => setFiltersDraft((p) => ({ ...p, salesPerson: e.target.value }))}
              >
                <option value="all">All Sales Person</option>
                {salesPeople.map((sp) => (
                  <option key={sp._id} value={sp._id}>{sp.name || sp.username}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select
                value={filtersDraft.customer}
                onChange={(e) => setFiltersDraft((p) => ({ ...p, customer: e.target.value }))}
              >
                <option value="all">All Customer</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>{c.customerNumber ? `${c.customerNumber} - ` : ''}{c.customerName || c.businessName}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Control
                value={filtersDraft.orderNo}
                onChange={(e) => setFiltersDraft((p) => ({ ...p, orderNo: e.target.value }))}
                placeholder="Order No"
              />
            </Col>
            <Col md={3}>
              <Form.Select
                value={filtersDraft.status}
                onChange={(e) => setFiltersDraft((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="all">All Status</option>
                <option value="add-on">Add-On</option>
                <option value="add-on-packed">Add-On-Packed</option>
                <option value="packed">Packed</option>
                <option value="processed">Processed</option>
                <option value="new">New</option>
              </Form.Select>
            </Col>
            <Col md={3}><Form.Control type="date" value={filtersDraft.fromOrderDate} onChange={(e) => setFiltersDraft((p) => ({ ...p, fromOrderDate: e.target.value }))} /></Col>
            <Col md={3}><Form.Control type="date" value={filtersDraft.toOrderDate} onChange={(e) => setFiltersDraft((p) => ({ ...p, toOrderDate: e.target.value }))} /></Col>
            <Col md={4}>
              <div className="border rounded p-2 small">
                {shippingTypeOptions.map((s) => (
                  <Form.Check
                    key={s}
                    inline
                    type="checkbox"
                    label={s === 'all' ? 'All Shipping Type' : s}
                    checked={(filtersDraft.shippingTypes || []).includes(s)}
                    onChange={() => toggleShippingType(s)}
                  />
                ))}
              </div>
            </Col>
            <Col md={2} className="d-flex align-items-end">
              <Button onClick={applyFilters}>Search</Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>Assigned Orders</Card.Header>
        <Card.Body className="p-0">
          {loading ? (
            <p className="p-3 mb-0">Loading...</p>
          ) : (
            <Table responsive hover className="mb-0" size="sm">
              <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
                <tr>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Order No</th>
                  <th>Order Date</th>
                  <th>Customer</th>
                  <th>Sales Person</th>
                  <th>Picker</th>
                  <th>Products</th>
                  <th>Shipping Type</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((o) => (
                  <tr key={o._id} className={getShippingRowClass(o.shippingType)}>
                    <td>
                      <div className="packer-action-btns">
                        <Button size="sm" className="packer-action-btn packer-action-btn--view" title="View" onClick={() => navigate(`/packer/orders/${o._id}`)}>View</Button>
                        <Button size="sm" className="packer-action-btn packer-action-btn--log" title="History" onClick={() => showHistory(o)}>History</Button>
                        <Button size="sm" className="packer-action-btn packer-action-btn--print" title="Print" onClick={() => printOrder(o)}>Print</Button>
                      </div>
                    </td>
                    <td><Badge bg="secondary">{o.status}</Badge></td>
                    <td>{o.orderNumber}</td>
                    <td>{o.orderDate ? new Date(o.orderDate).toLocaleDateString() : '-'}</td>
                    <td>{o.customer?.customerName || o.customer?.businessName || '—'}</td>
                    <td>{o.salesPerson?.name || o.salesPerson?.username || '—'}</td>
                    <td>{o.assignedPicker?.name || o.assignedPicker?.username || '-'}</td>
                    <td className="text-center">{Array.isArray(o.lineItems) ? o.lineItems.length : 0}</td>
                    <td>{o.shippingType || '-'}</td>
                  </tr>
                ))}
                {visibleOrders.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-muted py-3">No assigned orders.</td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </Card.Body>
        <Card.Footer className="d-flex justify-content-between align-items-center">
          <div className="small text-muted">
            Showing {visibleOrders.length} of {filteredOrders.length}
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="small text-muted">Load more</span>
            <Form.Select
              size="sm"
              style={{ width: 110 }}
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value)}
            >
              <option value="10">10</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="all">All</option>
            </Form.Select>
          </div>
        </Card.Footer>
      </Card>

      <Modal show={showLogModal} onHide={() => setShowLogModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Order Log</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="small mb-2">
            <strong>Order No:</strong> {logOrderMeta.orderNumber} &nbsp; <strong>Order Date:</strong> {logOrderMeta.orderDate}
          </div>
          <Table bordered size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Action By</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {logRows.map((r) => (
                <tr key={r.key}>
                  <td>{r.by}</td>
                  <td>{r.at}</td>
                  <td>{r.action}</td>
                </tr>
              ))}
              {logRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-muted">No log entries.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowLogModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}

export default ScannerPackerPage
