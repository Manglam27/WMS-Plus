import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Table } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'

function PackerTodoPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/api/sales/warehouse/tasks')
      .then(async (res) => {
        const data = await res.json().catch(() => [])
        if (!res.ok) {
          setTasks([])
          setError(data?.message || 'Failed to load TO-DO.')
          return
        }
        setTasks(Array.isArray(data) ? data : [])
        setError('')
      })
      .finally(() => setLoading(false))
  }, [])

  const visibleTasks = useMemo(
    () => (Array.isArray(tasks) ? tasks : []).filter((t) => ['todo', 'in_progress', 'done'].includes(String(t?.status || ''))),
    [tasks],
  )
  const groupedByPriority = useMemo(
    () => ({
      high: visibleTasks.filter((t) => String(t.priority || 'medium') === 'high'),
      medium: visibleTasks.filter((t) => String(t.priority || 'medium') === 'medium'),
      low: visibleTasks.filter((t) => String(t.priority || 'medium') === 'low'),
    }),
    [visibleTasks],
  )

  const updateTaskStatus = async (taskId, status) => {
    const nextStatus = status === 'done' ? 'done' : status === 'todo' ? 'todo' : 'in_progress'
    const res = await api.patch(`/api/sales/warehouse/tasks/${taskId}`, { status: nextStatus })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data?.message || 'Failed to update task status.')
      return
    }
    setTasks((prev) => prev.map((t) => (t._id === taskId ? data : t)))
    setError('')
  }

  return (
    <>
      <h2 className="mb-3">TO-DO</h2>
      {error && <div className="alert alert-danger py-2">{error}</div>}

      <Card className="mb-3 packer-top-strip">
        <Card.Body className="d-flex flex-wrap gap-2 align-items-center">
          <Button size="sm" variant="light" className="packer-top-link-btn" onClick={() => navigate('/')}>
            All Orders
          </Button>
          <Button size="sm" variant="warning" className="packer-top-link-btn" onClick={() => navigate('/packer/todo')}>
            TO-DO
          </Button>
        </Card.Body>
      </Card>

      {loading ? (
        <Card>
          <Card.Body className="p-3 text-muted small">Loading TO-DO...</Card.Body>
        </Card>
      ) : (
        <>
          {[
            { key: 'high', label: 'High Priority', header: '#b91c1c', bg: '#fff1f2' },
            { key: 'medium', label: 'Medium Priority', header: '#a16207', bg: '#fffbeb' },
            { key: 'low', label: 'Low Priority', header: '#166534', bg: '#f0fdf4' },
          ].map((section) => {
            const rows = groupedByPriority[section.key] || []
            return (
              <Card key={section.key} className="mb-3">
                <Card.Header
                  className="d-flex justify-content-between align-items-center"
                  style={{ backgroundColor: section.header, color: '#fff' }}
                >
                  <strong>{section.label}</strong>
                  <Badge bg="light" text="dark">{rows.length}</Badge>
                </Card.Header>
                <Card.Body className="p-0">
                  <Table responsive hover className="mb-0" size="sm">
                    <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
                      <tr>
                        <th>Task</th>
                        <th>Assigned To</th>
                        <th>Assigned By</th>
                        <th>Role</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((t) => (
                        <tr
                          key={t._id}
                          style={
                            String(t.status || '') === 'done'
                              ? { backgroundColor: '#e5e7eb', color: '#6b7280', opacity: 0.78 }
                              : { backgroundColor: section.bg }
                          }
                        >
                          <td>
                            <div className={`fw-semibold ${String(t.status || '') === 'done' ? 'text-decoration-line-through' : ''}`}>
                              {t.title || 'Task'}
                            </div>
                            {t.description ? <div className="small text-muted">{t.description}</div> : null}
                          </td>
                          <td>{t.assignee?.name || t.assignee?.username || '—'}</td>
                          <td>{t.createdBy?.name || t.createdBy?.username || '—'}</td>
                          <td>{t.assigneeRole === 'scanner_packer' ? 'Packer' : 'Picker'}</td>
                          <td style={{ minWidth: 180 }}>
                            <select
                              className="form-select form-select-sm"
                              value={String(t.status || 'todo')}
                              onChange={(e) => updateTaskStatus(t._id, e.target.value)}
                            >
                              <option value="in_progress">Working on it</option>
                              <option value="done">Completed</option>
                              <option value="todo">Uncomplete</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center text-muted py-3">No tasks in {section.label.toLowerCase()}.</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            )
          })}
          {visibleTasks.length === 0 && (
            <Card>
              <Card.Body className="text-center text-muted py-3">No TO-DO tasks available.</Card.Body>
            </Card>
          )}
        </>
      )}
    </>
  )
}

export default PackerTodoPage
