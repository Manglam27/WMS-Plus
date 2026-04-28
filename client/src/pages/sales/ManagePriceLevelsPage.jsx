import { useEffect, useMemo, useState } from 'react'
import { Card, Table } from 'react-bootstrap'
import { api } from '../../api/api'

function ManagePriceLevelsPage() {
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

  const levels = useMemo(() => {
    const map = new Map()
    for (const c of rows) {
      const code = String(c.priceLevelCode || '').trim()
      if (!code) continue
      if (!map.has(code)) {
        map.set(code, {
          code,
          count: 0,
          examples: [],
        })
      }
      const item = map.get(code)
      item.count += 1
      if (item.examples.length < 3) item.examples.push(c.customerName || c.businessName || '—')
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code))
  }, [rows])

  return (
    <>
      <h2 className="mb-2">Manage Price Levels</h2>
      <div className="small text-muted mb-3">Customer price level overview</div>

      <Card>
        <Card.Body className="p-0">
          {loading ? (
            <p className="p-3 mb-0 text-muted">Loading…</p>
          ) : (
            <Table responsive hover size="sm" className="mb-0">
              <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
                <tr>
                  <th>Price Level Code</th>
                  <th className="text-end">Customers</th>
                  <th>Examples</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((lv) => (
                  <tr key={lv.code}>
                    <td>{lv.code}</td>
                    <td className="text-end">{lv.count}</td>
                    <td className="small text-muted">{lv.examples.join(', ')}</td>
                  </tr>
                ))}
                {levels.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-muted py-4">
                      No price levels found.
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

export default ManagePriceLevelsPage

