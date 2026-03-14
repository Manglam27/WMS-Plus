import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './components/LoginPage'
import RoleDashboard from './components/RoleDashboard'
import AdminPage from './pages/AdminPage'
import InventoryUpdateStockPage from './pages/InventoryUpdateStockPage'
import AccountsPage from './pages/AccountsPage'
import ProductListPage from './pages/ProductListPage'
import NewProductPage from './pages/NewProductPage'
import ProductLabelPrintPage from './pages/ProductLabelPrintPage'
import EditProductPage from './pages/EditProductPage'
import PurchaseOrderDraftListPage from './pages/PurchaseOrderDraftListPage'
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
            <Route path="po/draft" element={<PurchaseOrderDraftListPage />} />
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
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
