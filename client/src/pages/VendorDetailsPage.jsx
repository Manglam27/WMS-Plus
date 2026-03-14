import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Table } from 'react-bootstrap'
import { api } from '../api/api'

const TABS = [
  { id: 'received', label: 'Received Invoice' },
  { id: 'payment', label: 'Payment History' },
  { id: 'bank', label: 'Bank Details' },
  { id: 'credit', label: 'Credit Memo Details (we will add this later on.)' },
]

function formatDate(dateValue) {
  if (!dateValue) return '-'
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

function formatMoney(value) {
  if (value == null || value === '') return '0'
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function VendorDetailsPage() {
  const { id } = useParams()
  const [vendor, setVendor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [activeTab, setActiveTab] = useState('received') // default: Received Invoice

  // Payment History filters
  const [paymentFrom, setPaymentFrom] = useState('')
  const [paymentTo, setPaymentTo] = useState('')

  // Bank details (local state – no API yet)
  const [bankRows, setBankRows] = useState([])
  const [bankEdit, setBankEdit] = useState({ bankName: '', routingNo: '', bankAc: '', note: '' })
  const [bankEditingId, setBankEditingId] = useState(null)

  // Card details (local state)
  const [cardRows, setCardRows] = useState([])
  const [cardEdit, setCardEdit] = useState({ cardType: '', cardNo: '', expiryDate: '', cvv: '', zipcode: '', note: '' })
  const [cardEditingId, setCardEditingId] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!id) return
    api
      .get(`/api/vendors/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setVendor(data)
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load vendor')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  const addressLine =
    vendor
      ? [vendor.address1, vendor.address2, [vendor.city, vendor.state, vendor.zipCode].filter(Boolean).join(', '), vendor.country]
          .filter(Boolean)
          .join(' ')
      : ''

  const handleSaveBank = () => {
    const { bankName, routingNo, bankAc, note } = bankEdit
    if (!bankName.trim()) return
    if (bankEditingId !== null) {
      setBankRows((prev) =>
        prev.map((r) =>
          r.id === bankEditingId ? { ...r, bankName, routingNo, bankAc, note } : r,
        ),
      )
      setBankEditingId(null)
    } else {
      setBankRows((prev) => [...prev, { id: Date.now(), bankName, routingNo, bankAc, note }])
    }
    setBankEdit({ bankName: '', routingNo: '', bankAc: '', note: '' })
  }

  const handleDeleteBank = (rowId) => {
    setBankRows((prev) => prev.filter((r) => r.id !== rowId))
    if (bankEditingId === rowId) {
      setBankEditingId(null)
      setBankEdit({ bankName: '', routingNo: '', bankAc: '', note: '' })
    }
  }

  const handleEditBank = (row) => {
    setBankEdit({ bankName: row.bankName, routingNo: row.routingNo, bankAc: row.bankAc, note: row.note })
    setBankEditingId(row.id)
  }

  const handleSaveCard = () => {
    const { cardType, cardNo, expiryDate, cvv, zipcode, note } = cardEdit
    if (!cardNo.trim()) return
    if (cardEditingId !== null) {
      setCardRows((prev) =>
        prev.map((r) =>
          r.id === cardEditingId ? { ...r, cardType, cardNo, expiryDate, cvv, zipcode, note } : r,
        ),
      )
      setCardEditingId(null)
    } else {
      setCardRows((prev) => [...prev, { id: Date.now(), cardType, cardNo, expiryDate, cvv, zipcode, note }])
    }
    setCardEdit({ cardType: '', cardNo: '', expiryDate: '', cvv: '', zipcode: '', note: '' })
  }

  const handleDeleteCard = (rowId) => {
    setCardRows((prev) => prev.filter((r) => r.id !== rowId))
    if (cardEditingId === rowId) {
      setCardEditingId(null)
      setCardEdit({ cardType: '', cardNo: '', expiryDate: '', cvv: '', zipcode: '', note: '' })
    }
  }

  const handleEditCard = (row) => {
    setCardEdit({
      cardType: row.cardType,
      cardNo: row.cardNo,
      expiryDate: row.expiryDate,
      cvv: row.cvv,
      zipcode: row.zipcode,
      note: row.note,
    })
    setCardEditingId(row.id)
  }

  if (loading) return <div className="p-3">Loading...</div>
  if (error || !vendor) return <div className="p-3 text-danger">{error || 'Vendor not found'}</div>

  return (
    <div className="product-list-page vendor-details-page">
      <div className="vendor-details-header">
        <h1 className="vendor-details-title">Vendor Details</h1>
        <div className="vendor-details-actions">
          <Link to="/vendors/list" className="vendor-details-btn vendor-details-btn-secondary">
            Back to list
          </Link>
          <Link to={`/vendors/edit/${id}`} className="vendor-details-btn vendor-details-btn-primary">
            Edit
          </Link>
        </div>
      </div>

      {/* Top info grid */}
      <div className="vendor-details-info-card">
        <div className="vendor-details-grid">
          <div className="vendor-details-field">
            <span className="vendor-details-label">Vendor ID</span>
            <span className="vendor-details-value">{vendor.vendorId || '-'}</span>
          </div>
          <div className="vendor-details-field">
            <span className="vendor-details-label">Vendor Name</span>
            <span className="vendor-details-value">{vendor.vendorName || '-'}</span>
          </div>
          <div className="vendor-details-field">
            <span className="vendor-details-label">Contact Person</span>
            <span className="vendor-details-value">{vendor.contactPerson || '-'}</span>
          </div>
          <div className="vendor-details-field">
            <span className="vendor-details-label">Phone No</span>
            <span className="vendor-details-value">{vendor.phoneNo || vendor.cell || '-'}</span>
          </div>
          <div className="vendor-details-field">
            <span className="vendor-details-label">Email</span>
            <span className="vendor-details-value">{vendor.emailId || '-'}</span>
          </div>
          <div className="vendor-details-field">
            <span className="vendor-details-label">Due Amount</span>
            <span className="vendor-details-value">{formatMoney(vendor.dueAmount)}</span>
          </div>
          <div className="vendor-details-field">
            <span className="vendor-details-label">Status</span>
            <span className={`vendor-details-status vendor-details-status--${(vendor.status || 'Active').toLowerCase()}`}>
              {vendor.status || 'Active'}
            </span>
          </div>
          <div className="vendor-details-field">
            <span className="vendor-details-label">Address</span>
            <span className="vendor-details-value vendor-details-value--block">{addressLine || '-'}</span>
          </div>
          <div className="vendor-details-field">
            <span className="vendor-details-label">Vendor Credit</span>
            <span className="vendor-details-value">{formatMoney(vendor.vendorCredit)}</span>
          </div>
        </div>
      </div>

      {/* Single table area with tabs */}
      <div className="vendor-details-table-card">
        <div className="vendor-details-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`vendor-details-tab ${activeTab === tab.id ? 'vendor-details-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="vendor-details-tab-content">
          {/* Received Invoice – default */}
          {activeTab === 'received' && (
            <div className="vendor-details-table-wrap overflow-auto">
              <Table className="product-list-table mb-0">
                <thead>
                  <tr>
                    <th>Vendor Invoice No.</th>
                    <th>Invoice Date</th>
                    <th>No. of Items</th>
                    <th>Total Amount</th>
                    <th>Paid Amount</th>
                    <th>Due Amount</th>
                    <th>Received By</th>
                    <th>Received Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={8} className="text-center text-muted">No data available</td>
                  </tr>
                </tbody>
              </Table>
            </div>
          )}

          {/* Payment History */}
          {activeTab === 'payment' && (
            <div className="vendor-details-table-wrap overflow-auto">
              <div className="vendor-details-filters d-flex flex-wrap gap-2 align-items-center mb-3">
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 'auto' }}
                  value={paymentFrom}
                  onChange={(e) => setPaymentFrom(e.target.value)}
                />
                <span className="text-muted small">Payment From Date</span>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 'auto' }}
                  value={paymentTo}
                  onChange={(e) => setPaymentTo(e.target.value)}
                />
                <span className="text-muted small">Payment To Date</span>
                <button type="button" className="btn btn-sm btn-outline-primary">All Payment</button>
              </div>
              <Table className="product-list-table mb-0">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Payment ID</th>
                    <th>Payment Date</th>
                    <th>Payment Mode</th>
                    <th>Payment Amount</th>
                    <th>No. of Invoice</th>
                    <th>Status</th>
                    <th>Paid By</th>
                    <th>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={9} className="text-center text-muted">No data available</td>
                  </tr>
                </tbody>
              </Table>
            </div>
          )}

          {/* Bank Details */}
          {activeTab === 'bank' && (
            <div className="vendor-details-table-wrap overflow-auto">
              <Table className="product-list-table mb-0">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Bank Name</th>
                    <th>Routing No.</th>
                    <th>Bank A/C</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {bankRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted">No data available</td>
                    </tr>
                  )}
                  {bankRows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <button type="button" className="btn btn-sm btn-link p-0 me-1" onClick={() => handleEditBank(r)}>Edit</button>
                        <button type="button" className="btn btn-sm btn-link p-0 text-danger" onClick={() => handleDeleteBank(r.id)}>Delete</button>
                      </td>
                      <td>{r.bankName}</td>
                      <td>{r.routingNo}</td>
                      <td>{r.bankAc}</td>
                      <td>{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="vendor-details-add-section">
                <p className="vendor-details-add-label">Add bank details</p>
                <div className="d-flex flex-wrap gap-2 align-items-end">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Bank Name"
                    value={bankEdit.bankName}
                    onChange={(e) => setBankEdit((p) => ({ ...p, bankName: e.target.value }))}
                    style={{ maxWidth: 140 }}
                  />
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Routing No."
                    value={bankEdit.routingNo}
                    onChange={(e) => setBankEdit((p) => ({ ...p, routingNo: e.target.value }))}
                    style={{ maxWidth: 120 }}
                  />
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Bank A/C"
                    value={bankEdit.bankAc}
                    onChange={(e) => setBankEdit((p) => ({ ...p, bankAc: e.target.value }))}
                    style={{ maxWidth: 140 }}
                  />
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Note"
                    value={bankEdit.note}
                    onChange={(e) => setBankEdit((p) => ({ ...p, note: e.target.value }))}
                    style={{ maxWidth: 120 }}
                  />
                  <button type="button" className="btn btn-sm btn-primary" onClick={handleSaveBank}>
                    {bankEditingId ? 'Update' : 'Save'}
                  </button>
                </div>
              </div>
              <p className="vendor-details-add-label mt-3 mb-1">Add card details</p>
              <Table className="product-list-table mt-2 mb-0">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Card Type</th>
                    <th>Card No</th>
                    <th>Expiry Date</th>
                    <th>CVV</th>
                    <th>Zipcode</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {cardRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted">No data available</td>
                    </tr>
                  )}
                  {cardRows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <button type="button" className="btn btn-sm btn-link p-0 me-1" onClick={() => handleEditCard(r)}>Edit</button>
                        <button type="button" className="btn btn-sm btn-link p-0 text-danger" onClick={() => handleDeleteCard(r.id)}>Delete</button>
                      </td>
                      <td>{r.cardType}</td>
                      <td>{r.cardNo}</td>
                      <td>{r.expiryDate}</td>
                      <td>{r.cvv}</td>
                      <td>{r.zipcode}</td>
                      <td>{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="vendor-details-add-section">
                <p className="vendor-details-add-label">Add card details</p>
                <div className="d-flex flex-wrap gap-2 align-items-end">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Card Type"
                    value={cardEdit.cardType}
                    onChange={(e) => setCardEdit((p) => ({ ...p, cardType: e.target.value }))}
                    style={{ maxWidth: 100 }}
                  />
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Card No"
                    value={cardEdit.cardNo}
                    onChange={(e) => setCardEdit((p) => ({ ...p, cardNo: e.target.value }))}
                    style={{ maxWidth: 140 }}
                  />
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Expiry Date"
                    value={cardEdit.expiryDate}
                    onChange={(e) => setCardEdit((p) => ({ ...p, expiryDate: e.target.value }))}
                    style={{ maxWidth: 100 }}
                  />
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="CVV"
                    value={cardEdit.cvv}
                    onChange={(e) => setCardEdit((p) => ({ ...p, cvv: e.target.value }))}
                    style={{ maxWidth: 60 }}
                  />
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Zipcode"
                    value={cardEdit.zipcode}
                    onChange={(e) => setCardEdit((p) => ({ ...p, zipcode: e.target.value }))}
                    style={{ maxWidth: 80 }}
                  />
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Note"
                    value={cardEdit.note}
                    onChange={(e) => setCardEdit((p) => ({ ...p, note: e.target.value }))}
                    style={{ maxWidth: 100 }}
                  />
                  <button type="button" className="btn btn-sm btn-primary" onClick={handleSaveCard}>
                    {cardEditingId ? 'Update' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Credit Memo Details */}
          {activeTab === 'credit' && (
            <div className="vendor-details-table-wrap overflow-auto">
              <Table className="product-list-table mb-0">
                <thead>
                  <tr>
                    <th>Credit Memo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-center text-muted">We will add this later.</td>
                  </tr>
                </tbody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default VendorDetailsPage
