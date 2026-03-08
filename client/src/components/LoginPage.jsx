import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Button, Card, Container, Alert } from 'react-bootstrap'
import { useAuth } from '../context/AuthContext'

function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const { login, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  const handleSeedAdmin = async () => {
    setError('')
    setSeeding(true)
    try {
      const res = await fetch('/api/seed-admin')
      const data = await res.text().then((t) => { try { return t ? JSON.parse(t) : {} } catch { return {} } })
      if (res.ok) {
        setError('')
        alert(data.message || 'Admin user ready. Try logging in with admin / admin')
      } else {
        setError(data.message || 'Seed failed')
      }
    } catch (err) {
      setError('Cannot reach server. Is it running?')
    } finally {
      setSeeding(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <Container className="py-5">
        <Card className="shadow-sm" style={{ maxWidth: 400, margin: '0 auto' }}>
          <Card.Body className="p-4">
            <h2 className="text-center mb-4">WMS-Plus</h2>
            <p className="text-center text-muted mb-4">Warehouse Management System</p>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>User ID</Form.Label>
                <Form.Control
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter user ID"
                  required
                  autoComplete="username"
                />
              </Form.Group>
              <Form.Group className="mb-4">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                />
              </Form.Group>
              <Button variant="primary" type="submit" className="w-100" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
              <div className="mt-3 text-center">
                <Button
                  variant="link"
                  size="sm"
                  className="text-muted p-0"
                  onClick={handleSeedAdmin}
                  disabled={seeding}
                >
                  {seeding ? 'Creating...' : 'Create admin user (if login fails)'}
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    </div>
  )
}

export default LoginPage
