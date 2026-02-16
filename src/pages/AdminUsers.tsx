import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import type { Role } from "../auth/types";
import { Button } from "../components/ui/button";

type UserProfileRow = {
  id: string;
  role: Role;
  is_approved: boolean;
  full_name: string | null;
  email?: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type RegionRow = {
  code: string;
  name: string;
  sort_order: number;
};

type UserRegionRow = {
  user_id: string;
  region_code: string;
};

type SortKey = "name" | "email" | "role" | "approved" | "regions";
type SortDir = "asc" | "desc";

const SORT_KEYS: SortKey[] = ["name", "email", "role", "approved", "regions"];

function toSortKey(value: string | null): SortKey | null {
  if (!value) return null;
  if (SORT_KEYS.includes(value as SortKey)) return value as SortKey;
  return null;
}

function toSortDir(value: string | null): SortDir {
  return value === "desc" ? "desc" : "asc";
}

const roles: Role[] = [
  "admin",
  "contacts_manager",
  "delivery_coordinator",
  "view_only",
];

export function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<UserProfileRow[]>([]);
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [regionsByUserId, setRegionsByUserId] = useState<
    Record<string, string[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const sortKey = toSortKey(searchParams.get("sort"));
  const sortDir = toSortDir(searchParams.get("dir"));

  const load = async () => {
    setLoading(true);
    setError(null);
    const [usersRes, regionsRes, userRegionsRes] = await Promise.all([
      supabase.rpc("admin_list_users"),
      supabase.rpc("admin_list_regions"),
      supabase.rpc("admin_list_user_regions"),
    ]);

    if (usersRes.error || regionsRes.error || userRegionsRes.error) {
      setError(
        usersRes.error?.message ??
          regionsRes.error?.message ??
          userRegionsRes.error?.message ??
          "Failed to load users.",
      );
      setRows([]);
      setRegions([]);
      setRegionsByUserId({});
      setLoading(false);
      return;
    }

    const normalized = (usersRes.data ?? []).map((row: any) => ({
      ...row,
      role: row.role as Role,
      is_approved: Boolean(row.is_approved),
      email: row.email ?? null,
      avatar_url: row.avatar_url ?? null,
    }));

    const membershipMap: Record<string, string[]> = {};
    for (const item of (userRegionsRes.data ?? []) as UserRegionRow[]) {
      if (!membershipMap[item.user_id]) {
        membershipMap[item.user_id] = [];
      }
      membershipMap[item.user_id].push(item.region_code);
    }

    setRows(normalized as UserProfileRow[]);
    setRegions((regionsRes.data ?? []) as RegionRow[]);
    setRegionsByUserId(membershipMap);
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

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;

    const withIndex = filtered.map((row, index) => ({ row, index }));
    const direction = sortDir === "asc" ? 1 : -1;

    withIndex.sort((a, b) => {
      const left = a.row;
      const right = b.row;

      let result = 0;
      if (sortKey === "name") {
        result = (left.full_name ?? "").localeCompare(right.full_name ?? "");
      } else if (sortKey === "email") {
        result = (left.email ?? "").localeCompare(right.email ?? "");
      } else if (sortKey === "role") {
        result = left.role.localeCompare(right.role);
      } else if (sortKey === "approved") {
        result = Number(left.is_approved) - Number(right.is_approved);
      } else if (sortKey === "regions") {
        result =
          (regionsByUserId[left.id]?.length ?? 0) -
          (regionsByUserId[right.id]?.length ?? 0);
      }

      if (result === 0) return a.index - b.index;
      return result * direction;
    });

    return withIndex.map((entry) => entry.row);
  }, [filtered, regionsByUserId, sortDir, sortKey]);

  const updateSort = (nextKey: SortKey) => {
    const next = new URLSearchParams(searchParams);
    const defaultDir: SortDir = nextKey === "approved" ? "desc" : "asc";
    if (sortKey !== nextKey) {
      next.set("sort", nextKey);
      next.set("dir", defaultDir);
    } else if (sortDir === "asc") {
      next.set("sort", nextKey);
      next.set("dir", "desc");
    } else {
      next.delete("sort");
      next.delete("dir");
    }

    setSearchParams(next, { replace: true });
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

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

  const setApproval = async (userId: string, approved: boolean) => {
    setSavingId(userId);
    setError(null);

    const { error } = await supabase.rpc("admin_set_user_approval", {
      target_user_id: userId,
      approved,
    });

    if (error) {
      setError(error.message);
      setSavingId(null);
      return;
    }

    await load();
    setSavingId(null);
  };

  const setUserRegions = async (userId: string, regionCodes: string[]) => {
    setSavingId(userId);
    setError(null);

    const { error } = await supabase.rpc("admin_set_user_regions", {
      target_user_id: userId,
      region_codes: regionCodes,
    });

    if (error) {
      setError(error.message);
      setSavingId(null);
      return;
    }

    await load();
    setSavingId(null);
  };

  const toggleRegion = (
    userId: string,
    regionCode: string,
    checked: boolean,
  ) => {
    const current = new Set(regionsByUserId[userId] ?? []);
    if (checked) current.add(regionCode);
    else current.delete(regionCode);
    void setUserRegions(userId, Array.from(current));
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Assign roles for team members.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          className="w-full max-w-md rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          placeholder="Search users…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button
          variant="secondary"
          onClick={() => void load()}
          disabled={loading || savingId !== null}
        >
          Refresh
        </Button>
        <div className="text-xs text-muted-foreground">
          {sorted.length} shown
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card/80">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/35 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => updateSort("name")}
                  >
                    Name{sortIndicator("name")}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => updateSort("email")}
                  >
                    Email{sortIndicator("email")}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => updateSort("role")}
                  >
                    Role{sortIndicator("role")}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => updateSort("approved")}
                  >
                    Approved{sortIndicator("approved")}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => updateSort("regions")}
                  >
                    Regions{sortIndicator("regions")}
                  </button>
                </th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border/80 hover:bg-muted/20"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      {r.avatar_url ? (
                        <img
                          src={r.avatar_url}
                          alt={r.full_name ?? r.email ?? "User avatar"}
                          className="h-8 w-8 rounded-full border border-border object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
                          {initials(r)}
                        </div>
                      )}
                      <div className="font-medium">{r.full_name ?? "—"}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    {r.email ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-56 rounded-md border border-input bg-card px-2 py-1 text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
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
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.is_approved
                          ? "rounded border border-border bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                          : "rounded border border-border bg-muted px-2 py-1 text-xs text-muted-foreground"
                      }
                    >
                      {r.is_approved ? "Approved" : "Pending"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {regions.length === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        No regions configured.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-1">
                        {regions.map((region) => {
                          const checked = (
                            regionsByUserId[r.id] ?? []
                          ).includes(region.code);
                          return (
                            <label
                              key={`${r.id}:${region.code}`}
                              className="flex items-center gap-2 text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={savingId === r.id}
                                onChange={(e) =>
                                  toggleRegion(
                                    r.id,
                                    region.code,
                                    e.target.checked,
                                  )
                                }
                              />
                              <span>{region.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="secondary"
                      onClick={() => void setApproval(r.id, !r.is_approved)}
                      disabled={savingId === r.id}
                    >
                      {r.is_approved ? "Revoke" : "Approve"}
                    </Button>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-sm text-muted-foreground"
                    colSpan={6}
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
