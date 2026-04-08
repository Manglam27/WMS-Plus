import { useEffect, useState } from 'react'
import { Badge, Card, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { api } from '../../api/api'

function SalesCreditMemoListPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/api/sales/credit-memos')
      .then(async (res) => {
        const data = await res.json().catch(() => [])
        if (res.ok) setRows(Array.isArray(data) ? data : [])
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Credit memo list</h2>
        <Link to="/sales/credit-memo/new" className="btn btn-sm" style={{ backgroundColor: '#F29F67', borderColor: '#F29F67', color: '#1E1E2C' }}>
          New credit memo
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
                  <th>Memo #</th>
                  <th>Customer</th>
                  <th className="text-end">Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m._id}>
                    <td>{m.memoNumber}</td>
                    <td>{m.customer?.businessName || '—'}</td>
                    <td className="text-end">${Number(m.amount).toFixed(2)}</td>
                    <td><Badge bg="secondary">{m.status}</Badge></td>
                    <td className="small text-muted">{m.createdAt ? new Date(m.createdAt).toLocaleString() : '—'}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">No credit memos yet.</td>
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

export default SalesCreditMemoListPage
