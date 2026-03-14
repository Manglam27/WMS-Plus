import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'

function formatDate(dateValue) {
  if (!dateValue) return '-'
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

function PurchaseOrderReceivedListPage() {
  const navigate = useNavigate()
  const [vendors, setVendors] = useState([])
  const [filters, setFilters] = useState({
    vendor: '',
    vendorInvoiceNo: '',
    poNumber: '',
    fromDate: '',
    toDate: '',
  })
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api.get('/api/vendors?limit=all')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.items)) setVendors(data.items)
      })
      .catch(() => { if (!cancelled) setVendors([]) })
    return () => { cancelled = true }
  }, [])

  const buildQuery = () => {
    const params = new URLSearchParams()
    params.set('limit', 'all')
    if (filters.vendor) params.set('vendor', filters.vendor)
    if (filters.vendorInvoiceNo.trim()) params.set('vendorInvoiceNo', filters.vendorInvoiceNo.trim())
    if (filters.poNumber.trim()) params.set('poNumber', filters.poNumber.trim())
    if (filters.fromDate) params.set('fromDate', filters.fromDate)
    if (filters.toDate) params.set('toDate', filters.toDate)
    return `/api/po/received?${params.toString()}`
  }

  const fetchList = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await api.get(buildQuery())
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to load received POs')
      setItems(Array.isArray(data.items) ? data.items : [])
      setTotal(Number(data.total) || 0)
    } catch (e) {
      setError(e.message || 'Failed to load received POs')
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

  const totalAmountSum = items.reduce((sum, po) => sum + (Number(po.totalAmount) || 0), 0)

  return (
    <div className="product-list-page po-list-page draft-po-list-page">
      <div className="product-list-header">
        <div className="product-list-title">Received Invoices (PO List)</div>
      </div>

      <div className="product-list-filters draft-po-filters">
        <div className="draft-po-filter-group">
          <label className="draft-po-filter-label">Vendor</label>
          <select value={filters.vendor} onChange={handleChange('vendor')} className="draft-po-filter-input" aria-label="Vendor">
            <option value="">All Vendors</option>
            {vendors.map((v) => (
              <option key={v._id} value={v._id}>{v.vendorName} ({v.vendorId})</option>
            ))}
          </select>
        </div>
        <div className="draft-po-filter-group">
          <label className="draft-po-filter-label">Vendor Invoice No.</label>
          <input type="text" placeholder="Vendor Invoice No." value={filters.vendorInvoiceNo} onChange={handleChange('vendorInvoiceNo')} className="draft-po-filter-input" />
        </div>
        <div className="draft-po-filter-group">
          <label className="draft-po-filter-label">PO Number</label>
          <input type="text" placeholder="PO Number" value={filters.poNumber} onChange={handleChange('poNumber')} className="draft-po-filter-input" />
        </div>
        <div className="draft-po-filter-group">
          <label className="draft-po-filter-label">From Invoice Date</label>
          <input type="date" value={filters.fromDate} onChange={handleChange('fromDate')} className="draft-po-filter-input" title="From Invoice Date" />
        </div>
        <div className="draft-po-filter-group">
          <label className="draft-po-filter-label">To Invoice Date</label>
          <input type="date" value={filters.toDate} onChange={handleChange('toDate')} className="draft-po-filter-input" title="To Invoice Date" />
        </div>
        <div className="draft-po-filter-group draft-po-filter-actions">
          <button type="button" className="product-list-search-btn" onClick={() => fetchList()} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {error && <div className="text-danger small mb-2">{error}</div>}

      <div className="product-list-table-container">
        <div style={{ overflowX: 'auto' }}>
          <table className="product-list-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Status</th>
                <th>Vendor Invoice No</th>
                <th>Invoice Date</th>
                <th>Received Date</th>
                <th>Vendor Name</th>
                <th>PO Number</th>
                <th>Products</th>
                <th>Total Amount</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              {items.map((po) => (
                <tr key={po._id}>
                  <td>
                    <div className="draft-po-actions">
                      <button type="button" className="product-list-icon-btn" title="View" onClick={() => navigate(`/po/edit/${po._id}`)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                        </svg>
                      </button>
                      <button type="button" className="product-list-icon-btn" title="Print (coming soon)" disabled>
                        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="currentColor" d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" />
                        </svg>
                      </button>
                      <button type="button" className="product-list-icon-btn" title="View log (coming soon)" disabled>
                        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td>
                    <span className="po-status-badge po-status-badge--received">Received</span>
                  </td>
                  <td>{po.vendorInvoiceNo || '-'}</td>
                  <td>{formatDate(po.date)}</td>
                  <td>{formatDate(po.receivedAt)}</td>
                  <td>{po.vendor ? (po.vendor.vendorName || po.vendor.vendorId) : '-'}</td>
                  <td>{po.poNumber || '-'}</td>
                  <td>{Array.isArray(po.lineItems) ? po.lineItems.length : 0}</td>
                  <td>{(Number(po.totalAmount) || 0).toFixed(2)}</td>
                  <td>{(po.remark || '').slice(0, 40)}{(po.remark && po.remark.length > 40) ? '…' : ''}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-muted">
                    {loading ? 'Loading...' : 'No received invoices found'}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className="fw-semibold">Total</td>
                <td colSpan={7} />
                <td className="fw-semibold">{totalAmountSum.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

export default PurchaseOrderReceivedListPage
