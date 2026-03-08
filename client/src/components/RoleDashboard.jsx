import { useAuth } from '../context/AuthContext'
import DashboardPage from '../pages/DashboardPage'
import InventoryManagerPage from '../pages/InventoryManagerPage'
import AccountsPage from '../pages/AccountsPage'
import SalesManagerPage from '../pages/SalesManagerPage'
import OrderManagerPage from '../pages/OrderManagerPage'
import InventoryReceiverPage from '../pages/InventoryReceiverPage'
import ScannerPackerPage from '../pages/ScannerPackerPage'
import SalesPersonPage from '../pages/SalesPersonPage'
import DriverPage from '../pages/DriverPage'
import PickerPage from '../pages/PickerPage'

const ROLE_PAGES = {
  admin: DashboardPage,
  accounts: AccountsPage,
  order_manager: OrderManagerPage,
  inventory_manager: InventoryManagerPage,
  inventory_receiver: InventoryReceiverPage,
  sales_manager: SalesManagerPage,
  scanner_packer: ScannerPackerPage,
  picker: PickerPage,
  sales_person: SalesPersonPage,
  driver: DriverPage,
}

function RoleDashboard() {
  const { user } = useAuth()
  const Page = ROLE_PAGES[user?.role] || DashboardPage
  return <Page />
}

export default RoleDashboard
