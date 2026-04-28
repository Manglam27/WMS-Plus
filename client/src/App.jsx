import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './components/LoginPage'
import RoleDashboard from './components/RoleDashboard'
import AdminPage from './pages/AdminPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminUserLogsPage from './pages/AdminUserLogsPage'
import InventoryUpdateStockPage from './pages/InventoryUpdateStockPage'
import AccountsPage from './pages/AccountsPage'
import ProductListPage from './pages/ProductListPage'
import NewProductPage from './pages/NewProductPage'
import ProductLabelPrintPage from './pages/ProductLabelPrintPage'
import EditProductPage from './pages/EditProductPage'
import PurchaseOrderDraftListPage from './pages/PurchaseOrderDraftListPage'
import PurchaseOrderReceivedListPage from './pages/PurchaseOrderReceivedListPage'
import PurchaseOrderListPage from './pages/PurchaseOrderListPage'
import EditPOPage from './pages/EditPOPage'
import GeneratePOPage from './pages/GeneratePOPage'
import VendorCreditMemoPage from './pages/VendorCreditMemoPage'
import VendorCreditMemoListPage from './pages/VendorCreditMemoListPage'
import VendorListPage from './pages/VendorListPage'
import NewVendorPage from './pages/NewVendorPage'
import VendorDetailsPage from './pages/VendorDetailsPage'
import VendorPaymentPage from './pages/VendorPaymentPage'
import VendorPaymentHistoryPage from './pages/VendorPaymentHistoryPage'
import ReportsOnhandPage from './pages/ReportsOnhandPage'
import ReportsManualStockUpdatePage from './pages/ReportsManualStockUpdatePage'
import NewCustomerPage from './pages/sales/NewCustomerPage'
import CustomersListPage from './pages/sales/CustomersListPage'
import CustomerDetailsPage from './pages/sales/CustomerDetailsPage'
import DraftCustomersPage from './pages/sales/DraftCustomersPage'
import ManagePriceLevelsPage from './pages/sales/ManagePriceLevelsPage'
import NewSalesCreditMemoPage from './pages/sales/NewSalesCreditMemoPage'
import SalesCreditMemoListPage from './pages/sales/SalesCreditMemoListPage'
import DraftOrdersListPage from './pages/sales/DraftOrdersListPage'
import NewOrderPage from './pages/sales/NewOrderPage'
import OrdersListPage from './pages/sales/OrdersListPage'
import OrderDetailsPage from './pages/sales/OrderDetailsPage'
import SalesProductListPage from './pages/sales/SalesProductListPage'
import ReceivePaymentPage from './pages/sales/ReceivePaymentPage'
import AssignDriverPage from './pages/sales/AssignDriverPage'
import OrderManagerPage from './pages/OrderManagerPage'
import WarehouseOrderProcessingPage from './pages/WarehouseOrderProcessingPage'
import WarehouseTodoPage from './pages/WarehouseTodoPage'
import WarehouseOrderOpenPage from './pages/WarehouseOrderOpenPage'
import PackerOrderOpenPage from './pages/PackerOrderOpenPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* Standalone print route without navbar/sidebar */}
          <Route
            path="/products/print/:id"
            element={
              <ProtectedRoute>
                <ProductLabelPrintPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RoleDashboard />} />
            <Route path="inventory/update-stock" element={<InventoryUpdateStockPage />} />
            <Route
              path="accounts"
              element={
                <ProtectedRoute roles={['accounts', 'admin']}>
                  <AccountsPage />
                </ProtectedRoute>
              }
            />
            <Route path="products/list" element={<ProductListPage />} />
            <Route path="products/new" element={<NewProductPage />} />
            <Route
              path="products/edit/:id"
              element={
                <ProtectedRoute roles={['inventory_manager', 'admin']}>
                  <EditProductPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="po/draft"
              element={
                <ProtectedRoute roles={['inventory_manager', 'admin']}>
                  <PurchaseOrderDraftListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="po/received"
              element={
                <ProtectedRoute roles={['inventory_manager', 'admin']}>
                  <PurchaseOrderReceivedListPage />
                </ProtectedRoute>
              }
            />
            <Route path="po/generate" element={<GeneratePOPage />} />
            <Route path="po/list" element={<PurchaseOrderListPage />} />
            <Route path="po/edit/:id" element={<EditPOPage />} />
            <Route path="vendors/credit-memo" element={<VendorCreditMemoPage />} />
            <Route path="vendors/credit-memo/list" element={<VendorCreditMemoListPage />} />
            <Route path="vendors/list" element={<VendorListPage />} />
            <Route path="vendors/new" element={<NewVendorPage />} />
            <Route path="vendors/details/:id" element={<VendorDetailsPage />} />
            <Route path="vendors/payment" element={<VendorPaymentPage />} />
            <Route path="vendors/payment-history" element={<VendorPaymentHistoryPage />} />
            <Route path="reports/onhand" element={<ReportsOnhandPage />} />
            <Route path="reports/manual-stock-update" element={<ReportsManualStockUpdatePage />} />
            <Route
              path="admin"
              element={
                <ProtectedRoute roles={['admin']}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/users"
              element={
                <ProtectedRoute roles={['admin']}>
                  <AdminUsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/logs"
              element={
                <ProtectedRoute roles={['admin']}>
                  <AdminUserLogsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="warehouse/orders"
              element={
                <ProtectedRoute roles={['order_manager', 'admin']}>
                  <OrderManagerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="warehouse/orders/processing"
              element={
                <ProtectedRoute roles={['order_manager', 'admin']}>
                  <WarehouseOrderProcessingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="warehouse/orders/:id"
              element={
                <ProtectedRoute roles={['order_manager', 'admin']}>
                  <WarehouseOrderOpenPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="warehouse/todo"
              element={
                <ProtectedRoute roles={['order_manager', 'admin']}>
                  <WarehouseTodoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="packer/orders/:id"
              element={
                <ProtectedRoute roles={['scanner_packer', 'admin']}>
                  <PackerOrderOpenPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="sales/customers/new"
              element={
                <ProtectedRoute roles={['sales_person', 'sales_manager', 'admin']}>
                  <NewCustomerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="sales/customers"
              element={
                <ProtectedRoute roles={['sales_person', 'sales_manager', 'admin']}>
                  <CustomersListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="sales/customers/draft"
              element={
                <ProtectedRoute roles={['sales_manager', 'admin']}>
                  <DraftCustomersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="sales/customers/price-levels"
              element={
                <ProtectedRoute roles={['sales_manager', 'admin']}>
                  <ManagePriceLevelsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="sales/customers/:id"
              element={
                <ProtectedRoute roles={['sales_person', 'sales_manager', 'admin']}>
                  <CustomerDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="sales/credit-memo/new"
              element={
                <ProtectedRoute roles={['sales_person', 'sales_manager', 'admin']}>
                  <NewSalesCreditMemoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="sales/credit-memo/list"
              element={
                <ProtectedRoute roles={['sales_person', 'sales_manager', 'admin']}>
                  <SalesCreditMemoListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="sales/orders/draft"
              element={
                <ProtectedRoute roles={['sales_person', 'admin']}>
                  <DraftOrdersListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="sales/orders/new"
              element={
                <ProtectedRoute roles={['sales_person', 'sales_manager', 'admin']}>
                  <NewOrderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="sales/orders/:id"
              element={
                <ProtectedRoute roles={['sales_person', 'sales_manager', 'admin']}>
                  <OrderDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="sales/orders"
              element={
                <ProtectedRoute roles={['sales_person', 'sales_manager', 'admin']}>
                  <OrdersListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="sales/orders/assign-driver"
              element={
                <ProtectedRoute roles={['sales_manager', 'admin']}>
                  <AssignDriverPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="sales/products"
              element={
                <ProtectedRoute roles={['sales_person', 'sales_manager', 'admin']}>
                  <SalesProductListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="sales/payments"
              element={
                <ProtectedRoute roles={['sales_person', 'sales_manager', 'admin']}>
                  <ReceivePaymentPage />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
