import { Card } from 'react-bootstrap'
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
      <Card>
        <Card.Body>
          <h5>Welcome, {user?.name}</h5>
          <p className="text-muted mb-0">
            You are logged in as <strong>{ROLE_LABELS[user?.role] || user?.role}</strong>.
          </p>
          <p className="mt-2 mb-0 small">
            Use the navigation above to access your role-specific features.
          </p>
        </Card.Body>
      </Card>
    </>
  )
}

export default DashboardPage
