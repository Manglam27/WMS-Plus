import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'

function formatDate(dateValue) {
  if (!dateValue) return '-'
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

function PurchaseOrderListPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({
    vendorInvoiceNo: '',
    fromDate: '',
    toDate: '',
  })
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const buildQuery = () => {
    const params = new URLSearchParams()
    params.set('limit', 'all')
    if (filters.vendorInvoiceNo.trim()) params.set('vendorInvoiceNo', filters.vendorInvoiceNo.trim())
    if (filters.fromDate) params.set('fromDate', filters.fromDate)
    if (filters.toDate) params.set('toDate', filters.toDate)
    return `/api/po?${params.toString()}`
  }

  const fetchList = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await api.get(buildQuery())
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to load POs')
      setItems(Array.isArray(data.items) ? data.items : [])
      setTotal(Number(data.total) || 0)
    } catch (e) {
      setError(e.message || 'Failed to load POs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (field) => (e) => {
    setFilters((f) => ({ ...f, [field]: e.target.value }))
  }

  const statusLabel = (status) => (status === 'generated' ? 'Pending Approval' : 'Draft')
  const statusBadgeClass = (status) =>
    status === 'generated' ? 'po-status-badge po-status-badge--pending' : 'po-status-badge po-status-badge--draft'

  return (
    <div className="product-list-page po-list-page">
      <div className="product-list-header">
        <div className="product-list-title">PO List</div>
      </div>

      <div className="product-list-filters">
        <input
          placeholder="Vendor Invoice No."
          value={filters.vendorInvoiceNo}
          onChange={handleChange('vendorInvoiceNo')}
        />
        <input type="date" placeholder="From PO Date" value={filters.fromDate} onChange={handleChange('fromDate')} title="From PO Date" />
        <input type="date" placeholder="To PO Date" value={filters.toDate} onChange={handleChange('toDate')} title="To PO Date" />
        <button
          className="product-list-search-btn"
          type="button"
          onClick={() => fetchList()}
          disabled={loading}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && <div className="text-danger small mb-2">{error}</div>}

      <div className="product-list-table-container">
        <div style={{ overflowX: 'auto' }}>
          <table className="product-list-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>PO Number</th>
                <th>Vendor Invoice No</th>
                <th>Date</th>
                <th>Vendor</th>
                <th>Product</th>
                <th>Status</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              {items.map((po) => (
                <tr key={po._id}>
                  <td>
                    <button
                      type="button"
                      className="product-list-icon-btn"
                      title="Edit PO"
                      onClick={() => navigate(`/po/edit/${po._id}`)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.83H5v-.92l9.06-9.06.92.92L5.92 20.08zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" />
                      </svg>
                    </button>
                  </td>
                  <td>{po.poNumber || '-'}</td>
                  <td>{po.vendorInvoiceNo || '-'}</td>
                  <td>{formatDate(po.date)}</td>
                  <td>{po.vendor ? (po.vendor.vendorName || po.vendor.vendorId) : '-'}</td>
                  <td>{Array.isArray(po.lineItems) ? po.lineItems.length : 0} item(s)</td>
                  <td>
                    <span className={statusBadgeClass(po.status)}>{statusLabel(po.status)}</span>
                  </td>
                  <td>{(po.remark || '').slice(0, 50)}{(po.remark && po.remark.length > 50) ? '…' : ''}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted">
                    {loading ? 'Loading...' : 'No POs found'}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className="fw-semibold">Total</td>
                <td colSpan={7}>{total}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

export default PurchaseOrderListPage
