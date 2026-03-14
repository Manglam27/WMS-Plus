import { useEffect, useState } from 'react'
import { Card, Row, Col } from 'react-bootstrap'
import { api } from '../api/api'

function InventoryReceiverPage() {
  const [counts, setCounts] = useState({
    generated: 0,
    rejected: 0,
    approved: 0,
    draft: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    // When PO API exists, call GET /api/po or GET /api/po/stats and set counts from response
    const fetchCounts = async () => {
      try {
        const res = await api.get('/api/po?limit=all').catch(() => null)
        if (cancelled) return
        if (res && res.ok) {
          const data = await res.json().catch(() => ({}))
          const items = Array.isArray(data?.items) ? data.items : []
          setCounts({
            generated: items.filter((p) => p.status === 'generated' || p.status === 'submitted').length,
            rejected: items.filter((p) => p.status === 'rejected').length,
            approved: items.filter((p) => p.status === 'approved').length,
            draft: items.filter((p) => p.status === 'draft').length,
          })
        }
      } catch {
        // no-op
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchCounts()
    return () => { cancelled = true }
  }, [])

  const stats = [
    { label: 'PO Generated', value: counts.generated, color: '#1e1e2c', bg: '#f1f5f9' },
    { label: 'Rejected', value: counts.rejected, color: '#b91c1c', bg: '#fee2e2' },
    { label: 'Approved', value: counts.approved, color: '#166534', bg: '#dcfce7' },
    { label: 'Draft', value: counts.draft, color: '#475569', bg: '#f1f5f9' },
  ]

  return (
    <>
      <h2 className="mb-4">Inventory Receiver Dashboard</h2>
      <p className="text-muted mb-4">Overview of purchase order status counts.</p>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <Row xs={1} sm={2} lg={4} className="g-3">
          {stats.map((s) => (
            <Col key={s.label}>
              <Card className="h-100 border-0 shadow-sm">
                <Card.Body>
                  <div className="small text-muted text-uppercase fw-semibold mb-1">{s.label}</div>
                  <div className="fs-3 fw-bold" style={{ color: s.color }}>
                    {s.value}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </>
  )
}

export default InventoryReceiverPage
