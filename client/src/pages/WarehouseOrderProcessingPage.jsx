import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Form, Modal, Table } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'

function WarehouseOrderProcessingPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [packers, setPackers] = useState([])
  const [assignment, setAssignment] = useState({})
  const [selectedOrderIds, setSelectedOrderIds] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('new')
  const [showBulkAssign, setShowBulkAssign] = useState(false)
  const [bulkPackerId, setBulkPackerId] = useState('')
  const [bulkAssignMinutes, setBulkAssignMinutes] = useState('30')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [ordersRes, packersRes] = await Promise.all([
        api.get('/api/sales/orders'),
        api.get('/api/sales/packers'),
      ])
      const ordersData = await ordersRes.json().catch(() => [])
      const packersData = await packersRes.json().catch(() => [])
      if (!ordersRes.ok) throw new Error(ordersData?.message || 'Failed to load orders')
      setOrders(Array.isArray(ordersData) ? ordersData : [])
      setPackers(Array.isArray(packersData) ? packersData : [])
      const next = {}
      ;(Array.isArray(ordersData) ? ordersData : []).forEach((o) => {
        next[o._id] = {
          packerId: o.assignedPacker?._id || '',
          assignMinutes: String(Math.max(1, Number(o.packerAssignMinutes) || 30)),
        }
      })
      setAssignment(next)
    } catch (e) {
      setError(e.message || 'Failed to load processing queue.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const processingOrders = useMemo(
    () => orders.filter((o) => ['new', 'processed', 'add-on'].includes(o.status)),
    [orders],
  )

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    return processingOrders.filter((o) => {
      const matchesStatus = statusFilter === 'all' ? true : o.status === statusFilter
      const matchesSearch = !q
        ? true
        : [o.orderNumber, o.customer?.customerName, o.customer?.businessName, o.salesPerson?.name, o.salesPerson?.username]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
      return matchesStatus && matchesSearch
    })
  }, [processingOrders, search, statusFilter])

  const selectedOrders = useMemo(
    () => filteredOrders.filter((o) => selectedOrderIds.includes(o._id)),
    [filteredOrders, selectedOrderIds],
  )

  const allVisibleSelected =
    filteredOrders.length > 0 && filteredOrders.every((o) => selectedOrderIds.includes(o._id))

  const assignPacker = async (orderId) => {
    const packerId = assignment[orderId]?.packerId
    const assignMinutes = Math.max(1, Number(assignment[orderId]?.assignMinutes) || 30)
    if (!packerId) return
    const res = await api.patch(`/api/sales/orders/${orderId}/workflow`, {
      action: 'assign_packer',
      packerId,
      assignMinutes,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data?.message || 'Failed to assign packer.')
      return
    }
    await loadAll()
  }

  const toggleSelectAllVisible = () => {
    setSelectedOrderIds((prev) => {
      if (allVisibleSelected) {
        return prev.filter((id) => !filteredOrders.some((o) => o._id === id))
      }
      const merged = new Set([...prev, ...filteredOrders.map((o) => o._id)])
      return Array.from(merged)
    })
  }

  const toggleOrderSelection = (orderId) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId],
    )
  }

  const assignSelectedOrders = async ({ printAfterAssign = false } = {}) => {
    if (!bulkPackerId || selectedOrders.length === 0) return
    const selectedIds = new Set(selectedOrders.map((o) => String(o._id)))
    const assignMinutes = Math.max(1, Number(bulkAssignMinutes) || 30)
    setError('')
    for (const o of selectedOrders) {
      const res = await api.patch(`/api/sales/orders/${o._id}/workflow`, {
        action: 'assign_packer',
        packerId: bulkPackerId,
        assignMinutes,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.message || `Failed to assign order ${o.orderNumber}.`)
        return
      }
    }
    if (printAfterAssign) {
      const res = await api.get('/api/sales/orders')
      const data = await res.json().catch(() => [])
      if (!res.ok) {
        setError('Orders were assigned, but failed to fetch assigned orders for printing.')
      } else {
        const allRows = Array.isArray(data) ? data : []
        const toPrint = allRows.filter(
          (o) =>
            selectedIds.has(String(o._id)) &&
            String(o.assignedPacker?._id || '') === String(bulkPackerId),
        )
        if (toPrint.length === 0) {
          setError('Orders were assigned, but no packer-assigned orders were found for printing.')
        } else {
          printOrders(toPrint)
        }
      }
    }
    setShowBulkAssign(false)
    setBulkPackerId('')
    setBulkAssignMinutes('30')
    setSelectedOrderIds([])
    await loadAll()
  }

  const printOrders = (rows) => {
    const w = window.open('', '_blank', 'width=1100,height=800')
    if (!w) return
    const sections = rows
      .map((o, idx) => {
        const orderNo = String(o.orderNumber || '')
        const lineRows = (Array.isArray(o.lineItems) ? o.lineItems : [])
          .map(
            (l) => `<tr><td>${l.productId || ''}</td><td>${l.productName || ''}</td><td>${l.unitType || ''}</td><td class="text-end">${Number(l.qty || 0)}</td></tr>`,
          )
          .join('')
        return `
          <section class="print-order ${idx < rows.length - 1 ? 'print-break' : ''}">
            <div class="print-header">
              <h3 class="print-title">Order ${orderNo}</h3>
              <svg id="order-barcode-${idx}"></svg>
            </div>
            <div class="print-meta">
              <div><strong>Status:</strong> ${o.status || ''}</div>
              <div><strong>Customer:</strong> ${o.customer?.customerName || o.customer?.businessName || ''}</div>
              <div><strong>Sales Person:</strong> ${o.salesPerson?.name || o.salesPerson?.username || ''}</div>
              <div><strong>Shipping Type:</strong> ${o.shippingType || '-'}</div>
              <div class="print-address"><strong>Shipping Address:</strong><br/>${o.shippingAddress || '-'}</div>
            </div>
            <table class="print-table">
              <thead><tr><th>ID</th><th>Product</th><th>Unit</th><th class="text-end">Ordered Qty</th></tr></thead>
              <tbody>${lineRows}</tbody>
            </table>
          </section>
        `
      })
      .join('')
    w.document.write(`
      <html>
        <head>
          <title>Packer Assigned Orders</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 16px;
              color: #0f172a;
            }
            .print-break { page-break-after: always; }
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
            .text-end { text-align: right; }
          </style>
        </head>
        <body>
          ${sections}
          <script>
            window.__ordersBarcodeReady = false;
            function renderAndPrint() {
              if (window.__ordersBarcodeReady) return;
              if (typeof JsBarcode !== 'function') return;
              window.__ordersBarcodeReady = true;
              ${rows
                .map((o, idx) => {
                  const orderNo = String(o.orderNumber || '')
                  return `
                    try {
                      JsBarcode('#order-barcode-${idx}', ${JSON.stringify(orderNo)}, {
                        format: 'CODE128',
                        width: 2,
                        height: 40,
                        displayValue: true,
                        fontSize: 12,
                        margin: 0,
                      });
                    } catch (e) {}
                  `
                })
                .join('\n')}
              requestAnimationFrame(() => {
                setTimeout(() => {
                  window.focus();
                  window.print();
                }, 120);
              });
            }
            window.addEventListener('load', () => setTimeout(renderAndPrint, 50));
          </script>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js" onload="renderAndPrint()"></script>
        </body>
      </html>
    `)
    w.document.close()
  }

  return (
    <>
      <h2 className="mb-2">Order Processing</h2>
      <div className="small text-muted mb-3">New and processed orders with packer assignment.</div>
      {error && <div className="alert alert-danger py-2">{error}</div>}

      <Card>
        <Card.Header className="bg-white">
          <div className="d-flex flex-wrap gap-2 align-items-end">
            <div>
              <div className="small text-muted mb-1">Search</div>
              <Form.Control
                size="sm"
                style={{ minWidth: 250 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Order no, customer, sales person"
              />
            </div>
            <div>
              <div className="small text-muted mb-1">Status</div>
              <Form.Select size="sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="new">New</option>
                <option value="processed">Processed</option>
                <option value="add-on">Add-On</option>
              </Form.Select>
            </div>
            <div className="ms-auto d-flex align-items-center gap-2">
              <span className="small text-muted">{selectedOrders.length} selected</span>
              <Button
                size="sm"
                variant="warning"
                disabled={selectedOrders.length === 0}
                onClick={() => setShowBulkAssign(true)}
              >
                Assign Order
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          {loading ? (
            <p className="p-3 mb-0">Loading…</p>
          ) : (
            <Table responsive hover className="mb-0" size="sm">
              <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
                <tr>
                  <th style={{ width: 34 }}>
                    <Form.Check checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
                  </th>
                  <th>Status</th>
                  <th>Order No</th>
                  <th>Customer</th>
                  <th>Sales Person</th>
                  <th>Packer</th>
                  <th>Time (min)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr key={o._id}>
                    <td>
                      <Form.Check
                        checked={selectedOrderIds.includes(o._id)}
                        onChange={() => toggleOrderSelection(o._id)}
                      />
                    </td>
                    <td>
                      <Badge bg={o.status === 'processed' ? 'warning' : 'primary'}>
                        {o.status}
                      </Badge>
                    </td>
                    <td>{o.orderNumber}</td>
                    <td>{o.customer?.customerName || o.customer?.businessName || '—'}</td>
                    <td>{o.salesPerson?.name || o.salesPerson?.username || '—'}</td>
                    <td style={{ minWidth: 220 }}>
                      <Form.Select
                        size="sm"
                        value={assignment[o._id]?.packerId || ''}
                        onChange={(e) =>
                          setAssignment((prev) => ({
                            ...prev,
                            [o._id]: { ...(prev[o._id] || {}), packerId: e.target.value },
                          }))
                        }
                      >
                        <option value="">Select packer</option>
                        {packers.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name || p.username}
                          </option>
                        ))}
                      </Form.Select>
                    </td>
                    <td style={{ width: 120 }}>
                      <Form.Control
                        size="sm"
                        type="number"
                        min={1}
                        value={assignment[o._id]?.assignMinutes || '30'}
                        onChange={(e) =>
                          setAssignment((prev) => ({
                            ...prev,
                            [o._id]: { ...(prev[o._id] || {}), assignMinutes: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <div className="d-flex gap-2">
                        <Button size="sm" variant="outline-warning" onClick={() => assignPacker(o._id)}>
                          Assign
                        </Button>
                        <Button size="sm" variant="outline-dark" onClick={() => navigate(`/warehouse/orders/${o._id}`)}>
                          Open
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-3">
                      No orders found for current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Modal show={showBulkAssign} onHide={() => setShowBulkAssign(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Assign Selected Orders</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="small text-muted mb-2">
            Select one packer for {selectedOrders.length} selected order(s).
          </div>
          <Form.Group className="mb-3">
            <Form.Label>Assign Time (minutes)</Form.Label>
            <Form.Control
              type="number"
              min={1}
              value={bulkAssignMinutes}
              onChange={(e) => setBulkAssignMinutes(e.target.value)}
            />
            <div className="small text-muted">Default is 30 minutes.</div>
          </Form.Group>
          {packers.map((p) => (
            <Form.Check
              key={p._id}
              type="radio"
              name="bulk-packer"
              id={`bulk-packer-${p._id}`}
              label={p.name || p.username}
              checked={bulkPackerId === p._id}
              onChange={() => setBulkPackerId(p._id)}
              className="mb-2"
            />
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBulkAssign(false)}>
            Cancel
          </Button>
          <Button variant="warning" onClick={() => assignSelectedOrders({ printAfterAssign: false })} disabled={!bulkPackerId}>
            Assign
          </Button>
          <Button variant="dark" onClick={() => assignSelectedOrders({ printAfterAssign: true })} disabled={!bulkPackerId}>
            Assign & Print
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}

export default WarehouseOrderProcessingPage
