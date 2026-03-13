import { useState } from 'react'
import { Card, Nav, Form, Button, Table, Badge } from 'react-bootstrap'

function StockUpdateTab() {
  const [form, setForm] = useState({
    barcode: '',
    product: '',
    available: '',
    remark: '',
    quantity: '',
  })

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // This will be wired to an API later
    // For now just log so the flow is visible
    // eslint-disable-next-line no-console
    console.log('Stock update submitted', form)
  }

  const parsedQuantity = Number(form.quantity) || 0
  const parsedAvailable = Number(form.available) || 0
  const newTotal = parsedAvailable + parsedQuantity

  return (
    <Card>
      <Card.Header as="h5">Update Stock</Card.Header>
      <Card.Body>
        <div className="row g-4">
          <div className="col-lg-7">
            <Form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <Form.Group>
                    <Form.Label>Barcode</Form.Label>
                    <Form.Control
                      placeholder="Scan or enter barcode"
                      value={form.barcode}
                      onChange={handleChange('barcode')}
                    />
                  </Form.Group>
                </div>
                <div className="col-md-6">
                  <Form.Group>
                    <Form.Label>Product</Form.Label>
                    <Form.Control
                      placeholder="Search product name or ID"
                      value={form.product}
                      onChange={handleChange('product')}
                    />
                  </Form.Group>
                </div>
                <div className="col-md-4">
                  <Form.Group>
                    <Form.Label>Available in Stock</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      placeholder="Current stock"
                      value={form.available}
                      onChange={handleChange('available')}
                    />
                  </Form.Group>
                </div>
                <div className="col-md-4">
                  <Form.Group>
                    <Form.Label>Quantity to Add</Form.Label>
                    <Form.Control
                      type="number"
                      placeholder="Units to receive"
                      value={form.quantity}
                      onChange={handleChange('quantity')}
                    />
                  </Form.Group>
                </div>
                <div className="col-md-4">
                  <Form.Group>
                    <Form.Label>Remark</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={1}
                      placeholder="Reason for adjustment"
                      value={form.remark}
                      onChange={handleChange('remark')}
                    />
                    <Form.Text muted>Minimum of 10 characters recommended.</Form.Text>
                  </Form.Group>
                </div>
                <div className="col-12 d-flex justify-content-end gap-2 mt-2">
                  <Button variant="outline-secondary" type="reset" onClick={() => setForm({ barcode: '', product: '', available: '', remark: '', quantity: '' })}>
                    Reset
                  </Button>
                  <Button variant="success" type="submit">
                    Update Stock
                  </Button>
                </div>
              </div>
            </Form>
          </div>
          <div className="col-lg-5">
            <Card bg="light" className="h-100">
              <Card.Header>Stock Summary</Card.Header>
              <Card.Body>
                <Table size="sm" className="mb-3">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th className="text-end">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Available Stock</td>
                      <td className="text-end">{parsedAvailable}</td>
                    </tr>
                    <tr>
                      <td>Incoming Quantity</td>
                      <td className="text-end text-success">+ {parsedQuantity}</td>
                    </tr>
                    <tr>
                      <td>
                        New Total <Badge bg="info">pieces</Badge>
                      </td>
                      <td className="text-end fw-bold">{newTotal}</td>
                    </tr>
                  </tbody>
                </Table>
                <p className="text-muted mb-0">
                  This section will later show unit breakdowns (case, box, piece) and conversion automatically.
                </p>
              </Card.Body>
            </Card>
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}

const MOCK_PRODUCTS = [
  {
    id: 'P-1001',
    name: 'Test Product 1',
    category: 'Beverages',
    brand: 'Acme',
    stock: 120,
    unitType: 'Piece',
    status: 'Active',
  },
  {
    id: 'P-1002',
    name: 'Test Product 2',
    category: 'Snacks',
    brand: 'Acme',
    stock: 48,
    unitType: 'Box',
    status: 'Low Stock',
  },
  {
    id: 'P-1003',
    name: 'Sample Product 3',
    category: 'Household',
    brand: 'CleanCo',
    stock: 0,
    unitType: 'Piece',
    status: 'Out of Stock',
  },
]

function ProductListTab() {
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    status: 'all',
  })

  const handleFilterChange = (field) => (e) => {
    setFilters((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const filtered = MOCK_PRODUCTS.filter((p) => {
    const matchesSearch =
      !filters.search ||
      p.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      p.id.toLowerCase().includes(filters.search.toLowerCase())

    const matchesCategory = filters.category === 'all' || p.category === filters.category

    const matchesStatus =
      filters.status === 'all' ||
      (filters.status === 'in' && p.stock > 0) ||
      (filters.status === 'out' && p.stock === 0)

    return matchesSearch && matchesCategory && matchesStatus
  })

  const renderStatusBadge = (product) => {
    if (product.stock === 0) return <Badge bg="danger">Out of stock</Badge>
    if (product.stock < 50) return <Badge bg="warning" text="dark">Low stock</Badge>
    return <Badge bg="success">In stock</Badge>
  }

  return (
    <Card>
      <Card.Header as="h5">Product List</Card.Header>
      <Card.Body>
        <Form className="mb-3">
          <div className="row g-3 align-items-end">
            <div className="col-md-4">
              <Form.Group>
                <Form.Label>Search</Form.Label>
                <Form.Control
                  placeholder="Product ID or name"
                  value={filters.search}
                  onChange={handleFilterChange('search')}
                />
              </Form.Group>
            </div>
            <div className="col-md-3">
              <Form.Group>
                <Form.Label>Category</Form.Label>
                <Form.Select value={filters.category} onChange={handleFilterChange('category')}>
                  <option value="all">All categories</option>
                  <option value="Beverages">Beverages</option>
                  <option value="Snacks">Snacks</option>
                  <option value="Household">Household</option>
                </Form.Select>
              </Form.Group>
            </div>
            <div className="col-md-3">
              <Form.Group>
                <Form.Label>Stock Status</Form.Label>
                <Form.Select value={filters.status} onChange={handleFilterChange('status')}>
                  <option value="all">All</option>
                  <option value="in">In stock</option>
                  <option value="out">Out of stock</option>
                </Form.Select>
              </Form.Group>
            </div>
          </div>
        </Form>

        <div className="table-responsive">
          <Table hover className="align-middle">
            <thead style={{ backgroundColor: '#f5f7fb' }}>
              <tr>
                <th>Product ID</th>
                <th>Name</th>
                <th>Category</th>
                <th>Brand</th>
                <th className="text-end">Stock</th>
                <th>Unit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.name}</td>
                  <td>{p.category}</td>
                  <td>{p.brand}</td>
                  <td className="text-end">{p.stock}</td>
                  <td>{p.unitType}</td>
                  <td>{renderStatusBadge(p)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted">
                    No products match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </Card.Body>
    </Card>
  )
}

function InventoryManagerPage() {
  const [active, setActive] = useState('stock')

  return (
    <>
      <h2 className="mb-4">Inventory Management</h2>
      <Nav variant="tabs" className="mb-4">
        <Nav.Item>
          <Nav.Link active={active === 'stock'} onClick={() => setActive('stock')}>
            Stock Update
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={active === 'products'} onClick={() => setActive('products')}>
            Product List
          </Nav.Link>
        </Nav.Item>
      </Nav>

      {active === 'stock' && <StockUpdateTab />}
      {active === 'products' && <ProductListTab />}
    </>
  )
}

export default InventoryManagerPage
