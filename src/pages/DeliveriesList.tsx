import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import type { Role } from "../auth/types";
import { Button } from "../components/ui/button";
import {
  DELIVERY_STATUS_OPTIONS,
  formatDeliveryStatusById,
  toDeliveryStatusId,
  type DeliveryStatusId,
} from "../lib/deliveryStatus";
import { supabase } from "../lib/supabaseClient";

type DeliveryRow = {
  id: string;
  recipient_id: string;
  requested_date: string | null;
  target_delivery_date: string | null;
  shipped_date: string | null;
  completed_date: string | null;
  status_id: DeliveryStatusId | null;
  coordinator_id: string | null;
  wigs: number | null;
  beanies: number | null;
  notes: string | null;
  updated_at: string;
  recipients?: {
    name: string;
    state: string | null;
    assigned_user_id: string | null;
    user_profiles?: { full_name: string | null } | null;
  } | null;
  user_profiles?: { full_name: string | null } | null;
};

type SortKey =
  | "recipient"
  | "state"
  | "chapterLeader"
  | "requested_date"
  | "target_delivery_date"
  | "status"
  | "shipped_date"
  | "items";

type SortDir = "asc" | "desc";

const SORT_KEYS: SortKey[] = [
  "recipient",
  "state",
  "chapterLeader",
  "requested_date",
  "target_delivery_date",
  "status",
  "shipped_date",
  "items",
];

function toSortKey(value: string | null): SortKey {
  if (!value) return "target_delivery_date";
  if (SORT_KEYS.includes(value as SortKey)) return value as SortKey;
  return "target_delivery_date";
}

function toSortDir(value: string | null): SortDir {
  return value === "asc" ? "asc" : "desc";
}

function monthKeyFromDate(value: string | null): string | null {
  if (!value) return null;
  return value.length >= 7 ? value.slice(0, 7) : null;
}

const statusOptions: Array<{ label: string; value: DeliveryStatusId | "all" }> =
  [{ label: "All", value: "all" }, ...DELIVERY_STATUS_OPTIONS];

function canEditDeliveries(role: Role | null) {
  return (
    role === "admin" ||
    role === "delivery_coordinator" ||
    role === "contacts_manager"
  );
}

function statusClassName(statusId: DeliveryStatusId | null) {
  if (statusId === 4) return "bg-destructive/10 text-destructive";
  if (statusId === 1) return "bg-chart-4/15 text-chart-4";
  if (statusId === 2) return "bg-chart-1/15 text-chart-1";
  if (statusId === 3) return "bg-chart-2/15 text-chart-2";
  return "bg-muted text-muted-foreground";
}

function toDateStamp(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const stamp = Date.parse(value);
  return Number.isNaN(stamp) ? Number.POSITIVE_INFINITY : stamp;
}

function compareFirstDeliveryRows(
  left: DeliveryRow,
  right: DeliveryRow,
): number {
  const targetDiff =
    toDateStamp(left.target_delivery_date) -
    toDateStamp(right.target_delivery_date);
  if (targetDiff !== 0) return targetDiff;

  const requestedDiff =
    toDateStamp(left.requested_date) - toDateStamp(right.requested_date);
  if (requestedDiff !== 0) return requestedDiff;

  return left.id.localeCompare(right.id);
}

