import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Table } from 'react-bootstrap'
import { api } from '../../api/api'
import { useAuth } from '../../context/AuthContext'

const statusBadge = (s) => {
  if (s === 'active') return 'success'
  if (s === 'pending') return 'warning'
  return 'secondary'
}

function CustomerDetailsPage() {
  const { id } = useParams()
  const { user } = useAuth()

  const [customer, setCustomer] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const role = user?.role || ''
  const isManager = role === 'sales_manager' || role === 'admin'
  const [activeTab, setActiveTab] = useState('orders')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      api.get(`/api/sales/customers/${id}`).then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.message || 'Failed to load customer')
        return data
      }),
      api.get('/api/sales/orders').then(async (res) => {
        const data = await res.json().catch(() => [])
        return Array.isArray(data) ? data : []
      }),
    ])
      .then(([cust, allOrders]) => {
        setCustomer(cust)
        const related = allOrders.filter((o) => {
          const cid = o.customer?._id || o.customer
          return String(cid) === String(cust._id)
        })
        setOrders(related)
        setError('')
      })
      .catch((e) => {
        setError(e.message || 'Failed to load customer')
      })
      .finally(() => setLoading(false))
  }, [id])

  const formatMoney = (v) => {
    const n = Number(v) || 0
    return n.toFixed(2)
  }

  const formatDate = (dateValue) => {
    if (!dateValue) return '-'
    const d = new Date(dateValue)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleDateString()
  }

  const totalOrderAmount = orders.reduce((sum, o) => sum + (Number(o.orderTotal) || 0), 0)
  const totalPaidAmount = 0 // Placeholder until payments are wired
  const totalDueAmount = Math.max(0, totalOrderAmount - totalPaidAmount)

  const TABS = useMemo(() => {
    if (isManager) {
      return [
        { id: 'orders', label: 'Order List' },
        { id: 'due', label: 'Due Payment' },
        { id: 'credit', label: 'Credit Memo' },
        { id: 'payments', label: 'Payment History' },
        { id: 'collection', label: 'Collection Details' },
        { id: 'bank', label: 'Bank Details' },
        { id: 'contacts', label: 'Contacts' },
        { id: 'address', label: 'Address Info' },
        { id: 'note', label: 'Note' },
      ]
    }
    return [
      { id: 'orders', label: 'Order List' },
      { id: 'due', label: 'Due Payment' },
      { id: 'address', label: 'Address Info' },
      { id: 'note', label: 'Note' },
    ]
  }, [isManager])

  if (loading) {
    return <p className="text-muted">Loading customer details…</p>
  }

  if (error) {
    return (
      <div>
        <p className="text-danger mb-3">{error}</p>
        <Link to="/sales/customers" className="btn btn-secondary btn-sm">
          Back
        </Link>
      </div>
    )
  }

  if (!customer) {
    return (
      <div>
        <p className="text-muted mb-3">Customer not found.</p>
        <Link to="/sales/customers" className="btn btn-secondary btn-sm">
          Back
        </Link>
      </div>
    )
  }

  return (
    <div className="product-list-page vendor-details-page">
      <div className="vendor-details-header">
        <h1 className="vendor-details-title">Customer Details</h1>
        <div className="vendor-details-actions">
          <Link to="/sales/customers" className="vendor-details-btn vendor-details-btn-secondary">
            Back to list
          </Link>
        </div>
      </div>

      {/* Top info grid */}
      <div className="vendor-details-info-card">
        <div className="vendor-details-grid">
          <div className="vendor-details-field">
            <span className="vendor-details-label">Customer ID</span>
            <span className="vendor-details-value">{customer.customerNumber || '-'}</span>
          </div>
          <div className="vendor-details-field">
            <span className="vendor-details-label">Customer Name</span>
            <span className="vendor-details-value">{customer.customerName || '-'}</span>
          </div>
          <div className="vendor-details-field">
            <span className="vendor-details-label">Status</span>
            <span className="vendor-details-value">
              <Badge bg={statusBadge(customer.status)} className="text-uppercase">
                {customer.status || 'pending'}
              </Badge>
            </span>
          </div>
          <div className="vendor-details-field">
            <span className="vendor-details-label">Price level</span>
            <span className="vendor-details-value">{customer.priceLevelCode || '-'}</span>
          </div>
          <div className="vendor-details-field">
            <span className="vendor-details-label">Store Contact Person</span>
            <span className="vendor-details-value">{customer.contactName || '-'}</span>
          </div>
          <div className="vendor-details-field">
            <span className="vendor-details-label">Customer Type</span>
            <span className="vendor-details-value">{customer.customerType || '-'}</span>
          </div>
          <div className="vendor-details-field">
            <span className="vendor-details-label">Store Credit</span>
            <span className="vendor-details-value">0.00</span>
          </div>
          <div className="vendor-details-field">
            <span className="vendor-details-label">Sales Person</span>
        <span className="vendor-details-value">
          {customer.salesPerson && customer.salesPerson.name
            ? customer.salesPerson.name
            : customer.salesPerson && customer.salesPerson.username
              ? customer.salesPerson.username
              : '-'}
        </span>
          </div>
          <div className="vendor-details-field">
            <span className="vendor-details-label">Due Amount</span>
            <span className="vendor-details-value">{formatMoney(totalDueAmount)}</span>
          </div>
          {isManager && (
            <div className="vendor-details-field">
              <span className="vendor-details-label">Customer Discount</span>
              <span className="vendor-details-value">0.00%</span>
            </div>
          )}
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
          {/* Orders */}
          {activeTab === 'orders' && (
            <div className="vendor-details-table-wrap overflow-auto">
              <Table className="product-list-table mb-0">
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="text-end">Items</th>
                    <th className="text-end">Payable Amount</th>
                    <th className="text-end">Paid Amount</th>
                    <th className="text-end">Due Amount</th>
                    <th>Delivery Date</th>
                    {isManager && <th>Sales Person</th>}
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={isManager ? 9 : 8} className="text-center text-muted">
                        No data available
                      </td>
                    </tr>
                  )}
                  {orders.map((o) => (
                    <tr key={o._id}>
                      <td>{o.orderNumber || '-'}</td>
                      <td>{formatDate(o.orderDate)}</td>
                      <td className="text-capitalize">{o.status || 'new'}</td>
                      <td className="text-end">{Array.isArray(o.lineItems) ? o.lineItems.length : 0}</td>
                      <td className="text-end">{formatMoney(o.orderTotal)}</td>
                      <td className="text-end">0.00</td>
                      <td className="text-end">{formatMoney(o.orderTotal)}</td>
                      <td>{formatDate(o.deliveryDate)}</td>
                      {isManager && (
                        <td className="small text-muted">
                          {o.salesPerson && o.salesPerson.name
                            ? o.salesPerson.name
                            : o.salesPerson && o.salesPerson.username
                              ? o.salesPerson.username
                              : '-'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={isManager ? 4 : 3} className="fw-semibold text-end">
                      Total
                    </td>
                    <td className="fw-semibold text-end">{formatMoney(totalOrderAmount)}</td>
                    <td className="fw-semibold text-end">{formatMoney(totalPaidAmount)}</td>
                    <td className="fw-semibold text-end">{formatMoney(totalDueAmount)}</td>
                    <td colSpan={isManager ? 2 : 1} />
                  </tr>
                </tfoot>
              </Table>
            </div>
          )}

          {/* Due Payment */}
          {activeTab === 'due' && (
            <div className="vendor-details-table-wrap overflow-auto">
              <Table className="product-list-table mb-0">
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Order Type</th>
                    <th>Order Date</th>
                    <th className="text-end">Days</th>
                    <th className="text-end">Order Amount</th>
                    <th className="text-end">Paid Amount</th>
                    <th className="text-end">Due Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted">
                        No data available
                      </td>
                    </tr>
                  )}
                  {orders.map((o) => {
                    const days = o.orderDate
                      ? Math.max(
                          0,
                          Math.ceil((Date.now() - new Date(o.orderDate).getTime()) / (1000 * 60 * 60 * 24)),
                        )
                      : 0
                    return (
                      <tr key={o._id}>
                        <td>{o.orderNumber || '-'}</td>
                        <td className="text-capitalize">{o.status || '-'}</td>
                        <td>{formatDate(o.orderDate)}</td>
                        <td className="text-end">{days}</td>
                        <td className="text-end">{formatMoney(o.orderTotal)}</td>
                        <td className="text-end">0.00</td>
                        <td className="text-end">{formatMoney(o.orderTotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="fw-semibold text-end">
                      Total
                    </td>
                    <td className="fw-semibold text-end">{formatMoney(totalOrderAmount)}</td>
                    <td className="fw-semibold text-end">{formatMoney(totalPaidAmount)}</td>
                    <td className="fw-semibold text-end">{formatMoney(totalDueAmount)}</td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          )}

          {/* Credit Memo */}
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
                    <td className="text-center text-muted">We will add Credit Memo data later.</td>
                  </tr>
                </tbody>
              </Table>
            </div>
          )}

          {/* Payment History */}
          {activeTab === 'payments' && (
            <div className="vendor-details-table-wrap overflow-auto">
              <Table className="product-list-table mb-0">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Payment ID</th>
                    <th>Payment Date</th>
                    <th>Payment Mode</th>
                    <th className="text-end">Total Paid Amount</th>
                    <th className="text-end">Short Amount</th>
                    <th>Received Payment By</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={7} className="text-center text-muted">We will add Payment History later.</td>
                  </tr>
                </tbody>
              </Table>
            </div>
          )}

          {/* Collection Details */}
          {activeTab === 'collection' && (
            <div className="vendor-details-table-wrap overflow-auto">
              <Table className="product-list-table mb-0">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Pay ID</th>
                    <th>Receive Date</th>
                    <th>Status</th>
                    <th>Collect By</th>
                    <th className="text-end">Receive Amount</th>
                    <th>Payment Mode</th>
                    <th>Reference ID</th>
                    <th>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={9} className="text-center text-muted">We will add Collection Details later.</td>
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
                    <th>Bank Details</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-center text-muted">Same as Vendor bank details page.</td>
                  </tr>
                </tbody>
              </Table>
            </div>
          )}

          {/* Contacts */}
          {activeTab === 'contacts' && (
            <div className="vendor-details-table-wrap overflow-auto">
              <Table className="product-list-table mb-0">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Contact Person</th>
                    <th>Mobile</th>
                    <th>Fax</th>
                    <th>Email</th>
                    <th>Is Default</th>
                  </tr>
                </thead>
                <tbody>
                  {(customer.contacts || []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted">
                        No contacts recorded
                      </td>
                    </tr>
                  )}
                  {(customer.contacts || []).map((c, idx) => (
                    <tr key={`${c.personName}-${idx}`}>
                      <td>{c.labelType || 'Store'}</td>
                      <td>{c.personName || '-'}</td>
                      <td>{c.mobileNo || '-'}</td>
                      <td>{c.faxNo || '-'}</td>
                      <td className="small text-muted">{c.email || '-'}</td>
                      <td>{c.isDefault ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          {/* Address Info */}
          {activeTab === 'address' && (
            <div className="vendor-details-table-wrap overflow-auto">
              <Table className="product-list-table mb-0">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Billing Address</th>
                    <th>Shipping Address</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Address 1</td>
                    <td>{customer.billingAddress?.address1 || '-'}</td>
                    <td>{customer.shippingAddress?.address1 || '-'}</td>
                  </tr>
                  <tr>
                    <td>Address 2</td>
                    <td>{customer.billingAddress?.address2 || '-'}</td>
                    <td>{customer.shippingAddress?.address2 || '-'}</td>
                  </tr>
                  <tr>
                    <td>Zip Code</td>
                    <td>{customer.billingAddress?.zipCode || '-'}</td>
                    <td>{customer.shippingAddress?.zipCode || '-'}</td>
                  </tr>
                  <tr>
                    <td>State</td>
                    <td>{customer.billingAddress?.state || '-'}</td>
                    <td>{customer.shippingAddress?.state || '-'}</td>
                  </tr>
                  <tr>
                    <td>City</td>
                    <td>{customer.billingAddress?.city || '-'}</td>
                    <td>{customer.shippingAddress?.city || '-'}</td>
                  </tr>
                </tbody>
              </Table>
              {isManager && (
                <div className="small text-muted mt-2">
                  Sales manager can edit billing/shipping defaults (UI to be added).
                </div>
              )}
            </div>
          )}

          {/* Note */}
          {activeTab === 'note' && (
            <div className="vendor-details-table-wrap overflow-auto">
              <Table className="product-list-table mb-0">
                <thead>
                  <tr>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{customer.remark || customer.extraNotes || 'No notes recorded.'}</td>
                  </tr>
                </tbody>
              </Table>
              {isManager && (
                <div className="small text-muted mt-2">
                  Sales manager can edit the note (UI to be added).
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CustomerDetailsPage

