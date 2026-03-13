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
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand as={NavLink} to="/">
            WMS-Plus
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
              <Nav className="me-auto" />
            <Nav className="align-items-center gap-2">
              <span className="text-light small">
                {user?.name} ({ROLE_LABELS[user?.role] || user?.role})
              </span>
              <Button variant="outline-light" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container fluid className="py-4">
        <div className="d-flex">
          <aside
            className="border-end pe-3 app-sidebar"
            style={{ width: 240, minHeight: 'calc(100vh - 72px)' }}
          >
            <nav className="small">
              <div className="mb-3">
                <div className="text-uppercase text-muted mb-1 app-sidebar-section-title">Main</div>
                <Nav className="flex-column">
                  <Nav.Link as={NavLink} to="/" end>
                    Dashboard
                  </Nav.Link>
                </Nav>
              </div>

              {role === 'inventory_manager' && (
                <>
                  <div className="mb-3">
                    <div className="text-uppercase text-muted mb-1 app-sidebar-section-title">Inventory</div>
                    <Nav className="flex-column ms-2">
                      <Nav.Link as={NavLink} to="/inventory/update-stock">
                        Update stock
                      </Nav.Link>
                    </Nav>
                  </div>

                  <div className="mb-3">
                    <div className="text-uppercase text-muted mb-1 app-sidebar-section-title">Product</div>
                    <Nav className="flex-column ms-2">
                      <Nav.Link as={NavLink} to="/products/list">
                        Product list
                      </Nav.Link>
                      <Nav.Link as={NavLink} to="/products/new">
                        New products
                      </Nav.Link>
                    </Nav>
                  </div>

                  <div className="mb-3">
                    <div className="text-uppercase text-muted mb-1 app-sidebar-section-title">Purchase order</div>
                    <Nav className="flex-column ms-2">
                      <Nav.Link as={NavLink} to="/po/draft">
                        Draft PO list
                      </Nav.Link>
                      <Nav.Link as={NavLink} to="/po/list">
                        PO list
                      </Nav.Link>
                    </Nav>
                  </div>

                  <div className="mb-3">
                    <div className="text-uppercase text-muted mb-1 app-sidebar-section-title">Vendor</div>
                    <Nav className="flex-column ms-2">
                      <Nav.Link as={NavLink} to="/vendors/list">
                        Vendor list
                      </Nav.Link>
                      <Nav.Link as={NavLink} to="/vendors/payment">
                        Vendor payment
                      </Nav.Link>
                      <Nav.Link as={NavLink} to="/vendors/payment-history">
                        Vendor payment history
                      </Nav.Link>
                    </Nav>
                  </div>

                  <div className="mb-3">
                    <div className="text-uppercase text-muted mb-1 app-sidebar-section-title">Reports</div>
                    <Nav className="flex-column ms-2">
                      <Nav.Link as={NavLink} to="/reports/onhand">
                        On hand
                      </Nav.Link>
                      <Nav.Link as={NavLink} to="/reports/manual-stock-update">
                        Manual stock update
                      </Nav.Link>
                    </Nav>
                  </div>
                </>
              )}

              {role === 'accounts' && (
                <div className="mb-3">
                  <div className="text-uppercase text-muted mb-1 app-sidebar-section-title">Accounts</div>
                  <Nav className="flex-column ms-2">
                    <Nav.Link as={NavLink} to="/accounts">
                      Accounts dashboard
                    </Nav.Link>
                  </Nav>
                </div>
              )}

              {role === 'admin' && (
                <div className="mb-3">
                  <div className="text-uppercase text-muted mb-1 app-sidebar-section-title">Administration</div>
                  <Nav className="flex-column ms-2">
                    <Nav.Link as={NavLink} to="/admin">
                      User management
                    </Nav.Link>
                  </Nav>
                </div>
              )}
            </nav>
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
