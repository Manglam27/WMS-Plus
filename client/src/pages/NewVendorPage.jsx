import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Col, Form, Row } from 'react-bootstrap'
import { api } from '../api/api'

const SUB_TYPE_OPTIONS = [
  { value: '', label: 'Select sub type' },
  { value: 'Company', label: 'Company' },
  { value: 'Individual', label: 'Individual' },
  { value: 'Other', label: 'Other' },
]

const initialForm = {
  vendorName: '',
  status: 'Active',
  subType: '',
  companyName: '',
  contactPerson: '',
  designation: '',
  cell: '',
  fax: '',
  emailId: '',
  office: '',
  website: '',
  notes: '',
  address1: '',
  address2: '',
  zipCode: '',
  city: '',
  state: '',
  country: '',
}

function NewVendorPage() {
  const navigate = useNavigate()
  const [nextVendorId, setNextVendorId] = useState('')
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .get('/api/vendors/next-id')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.vendorId) setNextVendorId(data.vendorId)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load next vendor ID')
      })
    return () => { cancelled = true }
  }, [])

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setError('')
  }

  const validate = () => {
    if (!form.vendorName.trim()) return 'Vendor name is required'
    if (!form.contactPerson.trim()) return 'Contact person is required'
    if (!form.cell.trim()) return 'Cell is required'
    if (!form.office.trim()) return 'Office is required'
    if (!form.address1.trim()) return 'Address 1 is required'
    if (!form.zipCode.trim()) return 'Zip code is required'
    if (!form.city.trim()) return 'City is required'
    if (!form.state.trim()) return 'State is required'
    if (!form.country.trim()) return 'Country is required'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    setError('')
    setSaving(true)
    try {
      const res = await api.post('/api/vendors', form)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to create vendor')
      navigate('/vendors/list')
    } catch (e) {
      setError(e.message || 'Failed to create vendor')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="product-list-page">
      <div className="product-list-header">
        <div className="product-list-title">Create new vendor</div>
        <Link to="/vendors/list" className="product-list-action-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Back to list
        </Link>
      </div>

      {loadError && <div className="text-danger small mb-2">{loadError}</div>}

      <Form onSubmit={handleSubmit}>
        {/* Vendor Details */}
        <Card className="mb-3">
          <Card.Header className="fw-semibold">Vendor Details</Card.Header>
          <Card.Body>
            <Row className="g-2">
              <Col md={4}>
                <Form.Group className="mb-2">
                  <Form.Label>Vendor ID</Form.Label>
                  <Form.Control type="text" value={nextVendorId || 'Auto (VEN001–VEN999)'} readOnly disabled className="bg-light" />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-2">
                  <Form.Label>Vendor Name *</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Vendor name"
                    value={form.vendorName}
                    onChange={handleChange('vendorName')}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-2">
                  <Form.Label>Status</Form.Label>
                  <Form.Select value={form.status} onChange={handleChange('status')}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Select Sub Type + Company, Contact, etc. */}
        <Card className="mb-3">
          <Card.Header className="fw-semibold">Contact & company</Card.Header>
          <Card.Body>
            <Row className="g-2">
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>Select Sub Type</Form.Label>
                  <Form.Select value={form.subType} onChange={handleChange('subType')}>
                    {SUB_TYPE_OPTIONS.map((o) => (
                      <option key={o.value || 'blank'} value={o.value}>{o.label}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>Company Name</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Company name"
                    value={form.companyName}
                    onChange={handleChange('companyName')}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>Contact Person *</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Contact person"
                    value={form.contactPerson}
                    onChange={handleChange('contactPerson')}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>Designation</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Designation"
                    value={form.designation}
                    onChange={handleChange('designation')}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>Cell *</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Cell"
                    value={form.cell}
                    onChange={handleChange('cell')}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>Fax</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Fax"
                    value={form.fax}
                    onChange={handleChange('fax')}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="Email"
                    value={form.emailId}
                    onChange={handleChange('emailId')}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>Office *</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Office"
                    value={form.office}
                    onChange={handleChange('office')}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>Website</Form.Label>
                  <Form.Control
                    type="url"
                    placeholder="https://"
                    value={form.website}
                    onChange={handleChange('website')}
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group className="mb-2">
                  <Form.Label>Notes</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    placeholder="Notes"
                    value={form.notes}
                    onChange={handleChange('notes')}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Address Details */}
        <Card className="mb-3">
          <Card.Header className="fw-semibold">Address Details</Card.Header>
          <Card.Body>
            <Row className="g-2">
              <Col md={12}>
                <Form.Group className="mb-2">
                  <Form.Label>Address 1 *</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Address 1"
                    value={form.address1}
                    onChange={handleChange('address1')}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group className="mb-2">
                  <Form.Label>Address 2</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Address 2"
                    value={form.address2}
                    onChange={handleChange('address2')}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-2">
                  <Form.Label>Zip Code *</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Zip code"
                    value={form.zipCode}
                    onChange={handleChange('zipCode')}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-2">
                  <Form.Label>City *</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="City"
                    value={form.city}
                    onChange={handleChange('city')}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-2">
                  <Form.Label>State *</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="State"
                    value={form.state}
                    onChange={handleChange('state')}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group className="mb-2">
                  <Form.Label>Country *</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Country"
                    value={form.country}
                    onChange={handleChange('country')}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {error && <div className="text-danger small mb-2">{error}</div>}

        <div className="d-flex gap-2">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving...' : 'Create vendor'}
          </Button>
          <Link to="/vendors/list" className="btn btn-outline-secondary">Cancel</Link>
        </div>
      </Form>
    </div>
  )
}

export default NewVendorPage
