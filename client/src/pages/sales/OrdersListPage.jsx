import { useEffect, useState } from 'react'
import { Badge, Card, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { api } from '../../api/api'

function OrdersListPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/api/sales/orders')
      .then(async (res) => {
        const data = await res.json().catch(() => [])
        if (res.ok) setRows(Array.isArray(data) ? data : [])
      })
      .finally(() => setLoading(false))
  }, [])

  const badge = (s) => {
    if (s === 'draft') return { bg: 'warning', text: 'dark' }
    if (s === 'submitted') return { bg: 'info' }
    if (s === 'confirmed') return { bg: 'success' }
    return { bg: 'secondary' }
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Order list</h2>
        <Link to="/sales/orders/new" className="btn btn-sm" style={{ backgroundColor: '#F29F67', borderColor: '#F29F67', color: '#1E1E2C' }}>
          New order
        </Link>
      </div>
      <Card>
        <Card.Body className="p-0">
          {loading ? (
            <p className="p-3 mb-0">Loading…</p>
          ) : (
            <Table responsive hover className="mb-0" size="sm">
              <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th className="text-end">Subtotal</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const b = badge(o.status)
                  return (
                    <tr key={o._id}>
                      <td>{o.orderNumber}</td>
                      <td>{o.customer?.businessName || '—'}</td>
                      <td className="text-end">${Number(o.subtotal || 0).toFixed(2)}</td>
                      <td><Badge bg={b.bg} text={b.text}>{o.status}</Badge></td>
                      <td className="small text-muted">{o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}</td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">No orders yet.</td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </>
  )
}

export default OrdersListPage
