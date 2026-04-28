import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Col, Form, Row, Table } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'

function OrderManagerPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [packers, setPackers] = useState([])
  const [pickers, setPickers] = useState([])
  const [assignment, setAssignment] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [ordersRes, packersRes, pickersRes] = await Promise.all([
        api.get('/api/sales/orders'),
        api.get('/api/sales/packers'),
        api.get('/api/sales/pickers'),
      ])
      const ordersData = await ordersRes.json().catch(() => [])
      const packersData = await packersRes.json().catch(() => [])
      const pickersData = await pickersRes.json().catch(() => [])
      if (!ordersRes.ok) throw new Error(ordersData?.message || 'Failed to load orders')
      setOrders(Array.isArray(ordersData) ? ordersData : [])
      setPackers(Array.isArray(packersData) ? packersData : [])
      setPickers(Array.isArray(pickersData) ? pickersData : [])
      const next = {}
      ;(Array.isArray(ordersData) ? ordersData : []).forEach((o) => {
        next[o._id] = {
          pickerId: o.assignedPicker?._id || '',
          packerId: o.assignedPacker?._id || '',
          todo: o.warehouseTodo || '',
        }
      })
      setAssignment(next)
    } catch (e) {
      setError(e.message || 'Failed to load warehouse page.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const newOrders = useMemo(
    () => orders.filter((o) => ['new', 'processed', 'add-on'].includes(o.status)),
    [orders],
  )
  const dashboardStats = useMemo(() => {
    const stats = {
      new: 0,
      processed: 0,
      addOn: 0,
      withoutPicker: 0,
      withoutPacker: 0,
      withTodo: 0,
    }
    newOrders.forEach((o) => {
      if (o.status === 'new') stats.new += 1
      if (o.status === 'processed') stats.processed += 1
      if (o.status === 'add-on') stats.addOn += 1
      if (!o.assignedPicker?._id) stats.withoutPicker += 1
      if (!o.assignedPacker?._id) stats.withoutPacker += 1
      if (String(o.warehouseTodo || '').trim()) stats.withTodo += 1
    })
    return stats
  }, [newOrders])

  const updateAssign = (orderId, patch) => {
    setAssignment((prev) => ({ ...prev, [orderId]: { ...(prev[orderId] || {}), ...patch } }))
  }

  const saveTodo = async (orderId) => {
    const todo = assignment[orderId]?.todo || ''
    const res = await api.patch(`/api/sales/orders/${orderId}/workflow`, {
      action: 'set_warehouse_todo',
      todo,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data?.message || 'Failed to save todo.')
      return
    }
    await loadAll()
  }

  const assignPicker = async (orderId) => {
    const pickerId = assignment[orderId]?.pickerId
    if (!pickerId) return
    const res = await api.patch(`/api/sales/orders/${orderId}/workflow`, {
      action: 'assign_picker',
      pickerId,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data?.message || 'Failed to assign picker.')
      return
    }
    await loadAll()
  }

  const assignPacker = async (orderId) => {
    const packerId = assignment[orderId]?.packerId
    if (!packerId) return
    const res = await api.patch(`/api/sales/orders/${orderId}/workflow`, {
      action: 'assign_packer',
      packerId,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data?.message || 'Failed to assign packer.')
      return
    }
    await loadAll()
  }

  return (
    <>
      <h2 className="mb-2">Warehouse Manager</h2>
      <div className="small text-muted mb-3">Track todo, assign picker/packer, and manage new orders.</div>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <Row className="g-2 mb-3">
        <Col md={2}>
          <Card>
            <Card.Body>
              <div className="small text-muted">New Orders</div>
              <div className="fs-4 fw-semibold">{dashboardStats.new}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card>
            <Card.Body>
              <div className="small text-muted">Processed</div>
              <div className="fs-4 fw-semibold">{dashboardStats.processed}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card>
            <Card.Body>
              <div className="small text-muted">Add-On Queue</div>
              <div className="fs-4 fw-semibold">{dashboardStats.addOn}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card>
            <Card.Body>
              <div className="small text-muted">Need Picker</div>
              <div className="fs-4 fw-semibold text-danger">{dashboardStats.withoutPicker}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card>
            <Card.Body>
              <div className="small text-muted">Need Packer</div>
              <div className="fs-4 fw-semibold text-danger">{dashboardStats.withoutPacker}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card>
            <Card.Body>
              <div className="small text-muted">With Todo Note</div>
              <div className="fs-4 fw-semibold text-primary">{dashboardStats.withTodo}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="mb-3">
        <Card.Header>Warehouse Queue Overview</Card.Header>
        <Card.Body className="py-2">
          <Row className="g-2">
            <Col md={4}>
              <div className="border rounded p-2 h-100">
                <div className="small text-muted mb-1">Picking Workload</div>
                <div className="fw-semibold">{newOrders.filter((o) => o.assignedPicker?._id).length} assigned / {dashboardStats.withoutPicker} pending</div>
              </div>
            </Col>
            <Col md={4}>
              <div className="border rounded p-2 h-100">
                <div className="small text-muted mb-1">Packing Workload</div>
                <div className="fw-semibold">{newOrders.filter((o) => o.assignedPacker?._id).length} assigned / {dashboardStats.withoutPacker} pending</div>
              </div>
            </Col>
            <Col md={4}>
              <div className="border rounded p-2 h-100">
                <div className="small text-muted mb-1">Action Needed Now</div>
                <div className="fw-semibold">{dashboardStats.new + dashboardStats.addOn} orders need active handling</div>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Row className="g-2">
        <Col md={4}>
          <Card>
            <Card.Body>
              <div className="small text-muted">New / Processing</div>
              <div className="fs-4 fw-semibold">{newOrders.length}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card>
            <Card.Body>
              <div className="small text-muted">Assigned to Picker</div>
              <div className="fs-4 fw-semibold">{newOrders.filter((o) => o.assignedPicker?._id).length}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card>
            <Card.Body>
              <div className="small text-muted">Assigned to Packer</div>
              <div className="fs-4 fw-semibold">{newOrders.filter((o) => o.assignedPacker?._id).length}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  )
}

export default OrderManagerPage
