import { Card, Nav } from 'react-bootstrap'
import { useState } from 'react'

function AccountsPage() {
  const [active, setActive] = useState('overview')

  return (
    <>
      <h2 className="mb-4">Accounts</h2>
      <Nav variant="tabs" className="mb-4">
        <Nav.Item>
          <Nav.Link active={active === 'overview'} onClick={() => setActive('overview')}>
            Overview
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={active === 'vendor'} onClick={() => setActive('vendor')}>
            Vendor Payments
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={active === 'customer'} onClick={() => setActive('customer')}>
            Customer Payments
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={active === 'petty'} onClick={() => setActive('petty')}>
            Petty Cash
          </Nav.Link>
        </Nav.Item>
      </Nav>
      <Card>
        <Card.Body>
          <p className="text-muted mb-0">
            {active === 'overview' && 'Full financial tracking and reports.'}
            {active === 'vendor' && 'Process and record vendor payments.'}
            {active === 'customer' && 'Process and record customer payments.'}
            {active === 'petty' && 'Monitor and manage petty cash balance.'}
          </p>
        </Card.Body>
      </Card>
    </>
  )
}

export default AccountsPage
