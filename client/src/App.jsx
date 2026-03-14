import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

// Layouts
import AuthLayout from './layouts/AuthLayout'
import AppLayout from './layouts/AppLayout'

// Auth pages
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'

// Dashboard
import DashboardPage from './pages/dashboard/DashboardPage'

// Products
import ProductListPage from './pages/products/ProductListPage'
import ProductFormPage from './pages/products/ProductFormPage'
import CategoryListPage from './pages/products/CategoryListPage'
import ReorderRulesPage from './pages/products/ReorderRulesPage'

// Operations
import ReceiptListPage from './pages/receipts/ReceiptListPage'
import ReceiptFormPage from './pages/receipts/ReceiptFormPage'
import DeliveryListPage from './pages/deliveries/DeliveryListPage'
import DeliveryFormPage from './pages/deliveries/DeliveryFormPage'
import TransferListPage from './pages/transfers/TransferListPage'
import TransferFormPage from './pages/transfers/TransferFormPage'
import AdjustmentListPage from './pages/adjustments/AdjustmentListPage'
import AdjustmentFormPage from './pages/adjustments/AdjustmentFormPage'
import MoveHistoryPage from './pages/moves/MoveHistoryPage'

// Settings
import WarehouseSettingsPage from './pages/settings/WarehouseSettingsPage'
import LocationSettingsPage from './pages/settings/LocationSettingsPage'

function PrivateRoute({ children }) {
  const token = useAuthStore((s) => s.token)
  const location = useLocation()
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* Protected app routes */}
        <Route
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Products */}
          <Route path="/products" element={<ProductListPage />} />
          <Route path="/products/new" element={<ProductFormPage />} />
          <Route path="/products/:id/edit" element={<ProductFormPage />} />
          <Route path="/products/categories" element={<CategoryListPage />} />
          <Route path="/products/reorder-rules" element={<ReorderRulesPage />} />

          {/* Receipts */}
          <Route path="/operations/receipts" element={<ReceiptListPage />} />
          <Route path="/operations/receipts/new" element={<ReceiptFormPage />} />
          <Route path="/operations/receipts/:id" element={<ReceiptFormPage />} />

          {/* Deliveries */}
          <Route path="/operations/deliveries" element={<DeliveryListPage />} />
          <Route path="/operations/deliveries/new" element={<DeliveryFormPage />} />
          <Route path="/operations/deliveries/:id" element={<DeliveryFormPage />} />

          {/* Internal Transfers */}
          <Route path="/operations/transfers" element={<TransferListPage />} />
          <Route path="/operations/transfers/new" element={<TransferFormPage />} />
          <Route path="/operations/transfers/:id" element={<TransferFormPage />} />

          {/* Adjustments */}
          <Route path="/operations/adjustments" element={<AdjustmentListPage />} />
          <Route path="/operations/adjustments/new" element={<AdjustmentFormPage />} />
          <Route path="/operations/adjustments/:id" element={<AdjustmentFormPage />} />

          {/* Move History */}
          <Route path="/operations/moves" element={<MoveHistoryPage />} />

          {/* Settings */}
          <Route path="/settings/warehouses" element={<WarehouseSettingsPage />} />
          <Route path="/settings/locations" element={<LocationSettingsPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
