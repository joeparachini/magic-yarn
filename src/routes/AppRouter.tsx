import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { AppShell } from "../components/AppShell";
import { AdminUsers } from "../pages/AdminUsers";
import { AdminPermissions } from "../pages/AdminPermissions";
import { Dashboard } from "../pages/Dashboard";
import { Login } from "../pages/Login";
import { NotFound } from "../pages/NotFound";
import { OrganizationsList } from "../pages/OrganizationsList";
import { OrganizationEdit } from "../pages/OrganizationEdit";
import { ContactsList } from "../pages/ContactsList";
import { ContactEdit } from "../pages/ContactEdit";
import { DeliveriesList } from "../pages/DeliveriesList";
import { DeliveryEdit } from "../pages/DeliveryEdit";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route
            path="/contacts"
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
            <Route index element={<ContactsList />} />
            <Route path=":id" element={<ContactEdit />} />
            <Route path="new" element={<ContactEdit />} />
          </Route>

          <Route
            path="/organizations"
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
            <Route index element={<OrganizationsList />} />
            <Route path=":id" element={<OrganizationEdit />} />
            <Route path="new" element={<OrganizationEdit />} />
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
