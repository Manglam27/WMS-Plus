import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'

function IconButton({ title, onClick, children }) {
  return (
    <button
      type="button"
      className="product-list-icon-btn"
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.83H5v-.92l9.06-9.06.92.92L5.92 20.08zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"
      />
    </svg>
  )
}

function formatDate(dateValue) {
  if (!dateValue) return 'N/A'
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return 'N/A'
  return d.toLocaleDateString()
}

function formatMoney(value) {
  if (value == null || value === '') return '0'
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function VendorListPage() {
  const navigate = useNavigate()
  const dropdownRef = useRef(null)
  const [actionOpen, setActionOpen] = useState(false)
  const [filters, setFilters] = useState({
    vendorName: '',
    vendorInvoiceNo: '',
    contactPerson: '',
  })
  const [pageSize, setPageSize] = useState('10')
  const [offset, setOffset] = useState(0)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const buildQuery = (nextOffset) => {
    const params = new URLSearchParams()
    params.set('limit', pageSize)
    params.set('offset', String(nextOffset))
    if (filters.vendorName.trim()) params.set('vendorName', filters.vendorName.trim())
    if (filters.vendorInvoiceNo.trim()) params.set('vendorInvoiceNo', filters.vendorInvoiceNo.trim())
    if (filters.contactPerson.trim()) params.set('contactPerson', filters.contactPerson.trim())
    return `/api/vendors?${params.toString()}`
  }

  const fetchPage = async ({ reset }) => {
    setError('')
    setLoading(true)
    try {
      const nextOffset = reset ? 0 : offset
      const res = await api.get(buildQuery(nextOffset))
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to load vendors')

      const nextItems = Array.isArray(data.items) ? data.items : []
      setTotal(Number(data.total) || 0)
      setOffset(nextOffset + nextItems.length)
      setItems((prev) => (reset ? nextItems : [...prev, ...nextItems]))
    } catch (e) {
      setError(e.message || 'Failed to load vendors')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPage({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActionOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (field) => (e) => {
    setFilters((f) => ({ ...f, [field]: e.target.value }))
  }

  return (
    <div className="product-list-page">
      <div className="product-list-header">
        <div className="product-list-title">Vendor List</div>
        <div className="vendor-list-action-wrap" ref={dropdownRef}>
          <button
            type="button"
            className="product-list-action-btn"
            onClick={() => setActionOpen((o) => !o)}
            aria-expanded={actionOpen}
            aria-haspopup="true"
          >
            Action
          </button>
          {actionOpen && (
            <div className="vendor-list-action-dropdown">
              <button
                type="button"
                className="vendor-list-action-dropdown-item"
                onClick={() => {
                  setActionOpen(false)
                  navigate('/vendors/new')
                }}
              >
                Create new vendor
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="product-list-filters">
        <input
          placeholder="Vendor Name"
          value={filters.vendorName}
          onChange={handleChange('vendorName')}
        />
        <input
          placeholder="Vendor Invoice No."
          value={filters.vendorInvoiceNo}
          onChange={handleChange('vendorInvoiceNo')}
        />
        <input
          placeholder="Contact Person"
          value={filters.contactPerson}
          onChange={handleChange('contactPerson')}
        />
        <button
          className="product-list-search-btn"
          type="button"
          onClick={() => {
            setOffset(0)
            fetchPage({ reset: true })
          }}
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
                <th>Status</th>
                <th>Vendor ID</th>
                <th>Vendor Name</th>
                <th>Contact Person</th>
                <th>Phone No</th>
                <th>Office Contact</th>
                <th>Email ID</th>
                <th>Vendor Credit</th>
                <th>Total PO</th>
                <th>PO Amount</th>
                <th>Paid Amount</th>
                <th>Due Amount</th>
                <th>Last PO Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v._id}>
                  <td>
                    <div className="product-list-actions" title="Edit">
                      <IconButton
                        title="Edit"
                        onClick={() => navigate(`/vendors/details/${v._id}`)}
                      >
                        <EditIcon />
                      </IconButton>
                    </div>
                  </td>
                  <td>
                    <span
                      className="product-list-status"
                      style={{
                        background: v.status === 'Inactive' ? '#e5e7eb' : '#2ecc71',
                        color: v.status === 'Inactive' ? '#374151' : '#fff',
                      }}
                    >
                      {v.status || 'Active'}
                    </span>
                  </td>
                  <td>{v.vendorId || '-'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-link p-0 text-primary text-decoration-none"
                      onClick={() => navigate(`/vendors/details/${v._id}`)}
                    >
                      {v.vendorName || '-'}
                    </button>
                  </td>
                  <td>{v.contactPerson || '-'}</td>
                  <td>{v.phoneNo || '-'}</td>
                  <td>{v.officeContact || '-'}</td>
                  <td>{v.emailId || '-'}</td>
                  <td>{formatMoney(v.vendorCredit)}</td>
                  <td>{v.totalPO != null ? v.totalPO : '-'}</td>
                  <td>{formatMoney(v.poAmount)}</td>
                  <td>{formatMoney(v.paidAmount)}</td>
                  <td>{formatMoney(v.dueAmount)}</td>
                  <td>{formatDate(v.lastPODate)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={14} className="text-center text-muted">
                    {loading ? 'Loading...' : 'No vendors found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="product-list-footer">
        <div className="small text-muted">
          Showing <strong>{items.length}</strong> of <strong>{total}</strong>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="small text-muted">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setItems([])
              setOffset(0)
              setPageSize(e.target.value)
            }}
          >
            <option value="10">10</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export default VendorListPage
