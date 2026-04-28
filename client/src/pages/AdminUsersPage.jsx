import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, Form, Table } from 'react-bootstrap'
import { api } from '../api/api'

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'order_manager', label: 'Warehouse Manager' },
  { value: 'inventory_manager', label: 'Inventory Manager' },
  { value: 'inventory_receiver', label: 'Inventory Receiver' },
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'scanner_packer', label: 'Packer' },
  { value: 'picker', label: 'Picker' },
  { value: 'sales_person', label: 'Sales Person' },
  { value: 'driver', label: 'Driver' },
]

function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'accounts' })
  const [passwordEdits, setPasswordEdits] = useState({})
  const [rowBusy, setRowBusy] = useState({})

  useEffect(() => {
    loadUsers()
  }, [])

  const safeJson = async (res) => {
    const text = await res.text()
    try {
      return text ? JSON.parse(text) : {}
    } catch {
      return {}
    }
  }

  const loadUsers = async () => {
    try {
      const res = await api.get('/api/users')
      if (res.ok) {
        const data = await safeJson(res)
        setUsers(Array.isArray(data) ? data : [])
      }
    } catch {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const setBusy = (userId, busy) => {
    setRowBusy((prev) => ({ ...prev, [userId]: busy }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      const res = await api.post('/api/users', form)
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.message || 'Failed to create user')
      setSuccess('User created successfully')
      setForm({ name: '', username: '', password: '', role: 'accounts' })
      loadUsers()
    } catch (err) {
      setError(err.message || 'Failed to create user')
    }
  }

  const handleToggleStatus = async (userId, currentIsActive) => {
    setError('')
    setSuccess('')
    setBusy(userId, true)
    try {
      const res = await api.patch(`/api/users/${userId}/status`, { isActive: !currentIsActive })
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.message || 'Failed to update user status')
      setSuccess(`User ${data.isActive ? 'activated' : 'deactivated'} successfully`)
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Failed to update user status')
    } finally {
      setBusy(userId, false)
    }
  }

  const handleUpdatePassword = async (userId) => {
    const nextPassword = String(passwordEdits[userId] || '')
    if (nextPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setError('')
    setSuccess('')
    setBusy(userId, true)
    try {
      const res = await api.patch(`/api/users/${userId}/password`, { password: nextPassword })
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.message || 'Failed to update password')
      setSuccess('Password updated successfully')
      setPasswordEdits((prev) => ({ ...prev, [userId]: '' }))
    } catch (err) {
      setError(err.message || 'Failed to update password')
    } finally {
      setBusy(userId, false)
    }
  }

  return (
    <>
      <h2 className="mb-4">User Management</h2>
      {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')} dismissible>{success}</Alert>}

      <Card className="mb-4">
        <Card.Header>Create New User</Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-md-3">
                <Form.Group>
                  <Form.Label>Name</Form.Label>
                  <Form.Control value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" required />
                </Form.Group>
              </div>
              <div className="col-md-3">
                <Form.Group>
                  <Form.Label>Username (User ID)</Form.Label>
                  <Form.Control value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Login ID" required />
                </Form.Group>
              </div>
              <div className="col-md-2">
                <Form.Group>
                  <Form.Label>Password</Form.Label>
                  <Form.Control type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 chars" required minLength={6} />
                </Form.Group>
              </div>
              <div className="col-md-2">
                <Form.Group>
                  <Form.Label>Role</Form.Label>
                  <Form.Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-2 d-flex align-items-end">
                <Button type="submit" variant="primary">Create User</Button>
              </div>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>All Users</Card.Header>
        <Card.Body>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ minWidth: 260 }}>Set Password</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>{u.name}</td>
                    <td>{u.username}</td>
                    <td>{ROLES.find((r) => r.value === u.role)?.label || u.role}</td>
                    <td><Badge bg={u.isActive === false ? 'secondary' : 'success'}>{u.isActive === false ? 'Deactivated' : 'Active'}</Badge></td>
                    <td>
                      <div className="d-flex gap-2">
                        <Form.Control
                          type="password"
                          value={passwordEdits[u._id] || ''}
                          onChange={(e) => setPasswordEdits((prev) => ({ ...prev, [u._id]: e.target.value }))}
                          placeholder="New password"
                          minLength={6}
                        />
                        <Button size="sm" variant="outline-primary" disabled={!!rowBusy[u._id]} onClick={() => handleUpdatePassword(u._id)}>Update</Button>
                      </div>
                    </td>
                    <td>
                      <Button size="sm" variant={u.isActive === false ? 'success' : 'outline-secondary'} disabled={!!rowBusy[u._id]} onClick={() => handleToggleStatus(u._id, u.isActive !== false)}>
                        {u.isActive === false ? 'Activate' : 'Deactivate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </>
  )
}

export default AdminUsersPage
