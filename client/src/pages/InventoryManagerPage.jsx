import { Card, Nav } from 'react-bootstrap'
import { useState } from 'react'

function InventoryManagerPage() {
  const [active, setActive] = useState('dashboard')

  return (
    <>
      <h2 className="mb-4">Inventory Manager</h2>
      <Nav variant="tabs" className="mb-4">
        <Nav.Item>
          <Nav.Link active={active === 'dashboard'} onClick={() => setActive('dashboard')}>
            Dashboard
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={active === 'stock'} onClick={() => setActive('stock')}>
            Update Stock
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={active === 'products'} onClick={() => setActive('products')}>
            Products
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={active === 'po'} onClick={() => setActive('po')}>
            Purchase Order
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={active === 'vendor'} onClick={() => setActive('vendor')}>
            Vendor
          </Nav.Link>
        </Nav.Item>
      </Nav>
      <Card>
        <Card.Body>
          <p className="text-muted mb-0">
            {active === 'dashboard' && 'Data matrix and inventory overview will appear here.'}
            {active === 'stock' && 'Update and adjust stock levels.'}
            {active === 'products' && 'Create products, manage barcodes, print item box codes.'}
            {active === 'po' && 'Create and approve purchase orders.'}
            {active === 'vendor' && 'Manage vendors, track credit, price, cost, open balance.'}
          </p>
        </Card.Body>
      </Card>
    </>
  )
}

export default InventoryManagerPage
