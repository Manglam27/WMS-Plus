import { Card, Row, Col, ProgressBar, Table, Badge } from 'react-bootstrap'
import { useAuth } from '../context/AuthContext'

const ROLE_LABELS = {
  admin: 'Admin',
  accounts: 'Accounts',
  order_manager: 'Order Manager',
  inventory_manager: 'Inventory Manager',
  inventory_receiver: 'Inventory Receiver',
  sales_manager: 'Sales Manager',
  scanner_packer: 'Scanner / Packer',
  picker: 'Picker',
  sales_person: 'Sales Person',
  driver: 'Driver',
}

function DashboardPage() {
  const { user } = useAuth()

  return (
    <>
      <h2 className="mb-4">Dashboard</h2>

      {/* Top KPI row */}
      <Row className="g-3 mb-3">
        <Col md={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="text-muted text-uppercase small mb-1">Total Products</div>
              <div className="fs-3 fw-semibold">1,079</div>
              <div className="text-success small">+24 new this week</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="text-muted text-uppercase small mb-1">On Hand Inventory Value</div>
              <div className="fs-3 fw-semibold">$4.2M</div>
              <div className="small">Across all warehouses</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="text-muted text-uppercase small mb-1">Low Stock Items</div>
              <div className="fs-3 fw-semibold">18</div>
              <ProgressBar
                now={35}
                label="35% of items below reorder"
                className="mt-2"
                style={{ height: 10, fontSize: 10 }}
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Middle analytics row */}
      <Row className="g-3 mb-3">
        <Col lg={8}>
          <Card className="h-100">
            <Card.Header>Sales vs Purchases (This Month)</Card.Header>
            <Card.Body>
              <p className="text-muted small">
                A proper chart can be plugged in here later. For now this block represents an
                overview similar to a sales & purchase widget.
              </p>
              <Row className="g-3 mt-1">
                <Col md={6}>
                  <Card bg="light" className="h-100">
                    <Card.Body>
                      <div className="text-muted text-uppercase small mb-1">Sales Orders</div>
                      <div className="fs-4 fw-semibold">$1.8M</div>
                      <div className="small text-success">↑ 12% vs last month</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card bg="light" className="h-100">
                    <Card.Body>
                      <div className="text-muted text-uppercase small mb-1">Purchase Orders</div>
                      <div className="fs-4 fw-semibold">$1.2M</div>
                      <div className="small text-muted">Stable vs last month</div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="h-100">
            <Card.Header>Your session</Card.Header>
            <Card.Body>
              <p className="mb-1">
                Welcome, <strong>{user?.name}</strong>
              </p>
              <p className="text-muted small mb-3">
                You are logged in as <strong>{ROLE_LABELS[user?.role] || user?.role}</strong>.
              </p>
              <p className="small mb-1">Quick links:</p>
              <ul className="small mb-0">
                <li>View low stock items and raise purchase orders.</li>
                <li>Update stock for received shipments.</li>
                <li>Check on-hand inventory and manual adjustments.</li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Bottom tables row */}
      <Row className="g-3">
        <Col lg={6}>
          <Card className="h-100">
            <Card.Header>Low Stock Alerts</Card.Header>
            <Card.Body className="p-0">
              <Table hover size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-end">On Hand</th>
                    <th className="text-end">Reorder</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Test Product 255</td>
                    <td className="text-end">4</td>
                    <td className="text-end">10</td>
                    <td>
                      <Badge bg="warning" text="dark">
                        Low
                      </Badge>
                    </td>
                  </tr>
                  <tr>
                    <td>After Box Energy Drink</td>
                    <td className="text-end">0</td>
                    <td className="text-end">20</td>
                    <td>
                      <Badge bg="danger">Out</Badge>
                    </td>
                  </tr>
                  <tr>
                    <td>Sample Household Cleaner</td>
                    <td className="text-end">15</td>
                    <td className="text-end">30</td>
                    <td>
                      <Badge bg="warning" text="dark">
                        Low
                      </Badge>
                    </td>
                  </tr>
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100">
            <Card.Header>Recent Activity</Card.Header>
            <Card.Body className="p-0">
              <Table hover size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>User</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>09:15</td>
                    <td>PO #PO-104 received (120 pcs)</td>
                    <td>Inventory Manager</td>
                  </tr>
                  <tr>
                    <td>10:02</td>
                    <td>Manual stock adjustment on Test Product 255 (-2)</td>
                    <td>Inventory Receiver</td>
                  </tr>
                  <tr>
                    <td>11:45</td>
                    <td>New product added: Sample Household Cleaner</td>
                    <td>Admin</td>
                  </tr>
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  )
}

export default DashboardPage
