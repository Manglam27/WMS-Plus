import { useEffect, useMemo, useState } from 'react'
import { Badge, Card, Col, Form, Row, Table } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/api'

const statusBadge = (s) => {
  if (s === 'active') return 'success'
  if (s === 'pending') return 'warning'
  return 'secondary'
}

function CustomersListPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageSize, setPageSize] = useState('10')

  const [searchDraft, setSearchDraft] = useState({
    orderNo: '',
    customerId: '',
    customerName: '',
    customerType: '',
    state: '',
    city: '',
    product: '',
  })
  const [appliedSearch, setAppliedSearch] = useState(searchDraft)

  useEffect(() => {
    Promise.all([
      api.get('/api/sales/customers').then(async (res) => {
        if (!res.ok) return []
        const data = await res.json().catch(() => [])
        return Array.isArray(data) ? data : []
      }),
      // Needed so we can search customers by associated Order No. and Product name.
      api.get('/api/sales/orders').then(async (res) => {
        if (!res.ok) return []
        const data = await res.json().catch(() => [])
        return Array.isArray(data) ? data : []
      }),
    ])
      .then(([customers, ordersList]) => {
        setRows(customers)
        setOrders(ordersList)
      })
      .finally(() => setLoading(false))
  }, [])

  const primaryContact = (c) => {
    if (Array.isArray(c.contacts) && c.contacts.length > 0) {
      const def = c.contacts.find((x) => x.isDefault) || c.contacts[0]
      return def
    }
    return {
      personName: c.contactName || '',
      email: c.contactEmail || '',
      mobileNo: c.contactPhone || '',
    }
  }

  const customerOrderIndex = useMemo(() => {
    const map = new Map()
    for (const o of orders || []) {
      const customerObj = o.customer
      const customerId = customerObj?._id || customerObj?._id === 0 ? customerObj._id : customerObj
      if (!customerId) continue
      const key = String(customerId)

      if (!map.has(key)) map.set(key, { orderNumbers: [], products: [] })
      const entry = map.get(key)

      if (o.orderNumber) entry.orderNumbers.push(String(o.orderNumber))
      if (Array.isArray(o.lineItems)) {
        for (const li of o.lineItems) {
          if (li?.productName) entry.products.push(String(li.productName))
          if (li?.productId) entry.products.push(String(li.productId))
        }
      }
    }
    return map
  }, [orders])

  const filteredRows = useMemo(() => {
    const orderNoQ = String(appliedSearch.orderNo || '').trim().toLowerCase()
    const customerIdQ = String(appliedSearch.customerId || '').trim().toLowerCase()
    const customerNameQ = String(appliedSearch.customerName || '').trim().toLowerCase()
    const customerTypeQ = String(appliedSearch.customerType || '').trim().toLowerCase()
    const stateQ = String(appliedSearch.state || '').trim().toLowerCase()
    const cityQ = String(appliedSearch.city || '').trim().toLowerCase()
    const productQ = String(appliedSearch.product || '').trim().toLowerCase()

    const hasAnySearch =
      orderNoQ || customerIdQ || customerNameQ || customerTypeQ || stateQ || cityQ || productQ
    if (!hasAnySearch) return rows

    return rows.filter((c) => {
      const pc = primaryContact(c)
      const billingState = c?.billingAddress?.state || ''
      const billingCity = c?.billingAddress?.city || ''
      const shippingState = c?.shippingAddress?.state || ''
      const shippingCity = c?.shippingAddress?.city || ''

      const idx = customerOrderIndex.get(String(c._id))
      const orderNos = idx?.orderNumbers || []
      const products = idx?.products || []

      const matchesOrderNo = !orderNoQ || orderNos.some((n) => n.toLowerCase().includes(orderNoQ))
      const matchesCustomerId = !customerIdQ || (c.customerNumber || '').toLowerCase().includes(customerIdQ)
      const matchesCustomerName =
        !customerNameQ ||
        (c.customerName || '').toLowerCase().includes(customerNameQ) ||
        (c.businessName || '').toLowerCase().includes(customerNameQ)
      const matchesCustomerType = !customerTypeQ || (c.customerType || '').toLowerCase().includes(customerTypeQ)

      const states = [billingState, shippingState].filter(Boolean)
      const cities = [billingCity, shippingCity].filter(Boolean)
      const matchesState = !stateQ || states.some((s) => String(s).toLowerCase().includes(stateQ))
      const matchesCity = !cityQ || cities.some((ct) => String(ct).toLowerCase().includes(cityQ))

      const matchesProduct = !productQ || products.some((p) => String(p).toLowerCase().includes(productQ))

      // AND filtering: all provided fields must match.
      return matchesOrderNo && matchesCustomerId && matchesCustomerName && matchesCustomerType && matchesState && matchesCity && matchesProduct
    })
  }, [rows, appliedSearch, customerOrderIndex])

  const visibleRows = useMemo(() => {
    if (pageSize === 'all') return filteredRows
    const n = Number(pageSize) || 10
    return filteredRows.slice(0, n)
  }, [filteredRows, pageSize])

  return (
    <>
      <h2 className="mb-2">Customers</h2>
      <Card className="mb-3">
        <Card.Body className="py-2 px-3">
          <Row className="g-2 align-items-end">
            <Col md={2}>
              <div className="fw-semibold mb-1">Customer List</div>
              <div className="small text-muted">Search & manage customers</div>
            </Col>

            <Col md={2}>
              <Form.Control
                size="sm"
                placeholder="Order No."
                value={searchDraft.orderNo}
                onChange={(e) => setSearchDraft((s) => ({ ...s, orderNo: e.target.value }))}
              />
            </Col>
            <Col md={2}>
              <Form.Control
                size="sm"
                placeholder="Customer ID"
                value={searchDraft.customerId}
                onChange={(e) => setSearchDraft((s) => ({ ...s, customerId: e.target.value }))}
              />
            </Col>
            <Col md={2}>
              <Form.Control
                size="sm"
                placeholder="Customer Name"
                value={searchDraft.customerName}
                onChange={(e) => setSearchDraft((s) => ({ ...s, customerName: e.target.value }))}
              />
            </Col>
            <Col md={2}>
              <Form.Select
                size="sm"
                value={searchDraft.customerType}
                onChange={(e) => setSearchDraft((s) => ({ ...s, customerType: e.target.value }))}
              >
                <option value="">Customer Type</option>
                <option value="Retail">Retail</option>
                <option value="Wholesale">Wholesale</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Control
                size="sm"
                placeholder="State"
                value={searchDraft.state}
                onChange={(e) => setSearchDraft((s) => ({ ...s, state: e.target.value }))}
              />
            </Col>
            <Col md={2}>
              <Form.Control
                size="sm"
                placeholder="City"
                value={searchDraft.city}
                onChange={(e) => setSearchDraft((s) => ({ ...s, city: e.target.value }))}
              />
            </Col>
            <Col md={2}>
              <Form.Control
                size="sm"
                placeholder="Product"
                value={searchDraft.product}
                onChange={(e) => setSearchDraft((s) => ({ ...s, product: e.target.value }))}
              />
            </Col>

            <Col md={2} className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setAppliedSearch(searchDraft)
                  // Keep UX: restart to first page size when search changes.
                  setPageSize('10')
                }}
              >
                Search
              </button>
              <Link
                to="/sales/customers/new"
                className="btn btn-sm"
                style={{ backgroundColor: '#F29F67', borderColor: '#F29F67', color: '#1E1E2C' }}
              >
                New Customer
              </Link>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center py-2">
          <div className="fw-semibold">Active</div>
          <div className="small text-muted">
            Showing {visibleRows.length} of {filteredRows.length} customer(s)
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          {loading ? (
            <p className="p-3 mb-0 text-muted">Loading…</p>
          ) : (
            <Table responsive hover className="mb-0" size="sm">
              <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
                <tr>
                  <th style={{ width: 60 }}>Action</th>
                  <th>Customer ID</th>
                  <th>Customer Name</th>
                  <th>Contact Person</th>
                  <th>Email</th>
                  <th>Contact</th>
                  <th className="text-end">Store Credit</th>
                  <th className="text-end">Total Order</th>
                  <th className="text-end">Order Amount</th>
                  <th className="text-end">Paid Amount</th>
                  <th className="text-end">Due Amount</th>
                  <th>Last Order Date</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <div className="d-flex gap-1 align-items-center">
                        <Badge bg={statusBadge(c.status)} className="text-uppercase small">
                          {c.status || 'pending'}
                        </Badge>
                        <button
                          type="button"
                          className="btn btn-link p-0 text-primary"
                          title="Open customer details"
                          onClick={() => {
                            navigate(`/sales/customers/${c._id}`)
                          }}
                        >
                          <span aria-hidden="true" style={{ fontSize: 14 }}>✎</span>
                        </button>
                      </div>
                    </td>
                    <td>{c.customerNumber || '—'}</td>
                    <td>{c.customerName || c.businessName}</td>
                    {(() => {
                      const pc = primaryContact(c)
                      return (
                        <>
                          <td>{pc.personName || '—'}</td>
                          <td className="small text-muted">{pc.email || '—'}</td>
                          <td className="small text-muted">{pc.mobileNo || c.contactPhone || '—'}</td>
                        </>
                      )
                    })()}
                    <td className="text-end">$ 0.00</td>
                    <td className="text-end">0</td>
                    <td className="text-end">$ 0.00</td>
                    <td className="text-end">$ 0.00</td>
                    <td className="text-end">$ 0.00</td>
                    <td className="small text-muted">—</td>
                  </tr>
                ))}
                {filteredRows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={12} className="text-center text-muted py-4">
                      No customers yet. Create a new customer request.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <div className="d-flex justify-content-between align-items-center mt-3">
        <div className="small text-muted">
          {filteredRows.length ? `Total matched: ${filteredRows.length}` : ''}
        </div>
        <Form.Select
          size="sm"
          value={pageSize}
          onChange={(e) => {
            const v = e.target.value
            setPageSize(v)
          }}
          style={{ width: 160 }}
        >
          <option value="10">Show 10</option>
          <option value="50">Show 50</option>
          <option value="100">Show 100</option>
          <option value="all">Show All</option>
        </Form.Select>
      </div>
    </>
  )
}

export default CustomersListPage