export function DeliveriesList() {
  const { role } = useAuth();
  const canEdit = canEditDeliveries(role);
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const query = searchParams.get("q") ?? "";
  const statusParam = searchParams.get("status");
  const assignedParam = searchParams.get("assigned");
  const monthParam = searchParams.get("month") ?? "all";
  const sortKey = toSortKey(searchParams.get("sort"));
  const sortDir = toSortDir(searchParams.get("dir"));
  const status: DeliveryStatusId | "all" =
    toDeliveryStatusId(statusParam) ?? "all";
  const assigned = assignedParam ?? "all";
  const month = monthParam;
  const listSearch = searchParams.toString();

  const updateSearchParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("deliveries")
      .select(
        "id, recipient_id, requested_date, target_delivery_date, shipped_date, completed_date, status_id, coordinator_id, wigs, beanies, notes, updated_at, recipients(name,state,assigned_user_id,user_profiles(full_name)), user_profiles(full_name)",
      )
      .order("target_delivery_date", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });

    if (error) {
      setError(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const normalized = (data ?? []).map((row: any) => {
      const recipient = Array.isArray(row.recipients)
        ? row.recipients[0]
        : row.recipients;
      const chapterLeader = recipient
        ? Array.isArray(recipient.user_profiles)
          ? recipient.user_profiles[0]
          : recipient.user_profiles
        : null;
      const coordinator = Array.isArray(row.user_profiles)
        ? row.user_profiles[0]
        : row.user_profiles;
      return {
        ...row,
        recipients: recipient
          ? {
              name: recipient.name as string,
              state: (recipient.state as string | null) ?? null,
              assigned_user_id:
                (recipient.assigned_user_id as string | null) ?? null,
              user_profiles: chapterLeader
                ? {
                    full_name:
                      (chapterLeader.full_name as string | null) ?? null,
                  }
                : null,
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

  const assignedOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of rows) {
      if (!row.coordinator_id) continue;
      byId.set(
        row.coordinator_id,
        row.user_profiles?.full_name?.trim() || "Unnamed user",
      );
    }

    return Array.from(byId.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const monthOptions = useMemo(() => {
    const months = new Set<string>();

    for (const row of rows) {
      const monthKey = monthKeyFromDate(row.target_delivery_date);
      if (monthKey) months.add(monthKey);
    }

    return Array.from(months)
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({
        value,
        label: new Date(`${value}-01T00:00:00`).toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        }),
      }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status_id !== status) return false;
      if (
        month !== "all" &&
        monthKeyFromDate(r.target_delivery_date) !== month
      ) {
        return false;
      }
      if (assigned === "unassigned") {
        if (r.coordinator_id) return false;
      } else if (assigned !== "all" && r.coordinator_id !== assigned) {
        return false;
      }
      if (!q) return true;
      const recipient = r.recipients?.name ?? "";
      const recipientState = r.recipients?.state ?? "";
      const chapterLeader = r.recipients?.user_profiles?.full_name ?? "";
      const haystack =
        `${recipient} ${recipientState} ${chapterLeader} ${formatDeliveryStatusById(r.status_id)}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query, status, assigned, month]);

  const sorted = useMemo(() => {
    const direction = sortDir === "asc" ? 1 : -1;
    const withIndex = filtered.map((row, index) => ({ row, index }));

    const compareText = (a: string, b: string) => a.localeCompare(b);
    const compareNumber = (a: number, b: number) => a - b;

    withIndex.sort((a, b) => {
      const left = a.row;
      const right = b.row;
      let result = 0;

      if (sortKey === "recipient") {
        result = compareText(
          left.recipients?.name ?? "",
          right.recipients?.name ?? "",
        );
      } else if (sortKey === "state") {
        result = compareText(
          left.recipients?.state ?? "",
          right.recipients?.state ?? "",
        );
      } else if (sortKey === "chapterLeader") {
        result = compareText(
          left.recipients?.user_profiles?.full_name ?? "",
          right.recipients?.user_profiles?.full_name ?? "",
        );
      } else if (sortKey === "requested_date") {
        result = compareText(
          left.requested_date ?? "",
          right.requested_date ?? "",
        );
      } else if (sortKey === "target_delivery_date") {
        result = compareText(
          left.target_delivery_date ?? "",
          right.target_delivery_date ?? "",
        );
      } else if (sortKey === "status") {
        result = compareText(
          formatDeliveryStatusById(left.status_id),
          formatDeliveryStatusById(right.status_id),
        );
      } else if (sortKey === "shipped_date") {
        result = compareText(left.shipped_date ?? "", right.shipped_date ?? "");
      } else if (sortKey === "items") {
        result = compareNumber(
          Number(left.wigs ?? 0) + Number(left.beanies ?? 0),
          Number(right.wigs ?? 0) + Number(right.beanies ?? 0),
        );
      }

      if (result === 0) return a.index - b.index;
      return result * direction;
    });

    return withIndex.map((entry) => entry.row);
  }, [filtered, sortDir, sortKey]);

  const firstDeliveryIds = useMemo(() => {
    const firstByRecipient = new Map<string, DeliveryRow>();

    for (const row of rows) {
      if (!row.recipient_id) continue;
      const existing = firstByRecipient.get(row.recipient_id);
      if (!existing) {
        firstByRecipient.set(row.recipient_id, row);
        continue;
      }

      if (compareFirstDeliveryRows(row, existing) < 0) {
        firstByRecipient.set(row.recipient_id, row);
      }
    }

    return new Set(Array.from(firstByRecipient.values()).map((row) => row.id));
  }, [rows]);

  const updateSort = (nextKey: SortKey) => {
    const next = new URLSearchParams(searchParams);
    const defaultDir =
      nextKey === "requested_date" ||
      nextKey === "target_delivery_date" ||
      nextKey === "shipped_date"
        ? "desc"
        : "asc";
    const nextDir =
      sortKey === nextKey ? (sortDir === "asc" ? "desc" : "asc") : defaultDir;

    next.set("sort", nextKey);
    next.set("dir", nextDir);
    setSearchParams(next, { replace: true });
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

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
            <Link
              to={
                listSearch ? `/deliveries/new?${listSearch}` : "/deliveries/new"
              }
            >
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

      <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <div className="flex w-full max-w-md flex-col gap-1">
          <div className="text-xs text-muted-foreground">Search</div>
          <input
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            placeholder="Search deliveries…"
            value={query}
            onChange={(e) => updateSearchParam("q", e.target.value)}
          />
        </div>
        <div className="flex w-full max-w-xs flex-col gap-1">
          <div className="text-xs text-muted-foreground">Status</div>
          <select
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            value={status === "all" ? "all" : String(status)}
            onChange={(e) =>
              updateSearchParam(
                "status",
                e.target.value === "all" ? "" : e.target.value,
              )
            }
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-1">
          <div className="text-xs text-muted-foreground">Chapter Leader</div>
          <select
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            value={assigned}
            onChange={(e) =>
              updateSearchParam(
                "assigned",
                e.target.value === "all" ? "" : e.target.value,
              )
            }
          >
            <option value="all">All chapter leaders</option>
            <option value="unassigned">Unassigned</option>
            {assignedOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-1">
          <div className="text-xs text-muted-foreground">Target month</div>
          <select
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            value={month}
            onChange={(e) =>
              updateSearchParam(
                "month",
                e.target.value === "all" ? "" : e.target.value,
              )
            }
          >
            <option value="all">All months</option>
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-muted-foreground md:pb-2">
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
                    onClick={() => updateSort("recipient")}
                  >
                    Recipient{sortIndicator("recipient")}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => updateSort("state")}
                  >
                    Delivery state{sortIndicator("state")}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => updateSort("chapterLeader")}
                  >
                    Chapter leader{sortIndicator("chapterLeader")}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => updateSort("requested_date")}
                  >
                    Requested on{sortIndicator("requested_date")}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => updateSort("target_delivery_date")}
                  >
                    Target date{sortIndicator("target_delivery_date")}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => updateSort("status")}
                  >
                    Status{sortIndicator("status")}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => updateSort("shipped_date")}
                  >
                    Shipped date{sortIndicator("shipped_date")}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => updateSort("items")}
                  >
                    <div>Items{sortIndicator("items")}</div>
                  </button>
                  <div className="text-[10px] font-normal normal-case text-muted-foreground">
                    W | B | T
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-t border-border/80 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <Link
                        className="font-medium text-foreground underline decoration-muted-foreground/50 underline-offset-2"
                        to={
                          listSearch
                            ? `/deliveries/${r.id}?${listSearch}`
                            : `/deliveries/${r.id}`
                        }
                      >
                        {r.recipients?.name ?? "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{r.recipients?.state ?? "—"}</td>
                    <td className="px-3 py-2">
                      {r.recipients?.user_profiles?.full_name ?? "Unassigned"}
                    </td>
                    <td className="px-3 py-2">
                      {r.requested_date
                        ? new Date(r.requested_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.target_delivery_date
                        ? new Date(r.target_delivery_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${statusClassName(r.status_id)}`}
                      >
                        {formatDeliveryStatusById(r.status_id)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {r.shipped_date
                        ? new Date(r.shipped_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{Number(r.wigs ?? 0)}</span>
                      <span className="mx-2 text-muted-foreground">|</span>
                      <span className="font-medium">
                        {Number(r.beanies ?? 0)}
                      </span>
                      <span className="mx-2 text-muted-foreground">|</span>
                      <span className="font-medium">
                        {Number(r.wigs ?? 0) + Number(r.beanies ?? 0)}
                      </span>
                    </td>
                  </tr>
                  {firstDeliveryIds.has(r.id) || r.notes?.trim() ? (
                    <tr className="bg-muted/5">
                      <td
                        className="px-3 pb-2 pt-0 text-xs text-muted-foreground"
                        colSpan={8}
                      >
                        {firstDeliveryIds.has(r.id) ? (
                          <span className="mr-2 inline-flex rounded-md border border-chart-2/30 bg-chart-2/15 px-2 py-0.5 text-[11px] font-medium text-chart-2">
                            First delivery
                          </span>
                        ) : null}
                        {r.notes?.trim() ? (
                          <>
                            <span className="font-medium text-foreground">
                              Note:
                            </span>{" "}
                            {r.notes}
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
              {sorted.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-sm text-muted-foreground"
                    colSpan={8}
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
