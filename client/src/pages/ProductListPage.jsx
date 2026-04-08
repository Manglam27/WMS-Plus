import { useEffect, useMemo, useState } from 'react'
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

function PrintIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19 8H5a3 3 0 0 0-3 3v4h4v4h12v-4h4v-4a3 3 0 0 0-3-3zm-3 11H8v-5h8v5zm4-6h-2v-2H6v2H4v-2a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2zM17 3H7v4h10V3z"
      />
    </svg>
  )
}

const CATEGORY_OPTIONS = {
  all: ['all'],
  Automobil: ['all', 'Motor Oil', 'Car Cleaning Supplies', 'Air Fresheners', 'Windshield Washer Fluid', 'Car Accessories'],
  Beverage: ['all', 'Soft Drinks', 'Energy Drinks', 'Bottled Water', 'Juice & Juice Drinks', 'Sports Drinks', 'Iced Tea & Coffee', 'Alcoholic Beverages'],
  'Bio Botanicals': ['all', 'Kratom', 'Herbal Supplements', 'Botanical Extracts', 'Herbal Tea', '7OH'],
  'Chargers & Accessories': ['all', 'Phone Chargers', 'Charging Cables', 'Car Chargers', 'Power Banks', 'Earphones & Headphones', 'Phone Holders'],
  'Household Products': ['all', 'Cleaning Supplies', 'Paper Towels & Tissue', 'Aluminum Foil & Wraps', 'Trash Bags', 'Laundry Supplies', 'Air Fresheners'],
  'Lighters & Lighter Fuels': ['all', 'Disposable Lighters', 'Refillable Lighters', 'Butane Fuel', 'Torch Lighters', 'Lighter Accessories'],
  'OTC Medicine': ['all', 'Pain Relief', 'Cold & Flu Medicine', 'Allergy Relief', 'Digestive Health', 'Sleep Aids', 'First Aid Supplies'],
  'Personal & Health Care': ['all', 'Oral Care', 'Skin Care', 'Hair Care', 'Deodorants', 'Feminine Hygiene', 'Grooming Products'],
}

function formatExpiry(dateValue) {
  if (!dateValue) return 'N/A'
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return 'N/A'
  return d.toLocaleDateString()
}

function formatDefaultUnitStock(product) {
  const pieces = typeof product.currentStock === 'number' ? product.currentStock : 0
  if (!pieces || !Array.isArray(product.packings) || product.packings.length === 0) {
    return ''
  }

  const defaultPacking =
    product.packings.find((p) => p.isDefault && p.enabled !== false) ||
    product.packings.find((p) => p.unitType === 'Piece' && p.enabled !== false) ||
    product.packings.find((p) => p.enabled !== false)

  if (!defaultPacking || !defaultPacking.unitType || !defaultPacking.qty) return ''

  const perUnit = Number(defaultPacking.qty) || 0
  if (!perUnit) return ''

  const units = pieces / perUnit
  const unitLabel = defaultPacking.unitType

  if (!Number.isFinite(units) || units <= 0) return ''

  const displayUnits = Number.isInteger(units) ? units : units.toFixed(2)
  return `${displayUnits} ${unitLabel}`
}

