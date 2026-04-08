import { useState, useEffect } from 'react'
import { Card, Alert } from 'react-bootstrap'
import { api } from '../api/api'

function AdminPage() {
  const [stats, setStats] = useState({ totalUsers: 0, activeUsers: 0, inactiveUsers: 0 })
  const [error, setError] = useState('')

  useEffect(() => {
    loadStats()
  }, [])

  const safeJson = async (res) => {
    const text = await res.text()
    try {
      return text ? JSON.parse(text) : {}
    } catch {
      return {}
    }
  }

  const loadStats = async () => {
    try {
      const res = await api.get('/api/users/stats')
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.message || 'Failed to load user stats')
      setStats({
        totalUsers: Number(data.totalUsers) || 0,
        activeUsers: Number(data.activeUsers) || 0,
        inactiveUsers: Number(data.inactiveUsers) || 0,
      })
    } catch {
      // Keep dashboard usable even when stats fail
    }
  }

  return (
    <>
      <h2 className="mb-4">Administration</h2>
      {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}
      <div className="row g-3">
        <div className="col-md-4">
          <Card className="h-100">
            <Card.Body>
              <div className="text-muted small">Total Users</div>
              <div className="fs-3 fw-semibold">{stats.totalUsers}</div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-4">
          <Card className="h-100">
            <Card.Body>
              <div className="text-muted small">Active Users</div>
              <div className="fs-3 fw-semibold text-success">{stats.activeUsers}</div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-4">
          <Card className="h-100">
            <Card.Body>
              <div className="text-muted small">Inactive Users</div>
              <div className="fs-3 fw-semibold text-secondary">{stats.inactiveUsers}</div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </>
  )
}

export default AdminPage
