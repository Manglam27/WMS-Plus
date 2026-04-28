import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Col, Form, Row, Table } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/api'
import { useAuth } from '../../context/AuthContext'

const CUSTOMER_TYPES = ['Retail', 'Wholesale']
const TERMS_OPTIONS = ['30 days', 'COD', 'ACH']
const CONTACT_PERSON_TYPES = ['Owner', 'Manager', 'Worker']

function NewCustomerPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isManager = user?.role === 'sales_manager' || user?.role === 'admin'
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState([])
  const [salesPeople, setSalesPeople] = useState([])

  const [form, setForm] = useState({
    customerName: '',
    customerType: 'Retail',
    status: 'pending',
    taxId: '',
    terms: '',
    businessName: '',
    otpLicence: '',
    storeOpenTime: '',
    storeCloseTime: '',
    remark: '',
    billingAddress: {
      address1: '',
      address2: '',
      zipCode: '',
      state: '',
      city: '',
    },
    shippingSameAsBilling: true,
    shippingAddress: {
      address1: '',
      address2: '',
      zipCode: '',
      state: '',
      city: '',
    },
    contacts: [
      {
        labelType: 'Main',
        personName: '',
        personType: 'Owner',
        email: '',
        mobileNo: '',
        faxNo: '',
        isDefault: true,
      },
    ],
    priceLevelMode: 'auto',
    matchedCustomerId: '',
    customPriceLevelName: '',
    extraNotes: '',
    salesPersonId: '',
  })

  useEffect(() => {
    api
      .get('/api/sales/customers')
      .then(async (res) => {
        const data = await res.json().catch(() => [])
        if (res.ok && Array.isArray(data)) setCustomers(data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isManager) return
    api
      .get('/api/sales/salespeople')
      .then(async (res) => {
        const data = await res.json().catch(() => [])
        if (res.ok && Array.isArray(data)) setSalesPeople(data)
      })
      .catch(() => {})
  }, [isManager])

  const handleChange = (field) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({ ...prev, [field]: v }))
  }

  const updateBilling = (field) => async (e) => {
    const v = e.target.value
    setForm((prev) => {
      const next = { ...prev, billingAddress: { ...prev.billingAddress, [field]: v } }
      if (prev.shippingSameAsBilling) {
        next.shippingAddress = { ...next.billingAddress }
      }
      return next
    })
    if (field === 'address1') {
      const list = await searchAddress(v).catch(() => [])
      setBillingSuggestions(list)
      setShowBillingSuggestions(true)
    }
  }

  const [billingSuggestions, setBillingSuggestions] = useState([])
  const [shippingSuggestions, setShippingSuggestions] = useState([])
  const [showBillingSuggestions, setShowBillingSuggestions] = useState(false)
  const [showShippingSuggestions, setShowShippingSuggestions] = useState(false)

  const searchAddress = async (query) => {
    const q = String(query || '').trim()
    if (q.length < 4) return []
    const res = await api.get(`/api/sales/address/search?q=${encodeURIComponent(q)}`)
    const data = await res.json().catch(() => ({}))
    const items = (Array.isArray(data.items) ? data.items : []).filter(
      (x) => String(x.country_code || '').toLowerCase() === 'us',
    )
    return items
  }

  const applyAddressResult = (which, result) => {
    const addr = result?.address || {}
    const next = {
      address1: result?.display_name || '',
      address2: '',
      zipCode: addr.postcode || '',
      state: addr.state || addr.region || '',
      city: addr.city || addr.town || addr.village || '',
    }
    if (which === 'billing') {
      setForm((prev) => {
        const updated = { ...prev, billingAddress: { ...prev.billingAddress, ...next } }
        if (prev.shippingSameAsBilling) updated.shippingAddress = { ...updated.billingAddress }
        return updated
      })
      setBillingSuggestions([])
      setShowBillingSuggestions(false)
    } else {
      setForm((prev) => ({ ...prev, shippingAddress: { ...prev.shippingAddress, ...next } }))
      setShippingSuggestions([])
      setShowShippingSuggestions(false)
    }
  }

  const updateShipping = (field) => async (e) => {
    const v = e.target.value
    setForm((prev) => ({ ...prev, shippingAddress: { ...prev.shippingAddress, [field]: v } }))
    if (field === 'address1') {
      const list = await searchAddress(v).catch(() => [])
      setShippingSuggestions(list)
      setShowShippingSuggestions(true)
    }
  }

  const updateBillingZip = (e) => {
    const digits = String(e.target.value || '').replace(/\D/g, '')
    setForm((prev) => {
      const next = { ...prev, billingAddress: { ...prev.billingAddress, zipCode: digits } }
      if (prev.shippingSameAsBilling) next.shippingAddress = { ...next.billingAddress }
      return next
    })
  }

  const updateShippingZip = (e) => {
    const digits = String(e.target.value || '').replace(/\D/g, '')
    setForm((prev) => ({ ...prev, shippingAddress: { ...prev.shippingAddress, zipCode: digits } }))
  }

  const toggleSameAsBilling = (checked) => {
    setForm((prev) => ({
      ...prev,
      shippingSameAsBilling: checked,
      shippingAddress: checked ? { ...prev.billingAddress } : prev.shippingAddress,
    }))
  }

  const updateContact = (idx, field) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => (i === idx ? { ...c, [field]: v } : c)),
    }))
  }

  const addContact = () => {
    setForm((prev) => ({
      ...prev,
      contacts: [
        ...prev.contacts,
        { labelType: '', personName: '', personType: 'Owner', email: '', mobileNo: '', faxNo: '', isDefault: false },
      ],
    }))
  }

  const removeContact = (idx) => () => {
    setForm((prev) => ({ ...prev, contacts: prev.contacts.filter((_, i) => i !== idx) }))
  }

  const safeContacts = useMemo(() => (Array.isArray(form.contacts) ? form.contacts : []), [form.contacts])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const body = {
        customerName: form.customerName.trim(),
        customerType: form.customerType,
        taxId: form.taxId.trim(),
        terms: form.terms,
        businessName: form.businessName.trim(),
        otpLicence: form.otpLicence.trim(),
        storeOpenTime: form.storeOpenTime.trim(),
        storeCloseTime: form.storeCloseTime.trim(),
        remark: form.remark.trim(),
        billingAddress: form.billingAddress,
        shippingSameAsBilling: form.shippingSameAsBilling,
        shippingAddress: form.shippingSameAsBilling ? form.billingAddress : form.shippingAddress,
        contacts: safeContacts,
        priceLevelMode: form.priceLevelMode,
        matchedCustomerId: form.priceLevelMode === 'match' ? form.matchedCustomerId : undefined,
        customPriceLevelName: form.priceLevelMode === 'new' ? form.customPriceLevelName : undefined,
        extraNotes: form.extraNotes.trim(),
        salesPersonId: isManager ? form.salesPersonId : undefined,
        autoApprove: isManager ? true : undefined,
      }
      const res = await api.post('/api/sales/customers', body)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to submit customer request')
      setSuccess(
        isManager
          ? 'Customer created and approved successfully.'
          : 'Customer request submitted. It will appear as pending until approved.',
      )
      setTimeout(() => navigate('/sales/customers'), 1500)
    } catch (err) {
      setError(err.message || 'Failed to submit')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h2 className="mb-4">New Customer</h2>
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card className="mb-3">
        <Card.Header>Customer Details</Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Customer Name <span className="text-danger">*</span></Form.Label>
                  <Form.Control value={form.customerName} onChange={handleChange('customerName')} required />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Customer Type <span className="text-danger">*</span></Form.Label>
                  <Form.Select value={form.customerType} onChange={handleChange('customerType')} required>
                    {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Status</Form.Label>
                  <Form.Control
                    value={isManager ? 'Active (auto-approved by sales manager)' : 'Pending (awaiting approval)'}
                    readOnly
                    disabled
                  />
                </Form.Group>
              </Col>
              {isManager && (
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Associated Sales Person <span className="text-danger">*</span></Form.Label>
                    <Form.Select
                      value={form.salesPersonId}
                      onChange={handleChange('salesPersonId')}
                      required
                    >
                      <option value="">Select sales person</option>
                      {salesPeople.map((sp) => (
                        <option key={sp._id} value={sp._id}>
                          {sp.name || sp.username}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              )}
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Tax ID</Form.Label>
                  <Form.Control value={form.taxId} onChange={handleChange('taxId')} />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Terms <span className="text-danger">*</span></Form.Label>
                  <Form.Select value={form.terms} onChange={handleChange('terms')} required>
                    <option value="">- Select -</option>
                    {TERMS_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Business Name</Form.Label>
                  <Form.Control value={form.businessName} onChange={handleChange('businessName')} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>OTP Licence</Form.Label>
                  <Form.Control value={form.otpLicence} onChange={handleChange('otpLicence')} />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Store Open Time</Form.Label>
                  <Form.Control value={form.storeOpenTime} onChange={handleChange('storeOpenTime')} placeholder="e.g. 09:00 AM" />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Store Close Time</Form.Label>
                  <Form.Control value={form.storeCloseTime} onChange={handleChange('storeCloseTime')} placeholder="e.g. 09:00 PM" />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Remark</Form.Label>
                  <Form.Control as="textarea" rows={2} value={form.remark} onChange={handleChange('remark')} />
                </Form.Group>
              </Col>
            </Row>

            <hr className="my-4" />
            <h6 className="mb-3">Price level</h6>
            <Form.Group className="mb-3">
              <Form.Label>How should pricing be set?</Form.Label>
              <Form.Select value={form.priceLevelMode} onChange={handleChange('priceLevelMode')}>
                <option value="auto">Auto-generate (default)</option>
                <option value="match">Match another customer&apos;s price level</option>
                <option value="new">Define a new price level name</option>
              </Form.Select>
              <Form.Text className="text-muted">
                Auto-generate assigns a unique internal price level code. You can change this later if needed.
              </Form.Text>
            </Form.Group>

            {form.priceLevelMode === 'match' && (
              <Form.Group className="mb-3">
                <Form.Label>Match customer</Form.Label>
                <Form.Select
                  value={form.matchedCustomerId}
                  onChange={handleChange('matchedCustomerId')}
                  required={form.priceLevelMode === 'match'}
                >
                  <option value="">Select a customer</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.businessName} ({c.customerNumber || c._id}) — {c.priceLevelCode || 'N/A'}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}

            {form.priceLevelMode === 'new' && (
              <Form.Group className="mb-3">
                <Form.Label>New price level name</Form.Label>
                <Form.Control
                  value={form.customPriceLevelName}
                  onChange={handleChange('customPriceLevelName')}
                  placeholder="e.g. Wholesale Tier B"
                  required={form.priceLevelMode === 'new'}
                />
              </Form.Group>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Additional notes for the system</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={form.extraNotes}
                onChange={handleChange('extraNotes')}
                placeholder="Any other information you want saved with this customer"
                maxLength={2000}
              />
            </Form.Group>

            <hr className="my-4" />
            <h6 className="mb-3">Billing Details</h6>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Address 1 <span className="text-danger">*</span></Form.Label>
                  <div style={{ position: 'relative' }}>
                    <Form.Control
                      value={form.billingAddress.address1}
                      onChange={updateBilling('address1')}
                      onFocus={() => setShowBillingSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowBillingSuggestions(false), 150)}
                      placeholder="Enter a location"
                      required
                      autoComplete="off"
                    />
                    {showBillingSuggestions && billingSuggestions.length > 0 && (
                      <div
                        className="border rounded bg-white"
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 50,
                          maxHeight: 220,
                          overflowY: 'auto',
                        }}
                      >
                        {billingSuggestions.map((r) => (
                          <button
                            key={r.place_id}
                            type="button"
                            className="btn btn-link text-start w-100 py-2 px-2"
                            style={{ textDecoration: 'none', color: '#111827' }}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applyAddressResult('billing', r)}
                          >
                            <div className="small">{r.display_name}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Address 2</Form.Label>
                  <Form.Control value={form.billingAddress.address2} onChange={updateBilling('address2')} placeholder="Suite/Apartment" />
                </Form.Group>
              </Col>
              <Col md={3}><Form.Group><Form.Label>Zip Code</Form.Label><Form.Control value={form.billingAddress.zipCode} onChange={updateBillingZip} inputMode="numeric" maxLength={10} /></Form.Group></Col>
              <Col md={3}><Form.Group><Form.Label>State</Form.Label><Form.Control value={form.billingAddress.state} onChange={updateBilling('state')} /></Form.Group></Col>
              <Col md={3}><Form.Group><Form.Label>City</Form.Label><Form.Control value={form.billingAddress.city} onChange={updateBilling('city')} /></Form.Group></Col>
              
            </Row>

            <hr className="my-4" />
            <h6 className="mb-2">Shipping Details</h6>
            <Form.Check
              className="mb-3"
              label="Shipping Address Same as Billing Address"
              checked={form.shippingSameAsBilling}
              onChange={(e) => toggleSameAsBilling(e.target.checked)}
            />
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Address 1 <span className="text-danger">*</span></Form.Label>
                  <div style={{ position: 'relative' }}>
                    <Form.Control
                      value={form.shippingAddress.address1}
                      onChange={updateShipping('address1')}
                      onFocus={() => setShowShippingSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowShippingSuggestions(false), 150)}
                      placeholder="Enter a location"
                      required={!form.shippingSameAsBilling}
                      disabled={form.shippingSameAsBilling}
                      autoComplete="off"
                    />
                    {!form.shippingSameAsBilling && showShippingSuggestions && shippingSuggestions.length > 0 && (
                      <div
                        className="border rounded bg-white"
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 50,
                          maxHeight: 220,
                          overflowY: 'auto',
                        }}
                      >
                        {shippingSuggestions.map((r) => (
                          <button
                            key={r.place_id}
                            type="button"
                            className="btn btn-link text-start w-100 py-2 px-2"
                            style={{ textDecoration: 'none', color: '#111827' }}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applyAddressResult('shipping', r)}
                          >
                            <div className="small">{r.display_name}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Address 2</Form.Label>
                  <Form.Control value={form.shippingAddress.address2} onChange={updateShipping('address2')} placeholder="Suite/Apartment" disabled={form.shippingSameAsBilling} />
                </Form.Group>
              </Col>
              <Col md={3}><Form.Group><Form.Label>Zip Code</Form.Label><Form.Control value={form.shippingAddress.zipCode} onChange={updateShippingZip} inputMode="numeric" maxLength={10} disabled={form.shippingSameAsBilling} /></Form.Group></Col>
              <Col md={3}><Form.Group><Form.Label>State</Form.Label><Form.Control value={form.shippingAddress.state} onChange={updateShipping('state')} disabled={form.shippingSameAsBilling} /></Form.Group></Col>
              <Col md={3}><Form.Group><Form.Label>City</Form.Label><Form.Control value={form.shippingAddress.city} onChange={updateShipping('city')} disabled={form.shippingSameAsBilling} /></Form.Group></Col>
              
            </Row>

            <hr className="my-4" />
            <h6 className="mb-3">Contact Details</h6>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="text-muted small">Multiple contact person can be added.</div>
              <Button type="button" size="sm" variant="outline-primary" onClick={addContact}>Add contact</Button>
            </div>
            <div className="table-responsive">
              <Table bordered size="sm" className="mb-0">
                <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
                  <tr>
                    <th>Type</th>
                    <th>Contact Person *</th>
                    <th>Role *</th>
                    <th>Email</th>
                    <th>Mobile No</th>
                    <th>Fax No</th>
                    <th>Is Default</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {safeContacts.map((c, idx) => (
                    <tr key={idx}>
                      <td><Form.Control size="sm" value={c.labelType || ''} onChange={updateContact(idx, 'labelType')} placeholder="Main" /></td>
                      <td><Form.Control size="sm" value={c.personName || ''} onChange={updateContact(idx, 'personName')} required /></td>
                      <td>
                        <Form.Select size="sm" value={c.personType || 'Owner'} onChange={updateContact(idx, 'personType')}>
                          {CONTACT_PERSON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </Form.Select>
                      </td>
                      <td><Form.Control size="sm" type="email" value={c.email || ''} onChange={updateContact(idx, 'email')} /></td>
                      <td><Form.Control size="sm" value={c.mobileNo || ''} onChange={updateContact(idx, 'mobileNo')} /></td>
                      <td><Form.Control size="sm" value={c.faxNo || ''} onChange={updateContact(idx, 'faxNo')} /></td>
                      <td className="text-center"><Form.Check checked={!!c.isDefault} onChange={updateContact(idx, 'isDefault')} /></td>
                      <td><Button type="button" size="sm" variant="link" className="text-danger p-0" onClick={removeContact(idx)}>Remove</Button></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <div className="d-flex gap-2">
              <Button type="submit" disabled={saving} style={{ backgroundColor: '#F29F67', borderColor: '#F29F67', color: '#1E1E2C' }}>
                {saving ? 'Submitting…' : isManager ? 'Create customer' : 'Submit request'}
              </Button>
              <Button type="button" variant="outline-secondary" onClick={() => navigate('/sales/customers')}>
                Cancel
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </>
  )
}

export default NewCustomerPage
