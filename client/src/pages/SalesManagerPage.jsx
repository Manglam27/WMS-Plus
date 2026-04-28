import { useEffect, useMemo, useState } from 'react'
import { Card, Col, Form, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { api } from '../api/api'

function SalesManagerPage() {
  const [period, setPeriod] = useState('today')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState({
    totalOrders: 0,
    totalSales: 0,
    aov: 0,
    bySalesPerson: [],
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get(`/api/sales/manager/dashboard?period=${encodeURIComponent(period)}`)
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload?.message || 'Failed to load dashboard')
        if (cancelled) return
        setData({
          totalOrders: Number(payload.totalOrders) || 0,
          totalSales: Number(payload.totalSales) || 0,
          aov: Number(payload.aov) || 0,
          bySalesPerson: Array.isArray(payload.bySalesPerson) ? payload.bySalesPerson : [],
        })
        setError('')
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Failed to load dashboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [period])

  const totalsRow = useMemo(() => {
    const totalOrders = (data.bySalesPerson || []).reduce((sum, r) => sum + (Number(r.totalOrders) || 0), 0)
    const totalSales = (data.bySalesPerson || []).reduce((sum, r) => sum + (Number(r.totalSales) || 0), 0)
    const aov = totalOrders > 0 ? totalSales / totalOrders : 0
    return { totalOrders, totalSales, aov }
  }, [data.bySalesPerson])

  const fmtMoney = (v) => `$ ${Number(v || 0).toFixed(2)}`

  return (
    <>
      <h2 className="mb-4">Sales Manager Dashboard</h2>

      <Row className="g-3 mb-4">
        <Col md={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="text-muted small text-uppercase mb-1">Total Orders</div>
              <div className="fs-3 fw-semibold">{data.totalOrders}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="text-muted small text-uppercase mb-1">Total Sales</div>
              <div className="fs-3 fw-semibold">{fmtMoney(data.totalSales)}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="text-muted small text-uppercase mb-1">Average Order Value</div>
              <div className="fs-3 fw-semibold">{fmtMoney(data.aov)}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span className="fw-semibold">Sales Revenue By Sales Person</span>
          <Form.Select
            size="sm"
            style={{ width: 180 }}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="overall">Overall</option>
          </Form.Select>
        </Card.Header>
        <Card.Body className="p-0">
          {loading ? (
            <p className="p-3 mb-0 text-muted">Loading dashboard...</p>
          ) : error ? (
            <p className="p-3 mb-0 text-danger">{error}</p>
          ) : (
            <Table responsive hover className="mb-0" size="sm">
              <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
                <tr>
                  <th>Sales Person Name</th>
                  <th className="text-center">Total Order</th>
                  <th className="text-end">Total Sales</th>
                  <th className="text-end">AOV</th>
                </tr>
              </thead>
              <tbody>
                {data.bySalesPerson.map((row) => (
                  <tr key={row.salesPersonId}>
                    <td>{row.salesPersonName || '-'}</td>
                    <td className="text-center">{Number(row.totalOrders) || 0}</td>
                    <td className="text-end">{fmtMoney(row.totalSales)}</td>
                    <td className="text-end">{fmtMoney(row.aov)}</td>
                  </tr>
                ))}
                {data.bySalesPerson.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted py-3">
                      No sales data found for selected period.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td className="fw-semibold">Total</td>
                  <td className="text-center fw-semibold">{totalsRow.totalOrders}</td>
                  <td className="text-end fw-semibold">{fmtMoney(totalsRow.totalSales)}</td>
                  <td className="text-end fw-semibold">{fmtMoney(totalsRow.aov)}</td>
                </tr>
              </tfoot>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Row className="g-3">
        <Col md={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-1">Customer Management</div>
              <p className="small text-muted mb-2">
                Manage all customers, review details, and open customer profiles.
              </p>
              <Link to="/sales/customers" className="btn btn-sm btn-outline-primary">
                Open Customer List
              </Link>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-1">Order Management</div>
              <p className="small text-muted mb-2">
                Manage all order generation, review drafts, and monitor submissions.
              </p>
              <Link to="/sales/orders" className="btn btn-sm btn-outline-primary">
                Open Order List
              </Link>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  )
}

export default SalesManagerPage
