import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import toast from "react-hot-toast";

// Layouts
import AuthLayout from "./layouts/AuthLayout";
import AppLayout from "./layouts/AppLayout";

// Auth pages
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";

// Dashboard
import DashboardPage from "./pages/dashboard/DashboardPage";

// Products
import ProductListPage from "./pages/products/ProductListPage";
import ProductFormPage from "./pages/products/ProductFormPage";
import CategoryListPage from "./pages/products/CategoryListPage";
import ReorderRulesPage from "./pages/products/ReorderRulesPage";

// Operations
import ReceiptListPage from "./pages/receipts/ReceiptListPage";
import ReceiptFormPage from "./pages/receipts/ReceiptFormPage";
import DeliveryListPage from "./pages/deliveries/DeliveryListPage";
import DeliveryFormPage from "./pages/deliveries/DeliveryFormPage";
import TransferListPage from "./pages/transfers/TransferListPage";
import TransferFormPage from "./pages/transfers/TransferFormPage";
import AdjustmentListPage from "./pages/adjustments/AdjustmentListPage";
import AdjustmentFormPage from "./pages/adjustments/AdjustmentFormPage";
import MoveHistoryPage from "./pages/moves/MoveHistoryPage";

// Settings
import LocationSettingsPage from "./pages/settings/LocationSettingsPage";

function PrivateRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  if (!token)
    return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

/**
 * RoleGuard – restricts a route to users whose role is in `allowedRoles`.
 * Unauthorized users are redirected to /dashboard with an informative toast.
 */
function RoleGuard({ children, allowedRoles }) {
  const user = useAuthStore((s) => s.user);
  const role = user?.role || "staff";
  if (!allowedRoles.includes(role)) {
    toast.error("Access denied for your role.", { id: "role-guard" });
    return <Navigate to="/dashboard" replace />;
  }
  return children;
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

          {/* ── Manager only: Product Catalogue ── */}
          <Route
            path="/products"
            element={
              <RoleGuard allowedRoles={["manager"]}>
                <ProductListPage />
              </RoleGuard>
            }
          />
          <Route
            path="/products/new"
            element={
              <RoleGuard allowedRoles={["manager"]}>
                <ProductFormPage />
              </RoleGuard>
            }
          />
          <Route
            path="/products/:id/edit"
            element={
              <RoleGuard allowedRoles={["manager"]}>
                <ProductFormPage />
              </RoleGuard>
            }
          />
          <Route
            path="/products/categories"
            element={
              <RoleGuard allowedRoles={["manager"]}>
                <CategoryListPage />
              </RoleGuard>
            }
          />
          <Route
            path="/products/reorder-rules"
            element={
              <RoleGuard allowedRoles={["manager"]}>
                <ReorderRulesPage />
              </RoleGuard>
            }
          />

          {/* ── Manager only: Incoming Stock (Receipts) ── */}
          <Route
            path="/operations/receipts"
            element={
              <RoleGuard allowedRoles={["manager"]}>
                <ReceiptListPage />
              </RoleGuard>
            }
          />
          <Route
            path="/operations/receipts/new"
            element={
              <RoleGuard allowedRoles={["manager"]}>
                <ReceiptFormPage />
              </RoleGuard>
            }
          />
          <Route
            path="/operations/receipts/:id"
            element={
              <RoleGuard allowedRoles={["manager"]}>
                <ReceiptFormPage />
              </RoleGuard>
            }
          />

          {/* ── Manager only: Outgoing Stock (Deliveries) ── */}
          <Route
            path="/operations/deliveries"
            element={
              <RoleGuard allowedRoles={["manager"]}>
                <DeliveryListPage />
              </RoleGuard>
            }
          />
          <Route
            path="/operations/deliveries/new"
            element={
              <RoleGuard allowedRoles={["manager"]}>
                <DeliveryFormPage />
              </RoleGuard>
            }
          />
          <Route
            path="/operations/deliveries/:id"
            element={
              <RoleGuard allowedRoles={["manager"]}>
                <DeliveryFormPage />
              </RoleGuard>
            }
          />

          {/* ── Both roles: Transfers (picking, shelving, counting) ── */}
          <Route path="/operations/transfers" element={<TransferListPage />} />
          <Route
            path="/operations/transfers/new"
            element={<TransferFormPage />}
          />
          <Route
            path="/operations/transfers/:id"
            element={<TransferFormPage />}
          />

          {/* ── Staff only: Adjustments (stock counting) ── */}
          <Route
            path="/operations/adjustments"
            element={
              <RoleGuard allowedRoles={["staff"]}>
                <AdjustmentListPage />
              </RoleGuard>
            }
          />
          <Route
            path="/operations/adjustments/new"
            element={
              <RoleGuard allowedRoles={["staff"]}>
                <AdjustmentFormPage />
              </RoleGuard>
            }
          />
          <Route
            path="/operations/adjustments/:id"
            element={
              <RoleGuard allowedRoles={["staff"]}>
                <AdjustmentFormPage />
              </RoleGuard>
            }
          />

          {/* ── Both roles: Move History (read-only audit log) ── */}
          <Route path="/operations/moves" element={<MoveHistoryPage />} />

          {/* ── Manager only: Settings ── */}

          <Route
            path="/settings/locations"
            element={
              <RoleGuard allowedRoles={["manager"]}>
                <LocationSettingsPage />
              </RoleGuard>
            }
          />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
