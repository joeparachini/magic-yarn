import { useEffect, useMemo, useState } from "react";
import type { Role } from "../auth/types";
import { Button } from "../components/ui/button";
import { supabase } from "../lib/supabaseClient";

type AppPermission =
  | "recipients.read"
  | "recipients.write"
  | "recipients.delete"
  | "deliveries.read"
  | "deliveries.write"
  | "deliveries.delete";

type RolePermissionRow = {
  role: Role;
  permission: AppPermission;
  allowed: boolean;
  updated_at: string;
};

const editableRoles: Role[] = [
  "contacts_manager",
  "delivery_coordinator",
  "view_only",
];

const permissions: Array<{
  group: string;
  permission: AppPermission;
  label: string;
}> = [
  {
    group: "Recipients",
    permission: "recipients.read",
    label: "Read recipients",
  },
  {
    group: "Recipients",
    permission: "recipients.write",
    label: "Create/update recipients",
  },
  {
    group: "Recipients",
    permission: "recipients.delete",
    label: "Delete recipients",
  },
  {
    group: "Deliveries",
    permission: "deliveries.read",
    label: "Read deliveries",
  },
  {
    group: "Deliveries",
    permission: "deliveries.write",
    label: "Create/update deliveries",
  },
  {
    group: "Deliveries",
    permission: "deliveries.delete",
    label: "Delete deliveries",
  },
];

export function AdminPermissions() {
  const [rows, setRows] = useState<RolePermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("role_permissions")
      .select("role, permission, allowed, updated_at")
      .in("role", editableRoles)
      .order("role")
      .order("permission");

    if (error) {
      setError(error.message);
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as RolePermissionRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const key = (r: Role, p: AppPermission) => `${r}:${p}`;

  const allowedMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const r of rows) {
      map.set(key(r.role, r.permission), r.allowed);
    }
    return map;
  }, [rows]);

  const toggle = async (
    role: Role,
    permission: AppPermission,
    allowed: boolean,
  ) => {
    const k = key(role, permission);
    setSavingKey(k);
    setError(null);

    const { error } = await supabase.from("role_permissions").upsert(
      {
        role,
        permission,
        allowed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "role,permission" },
    );

    if (error) {
      setError(error.message);
      setSavingKey(null);
      return;
    }

    await load();
    setSavingKey(null);
  };

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof permissions>();
    for (const p of permissions) {
      const list = groups.get(p.group) ?? [];
      list.push(p);
      groups.set(p.group, list);
    }
    return Array.from(groups.entries());
  }, []);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Permissions</h1>
          <p className="text-sm text-muted-foreground">
            Toggle what each role is allowed to do. Admin is always allowed.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => void load()}
          disabled={loading || savingKey !== null}
        >
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([group, perms]) => (
            <div
              key={group}
              className="rounded-xl border border-border bg-card/80"
            >
              <div className="border-b border-border bg-muted/35 px-3 py-2 text-sm font-medium">
                {group}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-180 table-fixed text-sm">
                  <colgroup>
                    <col className="w-1/2" />
                    {editableRoles.map((r) => (
                      <col key={r} className="w-1/6" />
                    ))}
                  </colgroup>
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left align-top">
                        Permission
                      </th>
                      {editableRoles.map((r) => (
                        <th
                          key={r}
                          className="px-3 py-2 text-center align-top whitespace-nowrap"
                        >
                          {r}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {perms.map((p) => (
                      <tr
                        key={p.permission}
                        className="border-t border-border/80 hover:bg-muted/20"
                      >
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium">{p.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.permission}
                          </div>
                        </td>
                        {editableRoles.map((r) => {
                          const k = key(r, p.permission);
                          const isAllowed = allowedMap.get(k) ?? false;
                          return (
                            <td key={k} className="px-3 py-2 align-top">
                              <label className="flex w-full items-center justify-center gap-2 pt-0.5">
                                <input
                                  type="checkbox"
                                  checked={isAllowed}
                                  disabled={savingKey === k}
                                  onChange={(e) =>
                                    void toggle(
                                      r,
                                      p.permission,
                                      e.target.checked,
                                    )
                                  }
                                />
                                <span className="text-sm">
                                  {isAllowed ? "Allowed" : "Denied"}
                                </span>
                              </label>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
