import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Form, Row, Table } from 'react-bootstrap'
import { api } from '../../api/api'

function ReceivePaymentPage() {
  const [customers, setCustomers] = useState([])
  const [payments, setPayments] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    api.get('/api/sales/payments').then(async (res) => {
      const data = await res.json().catch(() => [])
      if (res.ok) setPayments(Array.isArray(data) ? data : [])
    })
  }

  useEffect(() => {
    api.get('/api/sales/customers').then(async (res) => {
      const data = await res.json().catch(() => [])
      if (res.ok && Array.isArray(data)) setCustomers(data)
    })
    load()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await api.post('/api/sales/payments', {
        customerId,
        amount: parseFloat(amount),
        method,
        reference,
        notes,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to record payment')
      setAmount('')
      setReference('')
      setNotes('')
      load()
    } catch (err) {
      setError(err.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h2 className="mb-4">Receive payment</h2>
      {error && <Alert variant="danger">{error}</Alert>}
      <Card className="mb-4">
        <Card.Header>Record payment</Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Customer</Form.Label>
                  <Form.Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                    <option value="">Select</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>{c.businessName}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Amount</Form.Label>
                  <Form.Control type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Method</Form.Label>
                  <Form.Select value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="card">Card</option>
                    <option value="ach">ACH / wire</option>
                    <option value="other">Other</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Reference #</Form.Label>
                  <Form.Control value={reference} onChange={(e) => setReference(e.target.value)} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Notes</Form.Label>
                  <Form.Control value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Form.Group>
              </Col>
            </Row>
            <Button type="submit" className="mt-3" disabled={saving} style={{ backgroundColor: '#F29F67', borderColor: '#F29F67', color: '#1E1E2C' }}>
              {saving ? 'Saving…' : 'Record payment'}
            </Button>
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>Recent payments</Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0" size="sm">
            <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
              <tr>
                <th>Payment #</th>
                <th>Customer</th>
                <th className="text-end">Amount</th>
                <th>Method</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id}>
                  <td>{p.paymentNumber}</td>
                  <td>{p.customer?.businessName || '—'}</td>
                  <td className="text-end">${Number(p.amount).toFixed(2)}</td>
                  <td>{p.method}</td>
                  <td className="small text-muted">{p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">No payments recorded.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  )
}

export default ReceivePaymentPage
