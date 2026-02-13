import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Role } from "../auth/types";
import { Button } from "../components/ui/button";

type UserProfileRow = {
  id: string;
  role: Role;
  full_name: string | null;
  email?: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

const roles: Role[] = [
  "admin",
  "contacts_manager",
  "delivery_coordinator",
  "view_only",
];

export function AdminUsers() {
  const [rows, setRows] = useState<UserProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("admin_list_users");

    if (error) {
      setError(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const normalized = (data ?? []).map((row: any) => ({
      ...row,
      role: row.role as Role,
      email: row.email ?? null,
      avatar_url: row.avatar_url ?? null,
    }));

    setRows(normalized as UserProfileRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const haystack =
        `${r.full_name ?? ""} ${r.email ?? ""} ${r.id} ${r.role}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, rows]);

  const initials = (row: UserProfileRow) => {
    const source = (row.full_name ?? row.email ?? "").trim();
    if (!source) return "U";

    const words = source.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  };

  const setRole = async (userId: string, newRole: Role) => {
    const current = byId.get(userId);
    if (!current || current.role === newRole) return;

    setSavingId(userId);
    setError(null);
    const { error } = await supabase.rpc("admin_set_user_role", {
      target_user_id: userId,
      new_role: newRole,
    });

    if (error) {
      setError(error.message);
      setSavingId(null);
      return;
    }

    await load();
    setSavingId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-neutral-600">
          Assign roles for team members.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          className="w-full max-w-md rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          placeholder="Search users…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="text-xs text-neutral-600">{filtered.length} shown</div>
      </div>

      {loading ? (
        <div className="text-sm text-neutral-600">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">User ID</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-neutral-200">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      {r.avatar_url ? (
                        <img
                          src={r.avatar_url}
                          alt={r.full_name ?? r.email ?? "User avatar"}
                          className="h-8 w-8 rounded-full border border-neutral-200 object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-xs font-semibold text-neutral-700">
                          {initials(r)}
                        </div>
                      )}
                      <div className="font-medium">{r.full_name ?? "—"}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-neutral-700">
                    {r.email ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-600">
                    {r.id}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-56 rounded-md border border-neutral-300 bg-white px-2 py-1"
                      value={r.role}
                      onChange={(e) =>
                        void setRole(r.id, e.target.value as Role)
                      }
                      disabled={savingId === r.id}
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="secondary"
                      onClick={() => void load()}
                      disabled={loading || savingId !== null}
                    >
                      Refresh
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-sm text-neutral-600"
                    colSpan={5}
                  >
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
