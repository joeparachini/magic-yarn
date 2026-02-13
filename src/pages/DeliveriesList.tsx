import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import type { Role } from "../auth/types";
import { Button } from "../components/ui/button";
import { supabase } from "../lib/supabaseClient";

type DeliveryStatus = "pending" | "scheduled" | "completed" | "cancelled";

type DeliveryRow = {
  id: string;
  organization_id: string;
  contact_id: string;
  delivery_date: string | null;
  status: DeliveryStatus;
  coordinator_id: string | null;
  updated_at: string;
  organizations?: { name: string } | null;
  contacts?: { first_name: string; last_name: string } | null;
  user_profiles?: { full_name: string | null } | null;
};

const statusOptions: Array<{ label: string; value: DeliveryStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

function canEditDeliveries(role: Role | null) {
  return (
    role === "admin" ||
    role === "delivery_coordinator" ||
    role === "contacts_manager"
  );
}

export function DeliveriesList() {
  const { role } = useAuth();
  const canEdit = canEditDeliveries(role);

  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DeliveryStatus | "all">("all");

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("deliveries")
      .select(
        "id, organization_id, contact_id, delivery_date, status, coordinator_id, updated_at, organizations(name), contacts(first_name,last_name), user_profiles(full_name)",
      )
      .order("delivery_date", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });

    if (error) {
      setError(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const normalized = (data ?? []).map((row: any) => {
      const org = Array.isArray(row.organizations)
        ? row.organizations[0]
        : row.organizations;
      const contact = Array.isArray(row.contacts)
        ? row.contacts[0]
        : row.contacts;
      const coordinator = Array.isArray(row.user_profiles)
        ? row.user_profiles[0]
        : row.user_profiles;
      return {
        ...row,
        organizations: org ? { name: org.name as string } : null,
        contacts: contact
          ? {
              first_name: contact.first_name as string,
              last_name: contact.last_name as string,
            }
          : null,
        user_profiles: coordinator
          ? { full_name: (coordinator.full_name as string | null) ?? null }
          : null,
      };
    });

    setRows(normalized as unknown as DeliveryRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      const org = r.organizations?.name ?? "";
      const contactName = r.contacts
        ? `${r.contacts.first_name} ${r.contacts.last_name}`
        : "";
      const haystack = `${org} ${contactName} ${r.status}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query, status]);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Deliveries</h1>
          <p className="text-sm text-muted-foreground">
            Schedule and track deliveries.
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
            <Link to="/deliveries/new">
              <Button>New delivery</Button>
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <input
          className="w-full max-w-md rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          placeholder="Search deliveries…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="w-full max-w-xs rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Organization</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Coordinator</th>
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
                      to={`/deliveries/${r.id}`}
                    >
                      {r.delivery_date
                        ? new Date(r.delivery_date).toLocaleDateString()
                        : "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{r.organizations?.name ?? "—"}</td>
                  <td className="px-3 py-2">
                    {r.contacts
                      ? `${r.contacts.last_name}, ${r.contacts.first_name}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.user_profiles?.full_name ?? "—"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-sm text-muted-foreground"
                    colSpan={5}
                  >
                    No deliveries found.
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
