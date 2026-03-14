import { Outlet, useNavigate, NavLink } from 'react-router-dom'
import { Navbar, Nav, Container, Button } from 'react-bootstrap'
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

function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const role = user?.role

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      <Navbar
        expand="lg"
        style={{ backgroundColor: '#1E1E2C' }} // Primary 2 – header
        variant="dark"
      >
        <Container>
          <Navbar.Brand as={NavLink} to="/" className="d-flex align-items-center">
            <img
              src="/logo.png"
              alt="WMS-Plus"
              style={{ height: 30, width: 'auto' }}
            />
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
              <Nav className="me-auto" />
            <Nav className="align-items-center gap-2">
              <span className="text-light small">
                {user?.name} ({ROLE_LABELS[user?.role] || user?.role})
              </span>
              <Button
                size="sm"
                onClick={handleLogout}
                style={{
                  backgroundColor: '#F29F67', // Primary 1 – button
                  borderColor: '#F29F67',
                  color: '#1E1E2C',
                }}
              >
                Logout
              </Button>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container fluid className="py-4">
        <div className="d-flex">
          <aside
            className="border-end app-sidebar"
            style={{ width: 250, minHeight: 'calc(100vh - 72px)' }}
          >
            <div className="app-sidebar-inner">
              <nav className="small">
                <div className="mb-3">
                  <div className="app-sidebar-section-title">Main</div>
                  <Nav className="flex-column">
                    <Nav.Link as={NavLink} to="/" end>
                      <span>Dashboard</span>
                      <span>›</span>
                    </Nav.Link>
                  </Nav>
                </div>

              {role === 'inventory_manager' && (
                <>
                  <div className="mb-3">
                    <div className="app-sidebar-section-title">Inventory</div>
                    <Nav className="flex-column">
                      <Nav.Link as={NavLink} to="/inventory/update-stock">
                        <span>Update stock</span>
                        <span>›</span>
                      </Nav.Link>
                    </Nav>
                  </div>

                  <div className="mb-3">
                    <div className="app-sidebar-section-title">Product</div>
                    <Nav className="flex-column">
                      <Nav.Link as={NavLink} to="/products/list">
                        <span>Product list</span>
                        <span>›</span>
                      </Nav.Link>
                      <Nav.Link as={NavLink} to="/products/new">
                        <span>New products</span>
                        <span>›</span>
                      </Nav.Link>
                    </Nav>
                  </div>

                  <div className="mb-3">
                    <div className="app-sidebar-section-title">Purchase order</div>
                    <Nav className="flex-column">
                      <Nav.Link as={NavLink} to="/po/draft">
                        <span>Draft PO list</span>
                        <span>›</span>
                      </Nav.Link>
                      <Nav.Link as={NavLink} to="/po/list">
                        <span>PO list</span>
                        <span>›</span>
                      </Nav.Link>
                    </Nav>
                  </div>

                  <div className="mb-3">
                    <div className="app-sidebar-section-title">Vendor</div>
                    <Nav className="flex-column">
                      <Nav.Link as={NavLink} to="/vendors/list">
                        <span>Vendor list</span>
                        <span>›</span>
                      </Nav.Link>
                      <Nav.Link as={NavLink} to="/vendors/payment">
                        <span>Vendor payment</span>
                        <span>›</span>
                      </Nav.Link>
                      <Nav.Link as={NavLink} to="/vendors/payment-history">
                        <span>Vendor payment history</span>
                        <span>›</span>
                      </Nav.Link>
                    </Nav>
                  </div>

                  <div className="mb-3">
                    <div className="app-sidebar-section-title">Reports</div>
                    <Nav className="flex-column">
                      <Nav.Link as={NavLink} to="/reports/onhand">
                        <span>On hand</span>
                        <span>›</span>
                      </Nav.Link>
                      <Nav.Link as={NavLink} to="/reports/manual-stock-update">
                        <span>Manual stock update</span>
                        <span>›</span>
                      </Nav.Link>
                    </Nav>
                  </div>
                </>
              )}

              {role === 'inventory_receiver' && (
                <>
                  <div className="mb-3">
                    <div className="app-sidebar-section-title">Inventory</div>
                    <Nav className="flex-column">
                      <Nav.Link as={NavLink} to="/inventory/update-stock">
                        <span>Update stock</span>
                        <span>›</span>
                      </Nav.Link>
                    </Nav>
                  </div>
                  <div className="mb-3">
                    <div className="app-sidebar-section-title">Purchase Order</div>
                    <Nav className="flex-column">
                      <Nav.Link as={NavLink} to="/po/generate">
                        <span>Generate PO</span>
                        <span>›</span>
                      </Nav.Link>
                      <Nav.Link as={NavLink} to="/po/list">
                        <span>PO List</span>
                        <span>›</span>
                      </Nav.Link>
                    </Nav>
                  </div>
                  <div className="mb-3">
                    <div className="app-sidebar-section-title">Vendor</div>
                    <Nav className="flex-column">
                      <Nav.Link as={NavLink} to="/vendors/credit-memo">
                        <span>Vendor credit memo</span>
                        <span>›</span>
                      </Nav.Link>
                      <Nav.Link as={NavLink} to="/vendors/credit-memo/list">
                        <span>Vendor credit memo list</span>
                        <span>›</span>
                      </Nav.Link>
                    </Nav>
                  </div>
                </>
              )}

              {role === 'accounts' && (
                <div className="mb-3">
                  <div className="app-sidebar-section-title">Accounts</div>
                  <Nav className="flex-column">
                    <Nav.Link as={NavLink} to="/accounts">
                      <span>Accounts dashboard</span>
                      <span>›</span>
                    </Nav.Link>
                  </Nav>
                </div>
              )}

              {role === 'admin' && (
                <div className="mb-3">
                  <div className="app-sidebar-section-title">Administration</div>
                  <Nav className="flex-column">
                    <Nav.Link as={NavLink} to="/admin">
                      <span>User management</span>
                      <span>›</span>
                    </Nav.Link>
                  </Nav>
                </div>
              )}
              </nav>
            </div>
          </aside>

          <main className="flex-grow-1 ps-3">
            <Outlet />
          </main>
        </div>
      </Container>
    </>
  )
}

export default Layout
