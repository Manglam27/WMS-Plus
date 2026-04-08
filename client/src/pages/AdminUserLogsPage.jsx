import { useEffect, useState } from 'react'
import { Alert, Button, Card, Table } from 'react-bootstrap'
import { api } from '../api/api'

function AdminUserLogsPage() {
  const [logUsers, setLogUsers] = useState([])
  const [selectedLogUserId, setSelectedLogUserId] = useState('')
  const [selectedLogUserName, setSelectedLogUserName] = useState('')
  const [userLogs, setUserLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadLogUsers()
  }, [])

  useEffect(() => {
    if (selectedLogUserId) {
      loadUserLogs(selectedLogUserId, selectedLogUserName)
    }
  }, [selectedLogUserId])

  const safeJson = async (res) => {
    const text = await res.text()
    try {
      return text ? JSON.parse(text) : {}
    } catch {
      return {}
    }
  }

  const loadLogUsers = async () => {
    try {
      const res = await api.get('/api/users/logs/users')
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.message || 'Failed to load users for logs')
      const list = Array.isArray(data) ? data : []
      setLogUsers(list)
      if (list.length > 0) {
        setSelectedLogUserId(list[0]._id)
        setSelectedLogUserName(list[0].name || list[0].username || '')
      }
    } catch (err) {
      setError(err.message || 'Failed to load users for logs')
    }
  }

  const loadUserLogs = async (userId, userName) => {
    if (!userId) return
    setLoadingLogs(true)
    setError('')
    try {
      const res = await api.get(`/api/users/${userId}/logs`)
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.message || 'Failed to load user logs')
      setSelectedLogUserName(userName || '')
      setUserLogs(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load user logs')
    } finally {
      setLoadingLogs(false)
    }
  }

  return (
    <>
      <h2 className="mb-4">User Logs</h2>
      {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}
      <div className="row g-3">
        <div className="col-md-4">
          <Card>
            <Card.Header>Users</Card.Header>
            <Card.Body style={{ maxHeight: 480, overflowY: 'auto' }}>
              {logUsers.length === 0 && <div className="text-muted small">No users found.</div>}
              <div className="d-grid gap-2">
                {logUsers.map((u) => (
                  <Button
                    key={u._id}
                    variant={selectedLogUserId === u._id ? 'primary' : 'outline-secondary'}
                    className="text-start"
                    onClick={() => {
                      setSelectedLogUserId(u._id)
                      setSelectedLogUserName(u.name || u.username)
                    }}
                  >
                    <div className="fw-semibold">{u.name}</div>
                    <div className="small">{u.username}</div>
                  </Button>
                ))}
              </div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-8">
          <Card>
            <Card.Header>{selectedLogUserName ? `${selectedLogUserName} - Login Logs` : 'Login Logs'}</Card.Header>
            <Card.Body>
              {!selectedLogUserId ? (
                <div className="text-muted">Select a user to view logs.</div>
              ) : loadingLogs ? (
                <div>Loading logs...</div>
              ) : (
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>IP Address</th>
                      <th>Login Date/Time</th>
                      <th>Logout Date/Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userLogs.map((log) => (
                      <tr key={log._id}>
                        <td>{log.ipAddress || '-'}</td>
                        <td>{log.loginAt ? new Date(log.loginAt).toLocaleString() : '-'}</td>
                        <td>{log.logoutAt ? new Date(log.logoutAt).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                    {userLogs.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center text-muted">No logs for this user.</td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>
    </>
  )
}

export default AdminUserLogsPage
