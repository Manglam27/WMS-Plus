import { useEffect, useMemo, useState } from 'react'
import { Badge, Card, Table } from 'react-bootstrap'
import { api } from '../../api/api'

const ACTIVE_STATUSES = ['ready-to-ship', 'shipped', 'delivered']

function statusBadge(status) {
  const s = String(status || '')
  if (s === 'ready-to-ship') return { bg: 'warning', text: 'dark' }
  if (s === 'shipped') return { bg: 'info', text: 'dark' }
  if (s === 'delivered') return { bg: 'success' }
  return { bg: 'secondary' }
}

function getAssigneeLabel(order) {
  if (order?.assignedDriver?._id) {
    return order.assignedDriver.name || order.assignedDriver.username || 'Driver'
  }
  const shippingType = String(order?.shippingType || '').toLowerCase()
  if (shippingType.includes('customer pickup')) return 'Customer Pickup'
  if (shippingType.includes('ups')) return 'UPS Driver'
  return order?.salesPerson?.name || order?.salesPerson?.username || 'Sales Person'
}

function AssignDriverPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedAssignee, setSelectedAssignee] = useState('')

  useEffect(() => {
    api.get('/api/sales/orders')
      .then(async (ordersRes) => {
        const ordersData = await ordersRes.json().catch(() => [])
        if (ordersRes.ok) setRows(Array.isArray(ordersData) ? ordersData : [])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const visibleOrders = useMemo(
    () => rows.filter((o) => ACTIVE_STATUSES.includes(String(o?.status || ''))),
    [rows],
  )

  const assignees = useMemo(() => {
    const counts = new Map()
    for (const order of visibleOrders) {
      const label = getAssigneeLabel(order)
      if (!label) continue
      counts.set(label, (counts.get(label) || 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { sensitivity: 'base' }))
      .map(([name, total]) => ({ name, total }))
  }, [visibleOrders])

  useEffect(() => {
    if (!selectedAssignee && assignees.length > 0) {
      setSelectedAssignee(assignees[0].name)
      return
    }
    if (selectedAssignee && !assignees.some((a) => a.name === selectedAssignee)) {
      setSelectedAssignee(assignees[0]?.name || '')
    }
  }, [assignees, selectedAssignee])

  const selectedOrders = useMemo(
    () => visibleOrders.filter((o) => getAssigneeLabel(o) === selectedAssignee),
    [visibleOrders, selectedAssignee],
  )

  return (
    <>
      <h2 className="mb-2">Assign Driver</h2>
      <div className="small text-muted mb-3">Home / Orders / Assign Driver</div>
      <div className="row g-3">
        <div className="col-md-4 col-lg-3">
          <Card>
            <Card.Header>Assigned Names</Card.Header>
            <Card.Body className="p-2">
              {loading ? (
                <div className="text-muted small p-2">Loading names...</div>
              ) : assignees.length === 0 ? (
                <div className="text-muted small p-2">No assigned orders in main statuses.</div>
              ) : (
                <div className="d-grid gap-2">
                  {assignees.map((a) => (
                    <button
                      key={a.name}
                      type="button"
                      className={`btn btn-sm text-start ${selectedAssignee === a.name ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setSelectedAssignee(a.name)}
                    >
                      <span>{a.name}</span>
                      <span className="float-end">{a.total}</span>
                    </button>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-8 col-lg-9">
          <Card>
            <Card.Header>
              Orders for {selectedAssignee || '—'}
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover className="mb-0" size="sm">
                <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
                  <tr>
                    <th>Status</th>
                    <th>Order No</th>
                    <th>Customer</th>
                    <th>Sales Person</th>
                    <th>Shipping Type</th>
                    <th>Delivery Date</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrders.map((o) => {
                    const b = statusBadge(o.status)
                    return (
                      <tr key={o._id}>
                        <td><Badge bg={b.bg} text={b.text}>{o.status}</Badge></td>
                        <td>{o.orderNumber || '—'}</td>
                        <td>{o.customer?.customerName || o.customer?.businessName || '—'}</td>
                        <td>{o.salesPerson?.name || o.salesPerson?.username || '—'}</td>
                        <td>{o.shippingType || '—'}</td>
                        <td>{o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString() : '—'}</td>
                      </tr>
                    )
                  })}
                  {selectedOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        No orders found for this name.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </div>
      </div>
    </>
  )
}

export default AssignDriverPage

