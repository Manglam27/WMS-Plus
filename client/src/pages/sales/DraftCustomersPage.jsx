import { useEffect, useMemo, useState } from 'react'
import { Badge, Card, Table } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/api'

function DraftCustomersPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/api/sales/customers')
      .then(async (res) => {
        const data = await res.json().catch(() => [])
        if (!res.ok) return
        setRows(Array.isArray(data) ? data : [])
      })
      .finally(() => setLoading(false))
  }, [])

  const draftRows = useMemo(() => rows.filter((c) => c.status === 'pending'), [rows])

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="mb-1">Draft Customers</h2>
          <div className="small text-muted">Pending customers waiting for review</div>
        </div>
        <Link
          to="/sales/customers/new"
          className="btn btn-sm"
          style={{ backgroundColor: '#F29F67', borderColor: '#F29F67', color: '#1E1E2C' }}
        >
          Create Customer
        </Link>
      </div>

      <Card>
        <Card.Body className="p-0">
          {loading ? (
            <p className="p-3 mb-0 text-muted">Loading…</p>
          ) : (
            <Table responsive hover size="sm" className="mb-0">
              <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
                <tr>
                  <th>Status</th>
                  <th>Customer Name</th>
                  <th>Customer Type</th>
                  <th>Sales Person</th>
                  <th>Created Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {draftRows.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <Badge bg="warning" text="dark">pending</Badge>
                    </td>
                    <td>{c.customerName || c.businessName || '—'}</td>
                    <td>{c.customerType || '—'}</td>
                    <td>{c.salesPerson?.name || c.salesPerson?.username || '—'}</td>
                    <td className="small text-muted">
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0"
                        onClick={() => navigate(`/sales/customers/${c._id}`)}
                      >
                        Edit / Review
                      </button>
                    </td>
                  </tr>
                ))}
                {draftRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      No draft customers found.
                    </td>
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

export default DraftCustomersPage

