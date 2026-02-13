import { Fragment, useMemo } from "react";
import { Moon, Sun } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useTheme } from "./ThemeProvider";
import { Button } from "./ui/button";
import { AppSidebar } from "./app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./ui/sidebar";

type Crumb = { label: string; href?: string };

function buildBreadcrumbs(pathname: string): Crumb[] {
  if (pathname === "/" || pathname === "") {
    return [{ label: "Dashboard" }];
  }

  const segments = pathname.split("/").filter(Boolean);
  const [first, second] = segments;

  const crumbs: Crumb[] = [{ label: "Dashboard", href: "/" }];

  switch (first) {
    case "contacts":
      crumbs.push({ label: "Contacts", href: "/contacts" });
      if (second) crumbs.push({ label: second === "new" ? "New" : "Edit" });
      break;
    case "organizations":
      crumbs.push({ label: "Organizations", href: "/organizations" });
      if (second) crumbs.push({ label: second === "new" ? "New" : "Edit" });
      break;
    case "deliveries":
      crumbs.push({ label: "Deliveries", href: "/deliveries" });
      if (second) crumbs.push({ label: second === "new" ? "New" : "Edit" });
      break;
    case "admin":
      crumbs.push({ label: "Admin" });
      if (second === "users") crumbs.push({ label: "Users" });
      else if (second === "permissions") crumbs.push({ label: "Permissions" });
      else if (second) crumbs.push({ label: second });
      break;
    default:
      crumbs.push({ label: first.charAt(0).toUpperCase() + first.slice(1) });
      if (second) crumbs.push({ label: second });
      break;
  }

  const last = crumbs[crumbs.length - 1];
  crumbs[crumbs.length - 1] = { label: last.label };
  return crumbs;
}

export function AppShell() {
  const { user, role, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const userName =
    (user?.user_metadata?.full_name as string | undefined) ?? null;
  const userEmail = user?.email ?? null;
  const userAvatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ?? null;
  const location = useLocation();
  const crumbs = useMemo(
    () => buildBreadcrumbs(location.pathname),
    [location.pathname],
  );

  return (
    <SidebarProvider>
      <AppSidebar
        userRole={role}
        userName={userName}
        userEmail={userEmail}
        userAvatarUrl={userAvatarUrl}
        onSignOut={() => void signOut()}
      />
      <SidebarInset className="bg-sidebar/35 text-sidebar-foreground md:border md:border-sidebar-border/60">
        <header className="flex items-center justify-between border-b border-sidebar-border/70 bg-sidebar/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Breadcrumb>
              <BreadcrumbList>
                {crumbs.map((crumb, index) => (
                  <Fragment key={`${crumb.label}-${index}`}>
                    <BreadcrumbItem>
                      {crumb.href ? (
                        <BreadcrumbLink asChild>
                          <Link to={crumb.href}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                    {index < crumbs.length - 1 ? <BreadcrumbSeparator /> : null}
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={
              theme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </header>

        <main className="min-w-0 flex-1 overflow-auto bg-sidebar/35 p-4">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
