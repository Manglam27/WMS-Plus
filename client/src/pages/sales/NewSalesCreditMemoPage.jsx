import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/api'

function NewSalesCreditMemoPage() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/api/sales/customers').then(async (res) => {
      const data = await res.json().catch(() => [])
      if (res.ok && Array.isArray(data)) setCustomers(data)
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await api.post('/api/sales/credit-memos', {
        customerId,
        amount: parseFloat(amount),
        reason,
        status: 'submitted',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to create credit memo')
      navigate('/sales/credit-memo/list')
    } catch (err) {
      setError(err.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h2 className="mb-4">New credit memo</h2>
      {error && <Alert variant="danger">{error}</Alert>}
      <Card>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Customer</Form.Label>
              <Form.Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>{c.businessName} ({c.customerNumber || c._id})</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Amount</Form.Label>
              <Form.Control type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Reason</Form.Label>
              <Form.Control as="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Form.Group>
            <Button type="submit" disabled={saving} style={{ backgroundColor: '#F29F67', borderColor: '#F29F67', color: '#1E1E2C' }}>
              {saving ? 'Saving…' : 'Submit'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </>
  )
}

export default NewSalesCreditMemoPage
