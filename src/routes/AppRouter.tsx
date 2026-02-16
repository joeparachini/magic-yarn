import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { AppShell } from "../components/AppShell";
import { AdminUsers } from "../pages/AdminUsers";
import { AdminPermissions } from "../pages/AdminPermissions";
import { AwaitingApproval } from "../pages/AwaitingApproval";
import { Dashboard } from "../pages/Dashboard";
import { Login } from "../pages/Login";
import { NotFound } from "../pages/NotFound";
import { RecipientsList } from "../pages/RecipientsList";
import { RecipientEdit } from "../pages/RecipientEdit";
import { DeliveriesList } from "../pages/DeliveriesList";
import { DeliveryEdit } from "../pages/DeliveryEdit";
import { DeliveryPlanner } from "../pages/DeliveryPlanner";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/awaiting-approval" element={<AwaitingApproval />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route
            path="/recipients"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "admin",
                  "contacts_manager",
                  "delivery_coordinator",
                  "view_only",
                ]}
              />
            }
          >
            <Route index element={<RecipientsList />} />
            <Route path=":id" element={<RecipientEdit />} />
            <Route path="new" element={<RecipientEdit />} />
          </Route>

          <Route
            path="/deliveries"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "admin",
                  "contacts_manager",
                  "delivery_coordinator",
                  "view_only",
                ]}
              />
            }
          >
            <Route index element={<DeliveriesList />} />
            <Route path=":id" element={<DeliveryEdit />} />
            <Route path="new" element={<DeliveryEdit />} />
          </Route>

          <Route
            path="/delivery-planner"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "admin",
                  "contacts_manager",
                  "delivery_coordinator",
                ]}
              />
            }
          >
            <Route index element={<DeliveryPlanner />} />
          </Route>

          <Route
            path="/admin"
            element={<ProtectedRoute allowedRoles={["admin"]} />}
          >
            <Route path="users" element={<AdminUsers />} />
            <Route path="permissions" element={<AdminPermissions />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
