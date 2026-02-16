import * as React from "react";
import {
  Building2,
  CalendarClock,
  GalleryVerticalEnd,
  LayoutDashboard,
  LogOut,
  Package,
  Shield,
  Truck,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import {
  Sidebar,
  SidebarContent,
  SidebarGroupLabel,
  SidebarGroup,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

import type { Role } from "@/auth/types";
import { Button } from "@/components/ui/button";

type SidebarNavLinkProps = {
  to: string;
  label: string;
  end?: boolean;
  icon: React.ComponentType<{ className?: string }>;
};

function SidebarNavLink({ to, label, end, icon: Icon }: SidebarNavLinkProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={label}>
        <NavLink to={to} end={end}>
          <Icon />
          <span>{label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({
  userRole,
  userName,
  userEmail,
  userAvatarUrl,
  onSignOut,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  userRole: Role | null;
  userName: string | null;
  userEmail: string | null;
  userAvatarUrl: string | null;
  onSignOut: () => void;
}) {
  const initials = (userName ?? userEmail ?? "U")
    .trim()
    .slice(0, 1)
    .toUpperCase();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/" end>
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <GalleryVerticalEnd className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">Magic Yarn</span>
                  <span className="">Volunteer Portal</span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarNavLink
              to="/"
              end
              label="Dashboard"
              icon={LayoutDashboard}
            />
            <SidebarNavLink
              to="/recipients"
              label="Recipients"
              icon={Building2}
            />
            <SidebarNavLink to="/deliveries" label="Deliveries" icon={Truck} />
            <SidebarNavLink
              to="/delivery-planner"
              label="Delivery Planner"
              icon={CalendarClock}
            />
          </SidebarMenu>
        </SidebarGroup>

        {userRole === "admin" ? (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarNavLink to="/admin/users" label="Users" icon={Shield} />
              <SidebarNavLink
                to="/admin/permissions"
                label="Permissions"
                icon={Package}
              />
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex flex-col gap-2 p-2">
          <div className="flex items-center gap-2">
            {userAvatarUrl ? (
              <img
                src={userAvatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="size-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="bg-sidebar-accent text-sidebar-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                {initials}
              </div>
            )}
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-sm font-medium leading-5">
                {userName || userEmail || "Signed in"}
              </div>
              {userEmail ? (
                <div className="truncate text-xs text-muted-foreground">
                  {userEmail}
                </div>
              ) : null}
              {userRole ? (
                <div className="text-xs text-muted-foreground">
                  Role: {userRole}
                </div>
              ) : null}
            </div>
          </div>
          <Button
            variant="secondary"
            className="w-full justify-start gap-2 group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
            onClick={onSignOut}
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="size-4" />
            <span className="group-data-[collapsible=icon]:hidden">Logout</span>
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
