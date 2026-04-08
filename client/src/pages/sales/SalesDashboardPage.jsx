import { useEffect, useState } from 'react'
import { Card, Col, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { api } from '../../api/api'

function SalesDashboardPage() {
  const [stats, setStats] = useState({ customers: 0, draftOrders: 0, openOrders: 0 })

  useEffect(() => {
    api
      .get('/api/sales/stats')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) return
        setStats({
          customers: Number(data.customers) || 0,
          draftOrders: Number(data.draftOrders) || 0,
          openOrders: Number(data.openOrders) || 0,
        })
      })
      .catch(() => {})
  }, [])

  return (
    <>
      <h2 className="mb-4">Sales Dashboard</h2>
      <Row className="g-3 mb-4">
        <Col md={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="text-muted small text-uppercase mb-1">My customers</div>
              <div className="fs-3 fw-semibold">{stats.customers}</div>
              <Link to="/sales/customers" className="small">View list</Link>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="text-muted small text-uppercase mb-1">Draft orders</div>
              <div className="fs-3 fw-semibold">{stats.draftOrders}</div>
              <Link to="/sales/orders/draft" className="small">Open drafts</Link>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="text-muted small text-uppercase mb-1">Open orders</div>
              <div className="fs-3 fw-semibold">{stats.openOrders}</div>
              <div className="small text-muted">Submitted / confirmed</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <Card>
        <Card.Body className="text-muted small">
          Use the sidebar to request new business customers, manage orders, credit memos, and record payments.
        </Card.Body>
      </Card>
    </>
  )
}

export default SalesDashboardPage
