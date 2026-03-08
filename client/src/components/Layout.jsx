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

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand as={NavLink} to="/">WMS-Plus</Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
            <Nav className="me-auto">
              <Nav.Link as={NavLink} to="/">Dashboard</Nav.Link>
              {user?.role === 'admin' && <Nav.Link as={NavLink} to="/admin">Users</Nav.Link>}
            </Nav>
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
      <Container className="py-4">
        <Outlet />
      </Container>
    </>
  )
}

export default Layout
