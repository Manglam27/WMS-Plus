import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Card, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/api'
import { useAuth } from '../../context/AuthContext'

const STATUS_OPTIONS = [
  'add-on',
  'add-on-packed',
  'cancelled',
  'close',
  'delivered',
  'new',
  'packed',
  'processed',
  'ready-to-ship',
  'shipped',
  'undelivered',
]

const SHIPPING_TYPE_OPTIONS = [
  'Customer Pickup',
  'Ground Shipping',
  'Sales Pickup',
  'Sales Quote - Customer Pickup',
  'Sales Quote - Ground Shipping',
  'Sales Quote - Sales Pickup',
  'Sales Quote - UPS COD/Check',
  'Sales Quote - UPS Regular',
  'UPS COD Cashier check/MO',
  'UPS COD Check',
  'UPS Regular',
]

function toLabel(value) {
  return String(value || '')
    .split(/[\s_-]+/)
    .map((x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x))
    .join(' ')
}

function ChipMultiSelect({
  label,
  options,
  selectedValues,
  onChange,
  allValue = 'all',
  allLabel = 'All',
  bubbleClassName = '',
  allExclusive = false,
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const selectedSet = new Set(selectedValues || [])

  useEffect(() => {
    const onDocClick = (e) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const toggleValue = (value) => {
    const current = new Set(selectedValues || [allValue])
    if (value === allValue) {
      onChange([allValue])
      return
    }
    if (allExclusive) {
      current.delete(allValue)
      if (current.has(value)) current.delete(value)
      else current.add(value)
      const next = Array.from(current).filter((v) => v !== allValue)
      onChange(next.length ? next : [allValue])
      return
    }
    current.add(allValue)
    if (current.has(value)) current.delete(value)
    else current.add(value)
    const next = Array.from(current)
    if (!next.includes(allValue)) next.unshift(allValue)
    onChange(next.length ? [...new Set(next)] : [allValue])
  }

  const removeChip = (value) => {
    if (value === allValue) return
    const current = new Set(selectedValues || [])
    current.delete(value)
    const next = Array.from(current).filter((v) => v !== allValue)
    if (allExclusive) {
      onChange(next.length ? next : [allValue])
      return
    }
    if (!next.includes(allValue)) next.unshift(allValue)
    onChange(next.length ? [...new Set(next)] : [allValue])
  }

  const displayValues = (selectedValues || []).map((v) => (v === allValue ? allLabel : toLabel(v)))

  return (
    <div className="chip-multi-select" ref={rootRef}>
      <Form.Label className="small mb-1">{label}</Form.Label>
      <button type="button" className="chip-multi-select-control" onClick={() => setOpen((s) => !s)}>
        <div className="chip-multi-select-bubbles">
          {displayValues.map((txt, idx) => {
            const raw = (selectedValues || [])[idx]
            return (
              <span key={`${raw}-${idx}`} className={`chip-multi-select-bubble ${bubbleClassName}`}>
                {txt}
                <span
                  className="chip-multi-select-bubble-x"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeChip(raw)
                  }}
                >
                  ×
                </span>
              </span>
            )
          })}
        </div>
        <span className="chip-multi-select-caret">▾</span>
      </button>
      {open && (
        <div className="chip-multi-select-menu">
          <label className="chip-multi-select-item">
            <input
              type="checkbox"
              checked={selectedSet.has(allValue)}
              onChange={() => toggleValue(allValue)}
            />
            <span>{allLabel}</span>
          </label>
          {options.map((opt) => (
            <label key={opt} className="chip-multi-select-item">
              <input
                type="checkbox"
                checked={selectedSet.has(opt)}
                onChange={() => toggleValue(opt)}
              />
              <span>{toLabel(opt)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function OrdersListPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isSalesManager = user?.role === 'sales_manager'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageSize, setPageSize] = useState('10')
  const [currentPage, setCurrentPage] = useState(1)
  const [salesPeople, setSalesPeople] = useState([])
  const defaultStatuses = isSalesManager ? ['packed', 'add-on-packed'] : ['all']
  const initialFilters = {
    customer: '',
    orderNo: '',
    statuses: defaultStatuses,
    shippingTypes: ['all'],
    salesPeople: ['all'],
    driver: '',
    orderType: '',
    orderFromDate: '',
    orderToDate: '',
    deliveryFromDate: '',
    deliveryToDate: '',
    cancelFromDate: '',
    cancelToDate: '',
  }
  const [filtersDraft, setFiltersDraft] = useState(initialFilters)
  const [filtersApplied, setFiltersApplied] = useState(initialFilters)
  const [selectedOrderIds, setSelectedOrderIds] = useState([])
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [activeOrder, setActiveOrder] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [assignChoice, setAssignChoice] = useState('')
  const [printTemplate, setPrintTemplate] = useState('standard')
  const [actionMessage, setActionMessage] = useState('')

  useEffect(() => {
    api
      .get('/api/sales/orders')
      .then(async (res) => {
        const data = await res.json().catch(() => [])
        if (res.ok) setRows(Array.isArray(data) ? data : [])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!isSalesManager) return
    api
      .get('/api/sales/salespeople')
      .then(async (res) => {
        const data = await res.json().catch(() => [])
        if (!res.ok) return
        setSalesPeople(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
  }, [isSalesManager])

  useEffect(() => {
    if (!isSalesManager) return
    api
      .get('/api/sales/drivers')
      .then(async (res) => {
        const data = await res.json().catch(() => [])
        if (!res.ok) return
        setDrivers(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
  }, [isSalesManager])

  const badge = (s) => {
    if (s === 'draft') return { bg: 'warning', text: 'dark' }
    if (s === 'new') return { bg: 'primary' }
    if (s === 'packed' || s === 'add-on-packed') return { bg: 'success' }
    if (s === 'add-on' || s === 'ready-to-ship' || s === 'shipped') return { bg: 'info' }
    if (s === 'cancelled' || s === 'undelivered') return { bg: 'danger' }
    if (s === 'delivered' || s === 'close') return { bg: 'dark' }
    return { bg: 'secondary' }
  }

  const options = useMemo(() => {
    const uniq = (arr) => [...new Set(arr.filter(Boolean).map((x) => String(x).trim()))]
    return {
      customers: uniq(rows.map((o) => o.customer?.customerName || o.customer?.businessName)),
      salesPeople: uniq(rows.map((o) => o.salesPerson?.name || o.salesPerson?.username)),
      statuses: uniq(rows.map((o) => o.status)),
      shippingTypes: uniq(rows.map((o) => o.shippingType)),
      customerTypes: uniq(rows.map((o) => o.customer?.customerType)),
      shippingStates: uniq(
        rows.map((o) => o.customer?.shippingAddress?.state || o.customer?.billingAddress?.state),
      ),
      orderTypes: uniq(rows.map((o) => o.orderType)),
    }
  }, [rows])

  const filteredRows = useMemo(() => {
    const isInDateRange = (dateValue, from, to) => {
      if (!from && !to) return true
      if (!dateValue) return false
      const d = new Date(dateValue)
      if (Number.isNaN(d.getTime())) return false
      if (from) {
        const start = new Date(from)
        if (!Number.isNaN(start.getTime()) && d < start) return false
      }
      if (to) {
        const end = new Date(to)
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999)
          if (d > end) return false
        }
      }
      return true
    }

    return rows.filter((o) => {
      const customerName = o.customer?.customerName || o.customer?.businessName || ''
      const salesPersonName = o.salesPerson?.name || o.salesPerson?.username || ''
      const orderNo = o.orderNumber || ''
      const status = o.status || ''
      const shippingType = o.shippingType || ''

      if (filtersApplied.customer && customerName !== filtersApplied.customer) return false
      if (filtersApplied.orderNo && !orderNo.toLowerCase().includes(filtersApplied.orderNo.toLowerCase())) return false
      const selectedStatuses = Array.isArray(filtersApplied.statuses) ? filtersApplied.statuses : []
      const statusHasAll = selectedStatuses.includes('all')
      const statusConstraints = selectedStatuses.filter((x) => x !== 'all')
      if (!statusHasAll && statusConstraints.length > 0 && !statusConstraints.includes(status)) return false
      const selectedShippingTypes = Array.isArray(filtersApplied.shippingTypes) ? filtersApplied.shippingTypes : []
      const shippingHasAll = selectedShippingTypes.includes('all')
      const shippingTypeConstraints = selectedShippingTypes.filter((x) => x !== 'all')
      if (!shippingHasAll && shippingTypeConstraints.length > 0 && !shippingTypeConstraints.includes(shippingType)) return false
      const selectedSalesPeople = Array.isArray(filtersApplied.salesPeople) ? filtersApplied.salesPeople : []
      const salesPeopleHasAll = selectedSalesPeople.includes('all')
      const salesPersonConstraints = selectedSalesPeople.filter((x) => x !== 'all')
      if (!salesPeopleHasAll && salesPersonConstraints.length > 0 && !salesPersonConstraints.includes(salesPersonName)) return false
      if (filtersApplied.orderType && (o.orderType || '') !== filtersApplied.orderType) return false
      if (!isInDateRange(o.orderDate || o.createdAt, filtersApplied.orderFromDate, filtersApplied.orderToDate)) return false
      if (!isInDateRange(o.deliveryDate, filtersApplied.deliveryFromDate, filtersApplied.deliveryToDate)) return false

      return true
    }).sort((a, b) => {
      const ao = String(a.orderNumber || '')
      const bo = String(b.orderNumber || '')
      const an = Number((ao.match(/\d+/g) || []).join('')) || 0
      const bn = Number((bo.match(/\d+/g) || []).join('')) || 0
      if (bn !== an) return bn - an
      return bo.localeCompare(ao)
    })
  }, [rows, filtersApplied])

  const pagedRows = useMemo(() => {
    if (pageSize === 'all') return filteredRows
    const size = Number(pageSize) || 10
    const start = (currentPage - 1) * size
    return filteredRows.slice(start, start + size)
  }, [filteredRows, pageSize, currentPage])

  const totalPages = useMemo(() => {
    if (pageSize === 'all') return 1
    const size = Number(pageSize) || 10
    return Math.max(1, Math.ceil(filteredRows.length / size))
  }, [filteredRows.length, pageSize])

  const isViewOnlyStatus = (status) => ['shipped', 'delivered', 'undelivered', 'close', 'cancelled'].includes(String(status || ''))

  const getShippingRowClass = (shippingType) => {
    const raw = String(shippingType || '').toLowerCase()
    if (raw.includes('ups')) return 'order-row--shipping-ups'
    if (raw.includes('sales pickup')) return 'order-row--shipping-sales-pickup'
    if (raw.includes('customer pickup')) return 'order-row--shipping-customer-pickup'
    return ''
  }

  useEffect(() => {
    setSelectedOrderIds((prev) => prev.filter((id) => pagedRows.some((row) => row._id === id)))
  }, [pagedRows])

  const allPagedSelected = pagedRows.length > 0 && pagedRows.every((row) => selectedOrderIds.includes(row._id))

  const toggleSelectAllPaged = () => {
    if (allPagedSelected) {
      setSelectedOrderIds((prev) => prev.filter((id) => !pagedRows.some((row) => row._id === id)))
    } else {
      const ids = pagedRows.map((row) => row._id)
      setSelectedOrderIds((prev) => [...new Set([...prev, ...ids])])
    }
  }

  const toggleOrderSelected = (orderId) => {
    setSelectedOrderIds((prev) => {
      if (prev.includes(orderId)) return prev.filter((id) => id !== orderId)
      return [...prev, orderId]
    })
  }

  const openHistory = (order) => {
    setActiveOrder(order)
    setShowHistoryModal(true)
  }

  const openPrint = (order) => {
    setActiveOrder(order)
    setPrintTemplate('standard')
    setShowPrintModal(true)
  }

  const openAssignDriver = (order) => {
    setActiveOrder(order)
    setAssignChoice(order.assignedDriver?._id || '')
    setShowAssignModal(true)
  }

  const performAssignDriver = async () => {
    if (!activeOrder) return
    setActionMessage('')
    if (assignChoice === 'customer_pickup') {
      const res = await api.put(`/api/sales/orders/${activeOrder._id}`, {
        shippingType: 'Customer Pickup',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setActionMessage(data.message || 'Failed to set Customer Pickup.')
        return
      }
      setRows((prev) => prev.map((row) => (row._id === data._id ? data : row)))
      setShowAssignModal(false)
      return
    }
    if (!assignChoice) {
      setActionMessage('Select a driver or Customer Pickup.')
      return
    }
    const res = await api.patch(`/api/sales/orders/${activeOrder._id}/workflow`, {
      action: 'assign_driver',
      driverId: assignChoice,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setActionMessage(data.message || 'Failed to assign driver.')
      return
    }
    setRows((prev) => prev.map((row) => (row._id === data._id ? data : row)))
    setShowAssignModal(false)
  }

  const historyRows = useMemo(() => {
    if (!activeOrder) return []
    const rawLogs = Array.isArray(activeOrder.logs) ? activeOrder.logs : []
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
      { title: 'Order created', when: activeOrder.createdAt },
      { title: 'Packed', when: activeOrder.packedAt },
      { title: 'Shipped', when: activeOrder.shippedAt },
      { title: 'Delivered / Undelivered', when: activeOrder.deliveredAt },
      { title: 'Cancelled', when: activeOrder.cancelledAt },
      { title: 'Closed', when: activeOrder.closedAt },
    ]
    return events
      .filter((e) => e.when)
      .map((e, i) => ({ id: `${e.title}-${i}`, action: e.title, by: 'System', atLabel: new Date(e.when).toLocaleString() }))
  }, [activeOrder])

  return (
    <div className="sales-tablet-page sales-orders-list-page">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="mb-0">{isSalesManager ? 'All Orders' : 'Order list'}</h2>
        {!isSalesManager && (
          <Link to="/sales/orders/new" className="btn btn-sm" style={{ backgroundColor: '#F29F67', borderColor: '#F29F67', color: '#1E1E2C' }}>
            New order
          </Link>
        )}
      </div>
      {isSalesManager && <div className="small text-muted mb-3">Home / Orders / Order List</div>}

      {isSalesManager && (
        <Card className="mb-3">
          <Card.Body className="py-2">
            <Row className="g-2 sales-orders-filters">
              <Col md={2}>
                <Form.Label className="small mb-1">All Customer</Form.Label>
                <Form.Select size="sm" value={filtersDraft.customer} onChange={(e) => setFiltersDraft((s) => ({ ...s, customer: e.target.value }))}>
                  <option value="">All Customer</option>
                  {options.customers.map((v) => <option key={v} value={v}>{v}</option>)}
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">From Order Date</Form.Label>
                <Form.Control
                  size="sm"
                  type="date"
                  value={filtersDraft.orderFromDate}
                  onChange={(e) => setFiltersDraft((s) => ({ ...s, orderFromDate: e.target.value }))}
                  placeholder="Order From Date"
                />
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">To Order Date</Form.Label>
                <Form.Control
                  size="sm"
                  type="date"
                  value={filtersDraft.orderToDate}
                  onChange={(e) => setFiltersDraft((s) => ({ ...s, orderToDate: e.target.value }))}
                  placeholder="Order To Date"
                />
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">Order No</Form.Label>
                <Form.Control size="sm" value={filtersDraft.orderNo} onChange={(e) => setFiltersDraft((s) => ({ ...s, orderNo: e.target.value }))} placeholder="Order No" />
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">From Delivery Date</Form.Label>
                <Form.Control
                  size="sm"
                  type="date"
                  value={filtersDraft.deliveryFromDate}
                  onChange={(e) => setFiltersDraft((s) => ({ ...s, deliveryFromDate: e.target.value }))}
                  placeholder="Delivery From Date"
                />
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">To Delivery Date</Form.Label>
                <Form.Control
                  size="sm"
                  type="date"
                  value={filtersDraft.deliveryToDate}
                  onChange={(e) => setFiltersDraft((s) => ({ ...s, deliveryToDate: e.target.value }))}
                  placeholder="Delivery To Date"
                />
              </Col>

              <Col md={2}>
                <ChipMultiSelect
                  label="All Sales Person"
                  options={salesPeople.map((sp) => sp?.name || sp?.username || '').filter(Boolean)}
                  selectedValues={filtersDraft.salesPeople}
                  onChange={(vals) => setFiltersDraft((s) => ({ ...s, salesPeople: vals }))}
                  allLabel="All Sales Person"
                  bubbleClassName="chip-multi-select-bubble--sales"
                />
              </Col>
              <Col md={2}>
                <ChipMultiSelect
                  label="All Status"
                  options={STATUS_OPTIONS}
                  selectedValues={filtersDraft.statuses}
                  onChange={(vals) => setFiltersDraft((s) => ({ ...s, statuses: vals }))}
                  allLabel="All Status"
                  bubbleClassName="chip-multi-select-bubble--status"
                  allExclusive
                />
              </Col>
              <Col md={2}>
                <ChipMultiSelect
                  label="All Shipping Type"
                  options={SHIPPING_TYPE_OPTIONS}
                  selectedValues={filtersDraft.shippingTypes}
                  onChange={(vals) => setFiltersDraft((s) => ({ ...s, shippingTypes: vals }))}
                  allLabel="All Shipping Type"
                  bubbleClassName="chip-multi-select-bubble--sales"
                />
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">All Driver</Form.Label>
                <Form.Select size="sm" value={filtersDraft.driver} onChange={(e) => setFiltersDraft((s) => ({ ...s, driver: e.target.value }))}>
                  <option value="">All Driver</option>
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">All Order Type</Form.Label>
                <Form.Select size="sm" value={filtersDraft.orderType} onChange={(e) => setFiltersDraft((s) => ({ ...s, orderType: e.target.value }))}>
                  <option value="">All Order Type</option>
                  {options.orderTypes.map((v) => <option key={v} value={v}>{v}</option>)}
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">From Cancel Date</Form.Label>
                <Form.Control size="sm" type="date" value={filtersDraft.cancelFromDate} onChange={(e) => setFiltersDraft((s) => ({ ...s, cancelFromDate: e.target.value }))} />
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">To Cancel Date</Form.Label>
                <Form.Control size="sm" type="date" value={filtersDraft.cancelToDate} onChange={(e) => setFiltersDraft((s) => ({ ...s, cancelToDate: e.target.value }))} />
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">&nbsp;</Form.Label>
                <button
                  type="button"
                  className="btn btn-sm btn-primary w-100"
                  onClick={() => {
                    setFiltersApplied({ ...filtersDraft })
                    setCurrentPage(1)
                  }}
                >
                  Search
                </button>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}
      {!isSalesManager && (
        <Card className="mb-3">
          <Card.Body className="py-2">
            <Row className="g-2">
              <Col md={4}>
                <Form.Label className="small mb-1">Order No</Form.Label>
                <Form.Control
                  size="sm"
                  value={filtersDraft.orderNo}
                  onChange={(e) => setFiltersDraft((s) => ({ ...s, orderNo: e.target.value }))}
                  placeholder="Search order no"
                />
              </Col>
              <Col md={4}>
                <Form.Label className="small mb-1">Customer</Form.Label>
                <Form.Select
                  size="sm"
                  value={filtersDraft.customer}
                  onChange={(e) => setFiltersDraft((s) => ({ ...s, customer: e.target.value }))}
                >
                  <option value="">All Customer</option>
                  {options.customers.map((v) => <option key={v} value={v}>{v}</option>)}
                </Form.Select>
              </Col>
              <Col md={4}>
                <ChipMultiSelect
                  label="Status"
                  options={STATUS_OPTIONS}
                  selectedValues={filtersDraft.statuses}
                  onChange={(vals) => setFiltersDraft((s) => ({ ...s, statuses: vals }))}
                  allLabel="All Status"
                  bubbleClassName="chip-multi-select-bubble--status"
                  allExclusive
                />
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">&nbsp;</Form.Label>
                <Button
                  size="sm"
                  className="w-100"
                  onClick={() => {
                    setFiltersApplied({ ...filtersDraft })
                    setCurrentPage(1)
                  }}
                >
                  Search
                </Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      <Card>
        <Card.Body className="p-0">
          {loading ? (
            <p className="p-3 mb-0">Loading…</p>
          ) : (
            <Table responsive hover className="mb-0" size="sm">
              <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
                <tr>
                  {!isSalesManager && <th>Action</th>}
                  {isSalesManager && (
                    <th>
                      <Form.Check
                        type="checkbox"
                        checked={allPagedSelected}
                        onChange={toggleSelectAllPaged}
                        title="Select all rows"
                      />
                    </th>
                  )}
                  <th>Status</th>
                  <th>Order No</th>
                  <th>Order Date</th>
                  <th>Sales Person</th>
                  <th>Customer</th>
                  <th className="text-end">Payable ($)</th>
                  <th className="text-end">Products</th>
                  {isSalesManager && <th className="text-end">Credit Memo</th>}
                  {isSalesManager && <th className="text-end">Packed Boxes</th>}
                  <th>Shipping Type</th>
                  {isSalesManager && <th>Sales Remark</th>}
                  {isSalesManager && <th>Driver Remarks</th>}
                  <th>Delivery Date</th>
                  {isSalesManager && <th>Canceled Date</th>}
                  {isSalesManager && <th>Canceled Remark</th>}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((o) => {
                  const b = badge(o.status)
                  return (
                    <tr key={o._id} className={getShippingRowClass(o.shippingType)}>
                      {!isSalesManager && (
                        <td>
                          {isViewOnlyStatus(o.status) ? (
                            <button
                              type="button"
                              className="orders-icon-btn"
                              title="View order"
                              onClick={() => navigate(`/sales/orders/${o._id}`)}
                            >
                              👁
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="orders-icon-btn"
                              title="Edit order"
                              onClick={() => navigate(`/sales/orders/new?edit=${o._id}`)}
                            >
                              ✏
                            </button>
                          )}
                        </td>
                      )}
                      {isSalesManager && (
                        <td>
                          <div className="orders-action-cell">
                            <Form.Check
                              type="checkbox"
                              checked={selectedOrderIds.includes(o._id)}
                              onChange={() => toggleOrderSelected(o._id)}
                            />
                            <button type="button" className="orders-icon-btn" title="Open order" onClick={() => navigate(`/sales/orders/${o._id}`)}>👁</button>
                            <button type="button" className="orders-icon-btn" title="History log" onClick={() => openHistory(o)}>🕘</button>
                            <button type="button" className="orders-icon-btn" title="Print templates" onClick={() => openPrint(o)}>🖨</button>
                            <button
                              type="button"
                              className="orders-icon-btn"
                              title="Assign to driver"
                              onClick={() => openAssignDriver(o)}
                              disabled={!['packed', 'add-on-packed'].includes(o.status)}
                            >
                              🚚
                            </button>
                          </div>
                        </td>
                      )}
                      <td><Badge bg={b.bg} text={b.text}>{o.status || 'new'}</Badge></td>
                      <td>{o.orderNumber}</td>
                      <td className="small text-muted">{o.orderDate ? new Date(o.orderDate).toLocaleDateString() : '—'}</td>
                      <td>{o.salesPerson?.name || o.salesPerson?.username || '—'}</td>
                      <td>{o.customer?.customerName || o.customer?.businessName || '—'}</td>
                      <td className="text-end">{Number(o.orderTotal || o.subtotal || 0).toFixed(2)}</td>
                      <td className="text-end">{Array.isArray(o.lineItems) ? o.lineItems.length : 0}</td>
                      {isSalesManager && <td className="text-end">0</td>}
                      {isSalesManager && <td className="text-end">0</td>}
                      <td>{o.shippingType || '—'}</td>
                      {isSalesManager && <td>{o.salesPersonRemark || ''}</td>}
                      {isSalesManager && <td>{o.driverRemark || ''}</td>}
                      <td className="small text-muted">{o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString() : '—'}</td>
                      {isSalesManager && <td className="small text-muted">—</td>}
                      {isSalesManager && <td className="small text-muted">—</td>}
                    </tr>
                  )
                })}
                {pagedRows.length === 0 && (
                  <tr>
                    <td colSpan={isSalesManager ? 16 : 10} className="text-center text-muted py-4">No orders found.</td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
      {!loading && (
        <div className="d-flex justify-content-between align-items-center mt-2">
          <div className="small text-muted">
            Records {filteredRows.length === 0 ? 0 : pageSize === 'all' ? 1 : (currentPage - 1) * (Number(pageSize) || 10) + 1}
            {' '} - {pageSize === 'all' ? filteredRows.length : Math.min(currentPage * (Number(pageSize) || 10), filteredRows.length)}
            {' '} of {filteredRows.length}
          </div>
          <div className="d-flex align-items-center gap-2">
            <Form.Select
              size="sm"
              style={{ width: 90 }}
              value={pageSize}
              onChange={(e) => {
                setPageSize(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="10">10</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="all">All</option>
            </Form.Select>
            {pageSize !== 'all' && (
              <div className="d-flex align-items-center gap-1">
                <button type="button" className="btn btn-sm btn-outline-secondary" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                  &lt;
                </button>
                <span className="small px-1">{currentPage} / {totalPages}</span>
                <button type="button" className="btn btn-sm btn-outline-secondary" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                  &gt;
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal show={showHistoryModal} onHide={() => setShowHistoryModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Order History</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!activeOrder ? (
            <div className="text-muted">No order selected.</div>
          ) : (
            <>
              <div className="small mb-2"><strong>Order:</strong> {activeOrder.orderNumber || '—'}</div>
              {historyRows.length === 0 ? (
                <div className="text-muted">No history logs yet.</div>
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
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowHistoryModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showPrintModal} onHide={() => setShowPrintModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Print Templates</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="small mb-2">Choose invoice template</div>
          <Form.Check
            type="radio"
            id="tpl-standard"
            name="print-template"
            label="Standard invoice"
            checked={printTemplate === 'standard'}
            onChange={() => setPrintTemplate('standard')}
          />
          <Form.Check
            type="radio"
            id="tpl-compact"
            name="print-template"
            label="Compact invoice"
            checked={printTemplate === 'compact'}
            onChange={() => setPrintTemplate('compact')}
          />
          <Form.Check
            type="radio"
            id="tpl-detailed"
            name="print-template"
            label="Detailed invoice"
            checked={printTemplate === 'detailed'}
            onChange={() => setPrintTemplate('detailed')}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPrintModal(false)}>Close</Button>
          <Button
            variant="primary"
            onClick={() => {
              window.print()
              setShowPrintModal(false)
            }}
          >
            Print
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showAssignModal} onHide={() => setShowAssignModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Assign Driver</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="small mb-2">Select active driver or customer pickup</div>
          {drivers.map((d) => (
            <Form.Check
              key={d._id}
              type="radio"
              id={`drv-${d._id}`}
              name="assign-driver"
              label={d.name || d.username}
              checked={assignChoice === d._id}
              onChange={() => setAssignChoice(d._id)}
            />
          ))}
          <Form.Check
            type="radio"
            id="drv-customer-pickup"
            name="assign-driver"
            label="Customer Pickup"
            checked={assignChoice === 'customer_pickup'}
            onChange={() => setAssignChoice('customer_pickup')}
          />
          {actionMessage && <div className="text-danger small mt-2">{actionMessage}</div>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAssignModal(false)}>Close</Button>
          <Button variant="primary" onClick={performAssignDriver}>Assign</Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default OrdersListPage