function ProductListPage({ showActions = true, title = 'Product List', salesView = false }) {
  const [filters, setFilters] = useState({
    category: 'all',
    subcategory: 'all',
    brand: 'all',
    location: '',
    productId: '',
    productName: '',
    barcode: '',
    status: salesView ? 'Active' : 'all',
    vendor: 'all',
    fromExpiryDate: '',
    toExpiryDate: '',
  })

  const [pageSize, setPageSize] = useState('10') // '10' | '50' | '100' | 'all'
  const [offset, setOffset] = useState(0)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const subcategoryOptions = useMemo(() => {
    if (filters.category === 'all') return ['all']
    return CATEGORY_OPTIONS[filters.category] || ['all']
  }, [filters.category])

  useEffect(() => {
    if (!subcategoryOptions.includes(filters.subcategory)) {
      setFilters((f) => ({ ...f, subcategory: 'all' }))
    }
  }, [subcategoryOptions, filters.subcategory])

  const buildQuery = (nextOffset) => {
    const params = new URLSearchParams()
    params.set('limit', pageSize)
    params.set('offset', String(nextOffset))

    Object.entries(filters).forEach(([k, v]) => {
      if (v === '' || v == null) return
      if (v === 'all') return
      // vendor is not stored yet; keep UI but don't send for now
      if (k === 'vendor') return
      if (salesView && ['status', 'vendor', 'fromExpiryDate', 'toExpiryDate'].includes(k)) return
      params.set(k, String(v))
    })
    if (salesView) params.set('status', 'Active')

    return `/api/products?${params.toString()}`
  }

  const fetchPage = async ({ reset }) => {
    setError('')
    setLoading(true)
    try {
      const nextOffset = reset ? 0 : offset
      const res = await api.get(buildQuery(nextOffset))
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to load products')

      const nextItems = Array.isArray(data.items) ? data.items : []
      setTotal(Number(data.total) || 0)
      setOffset(nextOffset + nextItems.length)
      setItems((prev) => (reset ? nextItems : [...prev, ...nextItems]))
    } catch (e) {
      setError(e.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPage({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize])

  const handleChange = (field) => (e) => {
    setFilters((f) => ({ ...f, [field]: e.target.value }))
  }

  const canLoadMore = false

  return (
    <div className="product-list-page">
      <div className="product-list-header">
        <div className="product-list-title">{title}</div>
      </div>

      <div className="product-list-filters">
        <select value={filters.category} onChange={handleChange('category')}>
          <option value="all">All Category</option>
          {Object.keys(CATEGORY_OPTIONS)
            .filter((k) => k !== 'all')
            .map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
        </select>

        <select value={filters.subcategory} onChange={handleChange('subcategory')} disabled={filters.category === 'all'}>
          <option value="all">All Subcategory</option>
          {subcategoryOptions
            .filter((s) => s !== 'all')
            .map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
        </select>

        <select value={filters.brand} onChange={handleChange('brand')}>
          <option value="all">All Brand</option>
        </select>

        <input placeholder="Location" value={filters.location} onChange={handleChange('location')} />

        <input placeholder="Product ID" value={filters.productId} onChange={handleChange('productId')} />
        <input placeholder="Product Name" value={filters.productName} onChange={handleChange('productName')} />
        <input placeholder="Barcode" value={filters.barcode} onChange={handleChange('barcode')} />

        {!salesView && (
          <select value={filters.status} onChange={handleChange('status')}>
            <option value="all">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        )}

        {!salesView && (
          <select value={filters.vendor} onChange={handleChange('vendor')}>
            <option value="all">All Vendor</option>
          </select>
        )}

        {!salesView && <input type="date" placeholder="From Expiry Date" value={filters.fromExpiryDate} onChange={handleChange('fromExpiryDate')} />}
        {!salesView && <input type="date" placeholder="To Expiry Date" value={filters.toExpiryDate} onChange={handleChange('toExpiryDate')} />}

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
                {showActions && <th>Action</th>}
                <th>Product ID</th>
                <th>Category</th>
                <th>Subcategory</th>
                <th>Product Name</th>
                <th>Brand</th>
                <th>Stock</th>
                <th>Re Order</th>
                <th>Image</th>
                {!salesView && <th>Status</th>}
                {!salesView && <th>Comm.</th>}
                {!salesView && <th>Expiry</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p._id}>
                  {showActions && (
                    <td>
                      <div className="product-list-actions" title="Edit / Print">
                        <IconButton
                          title="Edit"
                          onClick={() => {
                            window.location.href = `/products/edit/${p._id}`
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          title="Print label"
                          onClick={() => {
                            window.open(
                              `/products/print/${p._id}`,
                              '_blank',
                              'noopener,noreferrer,width=900,height=700',
                            )
                          }}
                        >
                          <PrintIcon />
                        </IconButton>
                      </div>
                    </td>
                  )}
                  <td>{p.productId}</td>
                  <td>{p.category}</td>
                  <td>{p.subcategory}</td>
                  <td>{p.productName}</td>
                  <td>{p.brand}</td>
                  <td>
                    <div>{typeof p.currentStock === 'number' ? p.currentStock : 0}</div>
                    {formatDefaultUnitStock(p) && (
                      <div className="text-muted small">{formatDefaultUnitStock(p)}</div>
                    )}
                  </td>
                  <td>{p.reorderMark ?? '-'}</td>
                  <td>
                    <img
                      className="product-list-img"
                      alt=""
                      src={
                        p.imageFileName
                          ? `/api/uploads/products/${p.imageFileName}`
                          : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='35' height='35'%3E%3Crect width='35' height='35' fill='%23e5e7eb'/%3E%3C/svg%3E"
                      }
                    />
                  </td>
                  {!salesView && (
                    <td>
                      <span className="product-list-status" style={{ background: p.isActive === false ? '#e5e7eb' : '#2ecc71', color: p.isActive === false ? '#374151' : '#fff' }}>
                        {p.isActive === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                  )}
                  {!salesView && <td>{Number(p.commissionPercent || 0).toFixed(2)}%</td>}
                  {!salesView && <td>{formatExpiry(p.expiryDate)}</td>}
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={showActions ? (salesView ? 9 : 12) : (salesView ? 8 : 11)} className="text-center text-muted">
                    {loading ? 'Loading...' : 'No products found'}
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

export default ProductListPage

