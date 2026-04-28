import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Col, Form, Row } from 'react-bootstrap'
import { api } from '../api/api'

function WarehouseTodoPage() {
  const [tasks, setTasks] = useState([])
  const [pickers, setPickers] = useState([])
  const [packers, setPackers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [noteDrafts, setNoteDrafts] = useState({})
  const [form, setForm] = useState({
    title: '',
    description: '',
    assigneeRole: 'picker',
    assigneeId: '',
    priority: 'medium',
    dueDate: '',
  })

  const loadBoard = async () => {
    setLoading(true)
    setError('')
    try {
      const [tasksRes, pickersRes, packersRes] = await Promise.all([
        api.get('/api/sales/warehouse/tasks'),
        api.get('/api/sales/pickers'),
        api.get('/api/sales/packers'),
      ])
      const [tasksData, pickersData, packersData] = await Promise.all([
        tasksRes.json().catch(() => []),
        pickersRes.json().catch(() => []),
        packersRes.json().catch(() => []),
      ])
      if (!tasksRes.ok) throw new Error(tasksData?.message || 'Failed to load board')
      if (!pickersRes.ok) throw new Error(pickersData?.message || 'Failed to load pickers')
      if (!packersRes.ok) throw new Error(packersData?.message || 'Failed to load packers')
      setTasks(Array.isArray(tasksData) ? tasksData : [])
      setPickers(Array.isArray(pickersData) ? pickersData : [])
      setPackers(Array.isArray(packersData) ? packersData : [])
    } catch (e) {
      setError(e.message || 'Failed to load task board.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBoard()
  }, [])

  const assigneeOptions = useMemo(
    () => (form.assigneeRole === 'picker' ? pickers : packers),
    [form.assigneeRole, pickers, packers],
  )

  const grouped = useMemo(() => {
    const out = {
      todo: [],
      in_progress: [],
      blocked: [],
      done: [],
    }
    tasks.forEach((t) => {
      if (out[t.status]) out[t.status].push(t)
      else out.todo.push(t)
    })
    return out
  }, [tasks])

  const createTask = async () => {
    if (!form.title.trim() || !form.assigneeId) {
      setError('Task title and assignee are required.')
      return
    }
    setError('')
    const res = await api.post('/api/sales/warehouse/tasks', {
      title: form.title,
      description: form.description,
      assigneeRole: form.assigneeRole,
      assigneeId: form.assigneeId,
      priority: form.priority,
      dueDate: form.dueDate || undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data?.message || 'Failed to create task.')
      return
    }
    setForm({
      title: '',
      description: '',
      assigneeRole: 'picker',
      assigneeId: '',
      priority: 'medium',
      dueDate: '',
    })
    setTasks((prev) => [data, ...prev])
  }

  const updateTask = async (taskId, payload) => {
    setError('')
    const res = await api.patch(`/api/sales/warehouse/tasks/${taskId}`, payload)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data?.message || 'Failed to update task.')
      return
    }
    setTasks((prev) => prev.map((t) => (t._id === taskId ? data : t)))
  }

  const addComment = async (taskId) => {
    const comment = String(noteDrafts[taskId] || '').trim()
    if (!comment) return
    await updateTask(taskId, { comment })
    setNoteDrafts((prev) => ({ ...prev, [taskId]: '' }))
  }

  return (
    <>
      <h2 className="mb-2">Warehouse Todo</h2>
      <div className="small text-muted mb-3">
        Collaborative task board for assigning picker/packer work and tracking progress.
      </div>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <Card className="mb-3">
        <Card.Body>
          <Row className="g-2">
            <Col md={3}>
              <Form.Control
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Task title"
              />
            </Col>
            <Col md={3}>
              <Form.Control
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Task details"
              />
            </Col>
            <Col md={2}>
              <Form.Select
                value={form.assigneeRole}
                onChange={(e) =>
                  setForm((p) => ({ ...p, assigneeRole: e.target.value, assigneeId: '' }))
                }
              >
                <option value="picker">Picker</option>
                <option value="scanner_packer">Packer</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Select
                value={form.assigneeId}
                onChange={(e) => setForm((p) => ({ ...p, assigneeId: e.target.value }))}
              >
                <option value="">Select assignee</option>
                {assigneeOptions.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name || u.username}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={1}>
              <Form.Select
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Form.Select>
            </Col>
            <Col md={1}>
              <Button className="w-100" onClick={createTask}>
                Add
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {loading ? (
        <Card>
          <Card.Body>Loading…</Card.Body>
        </Card>
      ) : (
        <Row className="g-3">
          {[
            ['todo', 'Todo'],
            ['in_progress', 'In Progress'],
            ['blocked', 'Blocked'],
            ['done', 'Done'],
          ].map(([key, label]) => (
            <Col key={key} xl={3} md={6}>
              <Card className="h-100">
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <strong>{label}</strong>
                  <Badge bg="secondary">{grouped[key].length}</Badge>
                </Card.Header>
                <Card.Body style={{ maxHeight: 540, overflowY: 'auto' }}>
                  {grouped[key].map((t) => (
                    <Card key={t._id} className="mb-2 border-0 bg-light">
                      <Card.Body className="p-2">
                        <div className="fw-semibold">{t.title}</div>
                        {t.description ? <div className="small text-muted mb-1">{t.description}</div> : null}
                        <div className="small">
                          <span className="me-2">Assignee: {t.assignee?.name || t.assignee?.username || '—'}</span>
                          <Badge bg={t.priority === 'high' ? 'danger' : t.priority === 'low' ? 'success' : 'warning'}>
                            {t.priority}
                          </Badge>
                        </div>
                        <Form.Select
                          size="sm"
                          className="mt-2"
                          value={t.status}
                          onChange={(e) => updateTask(t._id, { status: e.target.value })}
                        >
                          <option value="todo">Todo</option>
                          <option value="in_progress">In Progress</option>
                          <option value="blocked">Blocked</option>
                          <option value="done">Done</option>
                        </Form.Select>
                        <div className="d-flex gap-1 mt-2">
                          <Form.Control
                            size="sm"
                            value={noteDrafts[t._id] || ''}
                            onChange={(e) => setNoteDrafts((p) => ({ ...p, [t._id]: e.target.value }))}
                            placeholder="Add update note..."
                          />
                          <Button size="sm" variant="outline-primary" onClick={() => addComment(t._id)}>
                            Save
                          </Button>
                        </div>
                        <div className="small text-muted mt-2">
                          {(t.logs || []).slice(-2).map((log, idx) => (
                            <div key={`${t._id}-${idx}`}>
                              {log.action} - {log.byUserName || 'User'}
                            </div>
                          ))}
                        </div>
                      </Card.Body>
                    </Card>
                  ))}
                  {grouped[key].length === 0 ? <div className="small text-muted">No tasks.</div> : null}
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </>
  )
}

export default WarehouseTodoPage
