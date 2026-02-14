import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button } from "../components/ui/button";
import { supabase } from "../lib/supabaseClient";

type OrganizationType = "hospital" | "clinic" | "cancer_center" | "other";

type OrganizationRow = {
  id: string;
  name: string;
  type: OrganizationType;
  region_code: string | null;
  city: string | null;
  state: string | null;
  updated_at: string;
};

type RegionOption = {
  code: string;
  name: string;
  sort_order: number;
};

export function OrganizationsList() {
  const { role } = useAuth();
  const canEdit = role === "admin" || role === "contacts_manager";
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<OrganizationRow[]>([]);
  const [regionsByCode, setRegionsByCode] = useState<Record<string, string>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const query = searchParams.get("q") ?? "";
  const listSearch = searchParams.toString();

  const updateQueryParam = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) {
      next.set("q", value);
    } else {
      next.delete("q");
    }
    setSearchParams(next, { replace: true });
  };

  const load = async () => {
    setLoading(true);
    setError(null);

    const [organizationsRes, regionsRes] = await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, type, region_code, city, state, updated_at")
        .order("name", { ascending: true }),
      supabase.rpc("list_regions"),
    ]);

    if (organizationsRes.error || regionsRes.error) {
      setError(
        organizationsRes.error?.message ??
          regionsRes.error?.message ??
          "Failed to load organizations.",
      );
      setRows([]);
      setRegionsByCode({});
      setLoading(false);
      return;
    }

    const regionMap: Record<string, string> = {};
    for (const region of (regionsRes.data ?? []) as RegionOption[]) {
      regionMap[region.code] = region.name;
    }

    setRows((organizationsRes.data ?? []) as OrganizationRow[]);
    setRegionsByCode(regionMap);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const regionName = r.region_code
        ? (regionsByCode[r.region_code] ?? "")
        : "";
      const haystack =
        `${r.name} ${r.city ?? ""} ${r.state ?? ""} ${regionName}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query, regionsByCode]);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Hospitals, clinics, and other delivery destinations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </Button>
          {canEdit ? (
            <Link
              to={
                listSearch
                  ? `/organizations/new?${listSearch}`
                  : "/organizations/new"
              }
            >
              <Button>New organization</Button>
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          className="w-full max-w-md rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          placeholder="Search organizations…"
          value={query}
          onChange={(e) => updateQueryParam(e.target.value)}
        />
        <div className="text-xs text-muted-foreground">
          {filtered.length} shown
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card/80">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/35 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Region</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border/80 hover:bg-muted/20"
                >
                  <td className="px-3 py-2">
                    <Link
                      className="font-medium text-foreground underline decoration-muted-foreground/50 underline-offset-2"
                      to={
                        listSearch
                          ? `/organizations/${r.id}?${listSearch}`
                          : `/organizations/${r.id}`
                      }
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.type}</td>
                  <td className="px-3 py-2">
                    {r.region_code
                      ? (regionsByCode[r.region_code] ?? r.region_code)
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {[r.city, r.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(r.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-sm text-muted-foreground"
                    colSpan={5}
                  >
                    No organizations found.
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
