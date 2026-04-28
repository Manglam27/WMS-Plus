import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form } from 'react-bootstrap'
import { api } from '../api/api'

function AdminCompanySettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    companyName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    email: '',
    website: '',
    enableSalesTax: true,
    salesTaxPercent: '0',
    salesTaxLabel: 'Sales Tax',
    stateTaxRules: [],
    invoiceDisclosure: '',
    invoiceTerms: '',
  })
  const [logoFile, setLogoFile] = useState(null)
  const [logoUrl, setLogoUrl] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/company-settings')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.message || 'Failed to load company settings.')
        setForm({
          companyName: data.companyName || '',
          addressLine1: data.addressLine1 || '',
          addressLine2: data.addressLine2 || '',
          city: data.city || '',
          state: data.state || '',
          zipCode: data.zipCode || '',
          phone: data.phone || '',
          email: data.email || '',
          website: data.website || '',
          enableSalesTax: data.enableSalesTax !== false,
          salesTaxPercent: String(Math.max(0, Number(data.salesTaxPercent) || 0)),
          salesTaxLabel: data.salesTaxLabel || 'Sales Tax',
          stateTaxRules: Array.isArray(data.stateTaxRules)
            ? data.stateTaxRules.map((r) => ({
              stateCode: String(r?.stateCode || '').trim().toUpperCase(),
              taxPercent: String(Math.max(0, Number(r?.taxPercent) || 0)),
              minAmount: String(Math.max(0, Number(r?.minAmount) || 0)),
              maxAmount: r?.maxAmount == null ? '' : String(Math.max(0, Number(r.maxAmount) || 0)),
              isActive: r?.isActive !== false,
            }))
            : [],
          invoiceDisclosure: data.invoiceDisclosure || '',
          invoiceTerms: data.invoiceTerms || '',
        })
        setLogoUrl(data.logoFileName ? `/api/uploads/company/${data.logoFileName}` : '')
      } catch (e) {
        setError(e.message || 'Failed to load company settings.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const onChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = new FormData()
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'stateTaxRules') return
        payload.append(k, String(v))
      })
      payload.append(
        'stateTaxRules',
        JSON.stringify(
          (form.stateTaxRules || []).map((r) => ({
            stateCode: String(r.stateCode || '').trim().toUpperCase(),
            taxPercent: Math.max(0, Number(r.taxPercent) || 0),
            minAmount: Math.max(0, Number(r.minAmount) || 0),
            maxAmount: String(r.maxAmount || '').trim() === '' ? null : Math.max(0, Number(r.maxAmount) || 0),
            isActive: r.isActive !== false,
          })),
        ),
      )
      if (logoFile) payload.append('logo', logoFile)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/company-settings', {
        method: 'PUT',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: payload,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || 'Failed to save company settings.')
      setSuccess('Company settings saved successfully.')
      setLogoFile(null)
      setLogoUrl(data.logoFileName ? `/api/uploads/company/${data.logoFileName}` : '')
    } catch (e) {
      setError(e.message || 'Failed to save company settings.')
    } finally {
      setSaving(false)
    }
  }

  const updateRule = (idx, patch) => {
    setForm((prev) => ({
      ...prev,
      stateTaxRules: (prev.stateTaxRules || []).map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }))
  }

  const addRule = () => {
    setForm((prev) => ({
      ...prev,
      stateTaxRules: [
        ...(prev.stateTaxRules || []),
        { stateCode: '', taxPercent: '0', minAmount: '0', maxAmount: '', isActive: true },
      ],
    }))
  }

  const removeRule = (idx) => {
    setForm((prev) => ({
      ...prev,
      stateTaxRules: (prev.stateTaxRules || []).filter((_, i) => i !== idx),
    }))
  }

  if (loading) return <p>Loading company settings...</p>

  return (
    <>
      <h2 className="mb-4">Company Settings</h2>
      {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')} dismissible>{success}</Alert>}

      <Card>
        <Card.Header>Company Profile & Tax</Card.Header>
        <Card.Body>
          <Form onSubmit={handleSave}>
            <div className="row g-3">
              <div className="col-md-6">
                <Form.Label>Company Name</Form.Label>
                <Form.Control value={form.companyName} onChange={(e) => onChange('companyName', e.target.value)} />
              </div>
              <div className="col-md-6">
                <Form.Label>Logo</Form.Label>
                <Form.Control type="file" accept=".png,.jpg,.jpeg,.webp" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                {logoUrl && (
                  <div className="mt-2">
                    <img src={logoUrl} alt="Company logo" style={{ maxHeight: 60, maxWidth: 180, objectFit: 'contain' }} />
                  </div>
                )}
              </div>
              <div className="col-md-6">
                <Form.Label>Address Line 1</Form.Label>
                <Form.Control value={form.addressLine1} onChange={(e) => onChange('addressLine1', e.target.value)} />
              </div>
              <div className="col-md-6">
                <Form.Label>Address Line 2</Form.Label>
                <Form.Control value={form.addressLine2} onChange={(e) => onChange('addressLine2', e.target.value)} />
              </div>
              <div className="col-md-4">
                <Form.Label>City</Form.Label>
                <Form.Control value={form.city} onChange={(e) => onChange('city', e.target.value)} />
              </div>
              <div className="col-md-4">
                <Form.Label>State</Form.Label>
                <Form.Control value={form.state} onChange={(e) => onChange('state', e.target.value)} />
              </div>
              <div className="col-md-4">
                <Form.Label>Zip Code</Form.Label>
                <Form.Control value={form.zipCode} onChange={(e) => onChange('zipCode', e.target.value)} />
              </div>
              <div className="col-md-4">
                <Form.Label>Phone</Form.Label>
                <Form.Control value={form.phone} onChange={(e) => onChange('phone', e.target.value)} />
              </div>
              <div className="col-md-4">
                <Form.Label>Email</Form.Label>
                <Form.Control value={form.email} onChange={(e) => onChange('email', e.target.value)} />
              </div>
              <div className="col-md-4">
                <Form.Label>Website</Form.Label>
                <Form.Control value={form.website} onChange={(e) => onChange('website', e.target.value)} />
              </div>

              <div className="col-md-4 d-flex align-items-end">
                <Form.Check
                  type="switch"
                  id="enable-sales-tax"
                  label="Enable Sales Tax"
                  checked={form.enableSalesTax}
                  onChange={(e) => onChange('enableSalesTax', e.target.checked)}
                />
              </div>
            </div>

            <Card className="mt-4">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <span>State Tax Rules (with bounds)</span>
                <Button size="sm" variant="outline-primary" onClick={addRule}>+ Add Rule</Button>
              </Card.Header>
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <table className="table mb-0 table-sm">
                    <thead>
                      <tr>
                        <th>State</th>
                        <th>Tax %</th>
                        <th>Min Amount</th>
                        <th>Max Amount</th>
                        <th>Active</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(form.stateTaxRules || []).map((rule, idx) => (
                        <tr key={`rule-${idx}`}>
                          <td>
                            <Form.Control
                              size="sm"
                              value={rule.stateCode}
                              maxLength={2}
                              placeholder="NY"
                              onChange={(e) => updateRule(idx, { stateCode: e.target.value.toUpperCase() })}
                            />
                          </td>
                          <td>
                            <Form.Control
                              size="sm"
                              type="number"
                              min={0}
                              step="0.01"
                              value={rule.taxPercent}
                              onChange={(e) => updateRule(idx, { taxPercent: e.target.value })}
                            />
                          </td>
                          <td>
                            <Form.Control
                              size="sm"
                              type="number"
                              min={0}
                              step="0.01"
                              value={rule.minAmount}
                              onChange={(e) => updateRule(idx, { minAmount: e.target.value })}
                            />
                          </td>
                          <td>
                            <Form.Control
                              size="sm"
                              type="number"
                              min={0}
                              step="0.01"
                              value={rule.maxAmount}
                              placeholder="No max"
                              onChange={(e) => updateRule(idx, { maxAmount: e.target.value })}
                            />
                          </td>
                          <td>
                            <Form.Check
                              checked={rule.isActive}
                              onChange={(e) => updateRule(idx, { isActive: e.target.checked })}
                            />
                          </td>
                          <td>
                            <Button size="sm" variant="outline-danger" onClick={() => removeRule(idx)}>Remove</Button>
                          </td>
                        </tr>
                      ))}
                      {(form.stateTaxRules || []).length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center text-muted py-3">No state tax rules added.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card.Body>
            </Card>
            <Card className="mt-4">
              <Card.Header>Invoice Footer Content</Card.Header>
              <Card.Body>
                <div className="row g-3">
                  <div className="col-md-6">
                    <Form.Label>Disclosure (shown on invoice)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      value={form.invoiceDisclosure}
                      onChange={(e) => onChange('invoiceDisclosure', e.target.value)}
                      placeholder="Enter invoice disclosure text..."
                    />
                  </div>
                  <div className="col-md-6">
                    <Form.Label>Terms (shown on invoice)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      value={form.invoiceTerms}
                      onChange={(e) => onChange('invoiceTerms', e.target.value)}
                      placeholder="Enter invoice terms text..."
                    />
                  </div>
                </div>
              </Card.Body>
            </Card>
            <div className="mt-4">
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </>
  )
}

export default AdminCompanySettingsPage
