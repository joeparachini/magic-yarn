import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type DeliveryStatus = "pending" | "scheduled" | "completed" | "cancelled";

type RecentDeliveryRow = {
  id: string;
  status: DeliveryStatus;
  delivery_date: string | null;
  updated_at: string;
  organizations?: { name: string } | null;
  contacts?: { first_name: string; last_name: string } | null;
};

type Permission =
  | "organizations.read"
  | "contacts.read"
  | "deliveries.read"
  | "delivery_items.read";

function MetricCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-600">
        {title}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint ? (
        <div className="mt-1 text-xs text-neutral-600">{hint}</div>
      ) : null}
    </div>
  );
}

async function hasPermission(permission: Permission): Promise<boolean> {
  const { data, error } = await supabase.rpc("current_user_has_permission", {
    p: permission,
  });
  if (error) return false;
  return Boolean(data);
}

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [canReadOrgs, setCanReadOrgs] = useState(false);
  const [canReadContacts, setCanReadContacts] = useState(false);
  const [canReadDeliveries, setCanReadDeliveries] = useState(false);
  const [canReadItems, setCanReadItems] = useState(false);

  const [orgCount, setOrgCount] = useState<number | null>(null);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [deliveryCount, setDeliveryCount] = useState<number | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<
    DeliveryStatus,
    number
  > | null>(null);
  const [upcomingCount, setUpcomingCount] = useState<number | null>(null);
  const [recentDeliveries, setRecentDeliveries] = useState<RecentDeliveryRow[]>(
    [],
  );

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const [orgsOk, contactsOk, deliveriesOk, itemsOk] = await Promise.all([
        hasPermission("organizations.read"),
        hasPermission("contacts.read"),
        hasPermission("deliveries.read"),
        hasPermission("delivery_items.read"),
      ]);

      setCanReadOrgs(orgsOk);
      setCanReadContacts(contactsOk);
      setCanReadDeliveries(deliveriesOk);
      setCanReadItems(itemsOk);

      const tasks: Array<Promise<void>> = [];

      if (orgsOk) {
        tasks.push(
          (async () => {
            const { count, error } = await supabase
              .from("organizations")
              .select("id", { count: "exact", head: true });
            if (error) throw error;
            setOrgCount(count ?? 0);
          })(),
        );
      } else {
        setOrgCount(null);
      }

      if (contactsOk) {
        tasks.push(
          (async () => {
            const { count, error } = await supabase
              .from("contacts")
              .select("id", { count: "exact", head: true });
            if (error) throw error;
            setContactCount(count ?? 0);
          })(),
        );
      } else {
        setContactCount(null);
      }

      if (deliveriesOk) {
        tasks.push(
          (async () => {
            const { count, error } = await supabase
              .from("deliveries")
              .select("id", { count: "exact", head: true });
            if (error) throw error;
            setDeliveryCount(count ?? 0);
          })(),
        );

        tasks.push(
          (async () => {
            const statuses: DeliveryStatus[] = [
              "pending",
              "scheduled",
              "completed",
              "cancelled",
            ];
            const results = await Promise.all(
              statuses.map(async (s) => {
                const { count, error } = await supabase
                  .from("deliveries")
                  .select("id", { count: "exact", head: true })
                  .eq("status", s);
                if (error) throw error;
                return [s, count ?? 0] as const;
              }),
            );
            setStatusCounts(
              Object.fromEntries(results) as Record<DeliveryStatus, number>,
            );
          })(),
        );

        tasks.push(
          (async () => {
            const now = new Date();
            const in14 = new Date(now);
            in14.setDate(in14.getDate() + 14);

            const { count, error } = await supabase
              .from("deliveries")
              .select("id", { count: "exact", head: true })
              .in("status", ["pending", "scheduled"])
              .gte("delivery_date", now.toISOString().slice(0, 10))
              .lte("delivery_date", in14.toISOString().slice(0, 10));

            if (error) throw error;
            setUpcomingCount(count ?? 0);
          })(),
        );

        tasks.push(
          (async () => {
            const { data, error } = await supabase
              .from("deliveries")
              .select(
                "id, status, delivery_date, updated_at, organizations(name), contacts(first_name,last_name)",
              )
              .order("updated_at", { ascending: false })
              .limit(8);

            if (error) throw error;

            const normalized = (data ?? []).map((row: any) => {
              const org = Array.isArray(row.organizations)
                ? row.organizations[0]
                : row.organizations;
              const contact = Array.isArray(row.contacts)
                ? row.contacts[0]
                : row.contacts;
              return {
                ...row,
                organizations: org ? { name: org.name as string } : null,
                contacts: contact
                  ? {
                      first_name: contact.first_name as string,
                      last_name: contact.last_name as string,
                    }
                  : null,
              };
            });

            setRecentDeliveries(normalized as unknown as RecentDeliveryRow[]);
          })(),
        );
      } else {
        setDeliveryCount(null);
        setStatusCounts(null);
        setUpcomingCount(null);
        setRecentDeliveries([]);
      }

      if (!itemsOk) {
        setCanReadItems(false);
      }

      await Promise.all(tasks);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const pending = statusCounts?.pending ?? null;
  const scheduled = statusCounts?.scheduled ?? null;

  const deliveryHint = useMemo(() => {
    if (!statusCounts) return undefined;
    return `Pending: ${statusCounts.pending} • Scheduled: ${statusCounts.scheduled} • Completed: ${statusCounts.completed}`;
  }, [statusCounts]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-neutral-600">
            Quick overview and recent updates.
          </p>
        </div>
        <button
          className="rounded-md border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Organizations"
          value={
            canReadOrgs ? (orgCount ?? (loading ? "…" : "0")).toString() : "—"
          }
          hint={canReadOrgs ? "Total organizations" : "No access"}
        />
        <MetricCard
          title="Contacts"
          value={
            canReadContacts
              ? (contactCount ?? (loading ? "…" : "0")).toString()
              : "—"
          }
          hint={canReadContacts ? "Total contacts" : "No access"}
        />
        <MetricCard
          title="Deliveries"
          value={
            canReadDeliveries
              ? (deliveryCount ?? (loading ? "…" : "0")).toString()
              : "—"
          }
          hint={canReadDeliveries ? deliveryHint : "No access"}
        />
        <MetricCard
          title="Next 14 Days"
          value={
            canReadDeliveries
              ? (upcomingCount ?? (loading ? "…" : "0")).toString()
              : "—"
          }
          hint={canReadDeliveries ? "Pending + scheduled" : "No access"}
        />
      </div>

      {canReadDeliveries ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">At a glance</div>
                <div className="text-xs text-neutral-600">By status</div>
              </div>
              <Link className="text-sm underline" to="/deliveries">
                View all
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard
                title="Pending"
                value={pending === null ? "—" : pending.toString()}
              />
              <MetricCard
                title="Scheduled"
                value={scheduled === null ? "—" : scheduled.toString()}
              />
              <MetricCard
                title="Completed"
                value={statusCounts ? statusCounts.completed.toString() : "—"}
              />
              <MetricCard
                title="Cancelled"
                value={statusCounts ? statusCounts.cancelled.toString() : "—"}
              />
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Recent deliveries</div>
                <div className="text-xs text-neutral-600">Last updated</div>
              </div>
              <Link className="text-sm underline" to="/deliveries">
                View all
              </Link>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-neutral-600">
                  <tr className="border-b border-neutral-200">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Organization</th>
                    <th className="py-2 pr-3">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDeliveries.map((d) => (
                    <tr key={d.id} className="border-b border-neutral-100">
                      <td className="py-2 pr-3">
                        <Link className="underline" to={`/deliveries/${d.id}`}>
                          {d.delivery_date
                            ? new Date(d.delivery_date).toLocaleDateString()
                            : "—"}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{d.status}</td>
                      <td className="py-2 pr-3">
                        {d.organizations?.name ?? "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {d.contacts
                          ? `${d.contacts.last_name}, ${d.contacts.first_name}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  {recentDeliveries.length === 0 ? (
                    <tr>
                      <td
                        className="py-6 text-center text-sm text-neutral-600"
                        colSpan={4}
                      >
                        No deliveries yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-600">
          You don’t have permission to view delivery metrics.
        </div>
      )}

      {!canReadItems ? (
        <div className="text-xs text-neutral-500">
          Delivery item metrics are hidden (no permission).
        </div>
      ) : null}
    </div>
  );
}
