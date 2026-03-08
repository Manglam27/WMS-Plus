import { Card, Nav } from 'react-bootstrap'
import { useState } from 'react'

function SalesManagerPage() {
  const [active, setActive] = useState('sales')

  return (
    <>
      <h2 className="mb-4">Sales Manager</h2>
      <Nav variant="tabs" className="mb-4">
        <Nav.Item>
          <Nav.Link active={active === 'sales'} onClick={() => setActive('sales')}>
            Sales
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={active === 'orders'} onClick={() => setActive('orders')}>
            Orders
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={active === 'customers'} onClick={() => setActive('customers')}>
            Customers
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={active === 'reports'} onClick={() => setActive('reports')}>
            Reports
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={active === 'drivers'} onClick={() => setActive('drivers')}>
            Driver Routes
          </Nav.Link>
        </Nav.Item>
      </Nav>
      <Card>
        <Card.Body>
          <p className="text-muted mb-0">
            {active === 'sales' && 'Today\'s sales, profitability, and sales data.'}
            {active === 'orders' && 'Manage orders, cancel, edit after packing.'}
            {active === 'customers' && 'Create customers, approve, view open balance, credits.'}
            {active === 'reports' && 'Profitability reports and analytics.'}
            {active === 'drivers' && 'Assign orders to drivers, manage routes and logs.'}
          </p>
        </Card.Body>
      </Card>
    </>
  )
}

export default SalesManagerPage
