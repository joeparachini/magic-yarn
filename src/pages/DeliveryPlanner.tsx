import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import type { Role } from "../auth/types";
import { Button } from "../components/ui/button";
import { SearchableDropdownFilter } from "../components/ui/searchable-dropdown-filter";
import { supabase } from "../lib/supabaseClient";

type PlannerRecipient = {
  id: string;
  name: string;
  shipment_frequency_months: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  assigned_user_id: string | null;
  user_profiles?: { full_name: string | null } | null;
};

type PlannerDelivery = {
  id: string;
  recipient_id: string;
  requested_date: string | null;
  target_delivery_date: string | null;
  shipped_date: string | null;
  completed_date: string | null;
};

type DueRow = {
  key: string;
  recipient_id: string;
  recipient_name: string;
  chapter_leader: string;
  frequency_months: number;
  last_delivery_date: string | null;
  is_first_delivery: boolean;
  due_month_key: string;
  due_month_label: string;
  create_target_date: string;
  create_requested_date: string;
  create_address: string;
  create_coordinator_id: string | null;
};

type SortKey =
  | "recipient"
  | "chapter_leader"
  | "frequency"
  | "last_delivery"
  | "due_month"
  | "target_date";

type SortDir = "asc" | "desc";

const SORT_KEYS: SortKey[] = [
  "recipient",
  "chapter_leader",
  "frequency",
  "last_delivery",
  "due_month",
  "target_date",
];

function toSortKey(value: string | null): SortKey | null {
  if (!value) return null;
  if (SORT_KEYS.includes(value as SortKey)) return value as SortKey;
  return null;
}

function toSortDir(value: string | null): SortDir {
  return value === "desc" ? "desc" : "asc";
}

const HORIZON_OPTIONS = [1, 3, 6, 12] as const;

function canEditDeliveries(role: Role | null) {
  return (
    role === "admin" ||
    role === "delivery_coordinator" ||
    role === "contacts_manager"
  );
}

function formatAddress(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}) {
  const line1 = (parts.address ?? "").trim();
  const line2 = [parts.city, parts.state, parts.zip]
    .filter(Boolean)
    .join(", ")
    .replace(", ,", ",")
    .trim();
  return [line1, line2].filter(Boolean).join(" | ").trim();
}

function toMonthKey(value: string | null): string | null {
  if (!value) return null;
  return value.length >= 7 ? value.slice(0, 7) : null;
}

function toDateOrNull(value: string | null): Date | null {
  if (!value) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const monthIndex = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    const parsedLocal = new Date(year, monthIndex, day);
    if (Number.isNaN(parsedLocal.getTime())) return null;
    return parsedLocal;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, months: number) {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
}

function endOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0);
}

function addMonthsKeepingDay(value: Date, months: number, dayOfMonth: number) {
  const shiftedMonthStart = new Date(
    value.getFullYear(),
    value.getMonth() + months,
    1,
  );
  const monthEndDay = new Date(
    shiftedMonthStart.getFullYear(),
    shiftedMonthStart.getMonth() + 1,
    0,
  ).getDate();

  return new Date(
    shiftedMonthStart.getFullYear(),
    shiftedMonthStart.getMonth(),
    Math.min(dayOfMonth, monthEndDay),
  );
}

function monthLabel(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function deliveryAnchorDate(row: PlannerDelivery): Date | null {
  return (
    toDateOrNull(row.target_delivery_date) ??
    toDateOrNull(row.completed_date) ??
    toDateOrNull(row.shipped_date) ??
    toDateOrNull(row.requested_date)
  );
}

export function DeliveryPlanner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const canEdit = canEditDeliveries(role);

  const [horizonMonths, setHorizonMonths] = useState<number>(6);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipients, setRecipients] = useState<PlannerRecipient[]>([]);
  const [deliveries, setDeliveries] = useState<PlannerDelivery[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const sortKey = toSortKey(searchParams.get("sort"));
  const sortDir = toSortDir(searchParams.get("dir"));

  const load = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const recipientsRes = await supabase
      .from("recipients")
      .select(
        "id, name, shipment_frequency_months, address, city, state, zip, assigned_user_id, user_profiles(full_name)",
      )
      .not("shipment_frequency_months", "is", null)
      .gt("shipment_frequency_months", 0)
      .order("name", { ascending: true });

    if (recipientsRes.error) {
      setError(recipientsRes.error.message);
      setRecipients([]);
      setDeliveries([]);
      setSelectedKeys(new Set());
      setLoading(false);
      return;
    }

    const normalizedRecipients = (recipientsRes.data ?? []).map((row: any) => {
      const chapterLeader = Array.isArray(row.user_profiles)
        ? row.user_profiles[0]
        : row.user_profiles;

      return {
        ...row,
        user_profiles: chapterLeader
          ? {
              full_name: (chapterLeader.full_name as string | null) ?? null,
            }
          : null,
      };
    }) as PlannerRecipient[];

    if (normalizedRecipients.length === 0) {
      setRecipients([]);
      setDeliveries([]);
      setSelectedKeys(new Set());
      setLoading(false);
      return;
    }

    const recipientIds = normalizedRecipients.map((r) => r.id);

    const deliveriesRes = await supabase
      .from("deliveries")
      .select(
        "id, recipient_id, requested_date, target_delivery_date, shipped_date, completed_date",
      )
      .in("recipient_id", recipientIds);

    if (deliveriesRes.error) {
      setError(deliveriesRes.error.message);
      setRecipients(normalizedRecipients);
      setDeliveries([]);
      setSelectedKeys(new Set());
      setLoading(false);
      return;
    }

    setRecipients(normalizedRecipients);
    setDeliveries((deliveriesRes.data ?? []) as PlannerDelivery[]);
    setSelectedKeys(new Set());
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const dueRows = useMemo(() => {
    const byRecipient = new Map<string, PlannerDelivery[]>();

    for (const delivery of deliveries) {
      const list = byRecipient.get(delivery.recipient_id);
      if (list) {
        list.push(delivery);
      } else {
        byRecipient.set(delivery.recipient_id, [delivery]);
      }
    }

    const start = startOfMonth(new Date());
    const end = endOfMonth(addMonths(start, horizonMonths - 1));
    const today = new Date();
    const rows: DueRow[] = [];

    for (const recipient of recipients) {
      const frequency = Number(recipient.shipment_frequency_months ?? 0);
      if (!Number.isFinite(frequency) || frequency <= 0) continue;

      const history = byRecipient.get(recipient.id) ?? [];
      let anchor: Date | null = null;

      for (const row of history) {
        const candidate = deliveryAnchorDate(row);
        if (!candidate) continue;
        if (!anchor || candidate.getTime() > anchor.getTime()) {
          anchor = candidate;
        }
      }

      const hasHistory = Boolean(anchor);
      if (!anchor) {
        anchor = today;
      }

      const existingMonthKeys = new Set<string>();
      for (const row of history) {
        const existing = toMonthKey(row.target_delivery_date);
        if (existing) existingMonthKeys.add(existing);
      }

      const anchorDayOfMonth = anchor.getDate();
      let isFirstDueForRecipient = true;
      let next = hasHistory
        ? addMonthsKeepingDay(anchor, frequency, anchorDayOfMonth)
        : new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
      while (next.getTime() <= end.getTime()) {
        if (next.getTime() >= start.getTime()) {
          const dueMonthKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
          if (!existingMonthKeys.has(dueMonthKey)) {
            rows.push({
              key: `${recipient.id}:${dueMonthKey}`,
              recipient_id: recipient.id,
              recipient_name: recipient.name,
              chapter_leader:
                recipient.user_profiles?.full_name?.trim() || "Unassigned",
              frequency_months: frequency,
              last_delivery_date: hasHistory ? toIsoDate(anchor) : null,
              is_first_delivery: !hasHistory && isFirstDueForRecipient,
              due_month_key: dueMonthKey,
              due_month_label: monthLabel(dueMonthKey),
              create_target_date: toIsoDate(next),
              create_requested_date: toIsoDate(today),
              create_address: formatAddress(recipient),
              create_coordinator_id: recipient.assigned_user_id,
            });

            isFirstDueForRecipient = false;
          }
        }

        next = addMonthsKeepingDay(next, frequency, anchorDayOfMonth);
      }
    }

    rows.sort((a, b) => {
      const byMonth = a.due_month_key.localeCompare(b.due_month_key);
      if (byMonth !== 0) return byMonth;
      return a.recipient_name.localeCompare(b.recipient_name);
    });

    return rows;
  }, [deliveries, horizonMonths, recipients]);

  useEffect(() => {
    setSelectedKeys((prev) => {
      if (prev.size === 0) return prev;
      const allowed = new Set(dueRows.map((row) => row.key));
      const next = new Set<string>();
      for (const key of prev) {
        if (allowed.has(key)) next.add(key);
      }
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [dueRows]);

  const filteredDueRows = useMemo(() => {
    if (!recipientQuery) return dueRows;
    return dueRows.filter((row) => row.recipient_name === recipientQuery);
  }, [dueRows, recipientQuery]);

  const sortedDueRows = useMemo(() => {
    if (!sortKey) return filteredDueRows;

    const withIndex = filteredDueRows.map((row, index) => ({ row, index }));
    const direction = sortDir === "asc" ? 1 : -1;

    withIndex.sort((a, b) => {
      const left = a.row;
      const right = b.row;
      let result = 0;

      if (sortKey === "recipient") {
        result = left.recipient_name.localeCompare(right.recipient_name);
      } else if (sortKey === "chapter_leader") {
        result = left.chapter_leader.localeCompare(right.chapter_leader);
      } else if (sortKey === "frequency") {
        result = left.frequency_months - right.frequency_months;
      } else if (sortKey === "last_delivery") {
        result = (left.last_delivery_date ?? "").localeCompare(
          right.last_delivery_date ?? "",
        );
      } else if (sortKey === "due_month") {
        result = left.due_month_key.localeCompare(right.due_month_key);
      } else if (sortKey === "target_date") {
        result = left.create_target_date.localeCompare(
          right.create_target_date,
        );
      }

      if (result === 0) return a.index - b.index;
      return result * direction;
    });

    return withIndex.map((entry) => entry.row);
  }, [filteredDueRows, sortDir, sortKey]);

  const recipientFilterOptions = useMemo(() => {
    const names = new Set(dueRows.map((row) => row.recipient_name));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [dueRows]);

  const filteredDueKeys = useMemo(
    () => new Set(sortedDueRows.map((row) => row.key)),
    [sortedDueRows],
  );

  const selectedRows = useMemo(
    () => sortedDueRows.filter((row) => selectedKeys.has(row.key)),
    [sortedDueRows, selectedKeys],
  );

  const selectableRows = useMemo(
    () => sortedDueRows.filter((row) => Boolean(row.create_address)),
    [sortedDueRows],
  );

  const selectableKeySet = useMemo(
    () => new Set(selectableRows.map((row) => row.key)),
    [selectableRows],
  );

  const selectedCreatableCount = useMemo(
    () => selectedRows.filter((row) => Boolean(row.create_address)).length,
    [selectedRows],
  );

  const allSelectableSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) => selectedKeys.has(row.key));

  const updateSort = (nextKey: SortKey) => {
    const next = new URLSearchParams(searchParams);
    const defaultDir: SortDir = "asc";
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

  const toggleRow = (key: string) => {
    if (!filteredDueKeys.has(key)) return;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allSelectableSelected) {
        for (const row of selectableRows) {
          next.delete(row.key);
        }
      } else {
        for (const row of selectableRows) {
          next.add(row.key);
        }
      }
      return next;
    });
  };

  const createSelected = async () => {
    if (!canEdit) {
      setError("Not authorized to create deliveries.");
      return;
    }

    const toCreate = selectedRows.filter((row) =>
      selectableKeySet.has(row.key),
    );
    if (toCreate.length === 0) {
      setError("Select at least one row with a recipient address.");
      return;
    }

    setCreating(true);
    setError(null);
    setSuccessMessage(null);

    const recipientIds = Array.from(
      new Set(toCreate.map((row) => row.recipient_id)),
    );

    const existingRes = await supabase
      .from("deliveries")
      .select("recipient_id, target_delivery_date")
      .in("recipient_id", recipientIds)
      .not("target_delivery_date", "is", null);

    if (existingRes.error) {
      setError(existingRes.error.message);
      setCreating(false);
      return;
    }

    const existingRecipientMonthSet = new Set<string>();
    for (const row of existingRes.data ?? []) {
      const monthKey = toMonthKey((row as any).target_delivery_date ?? null);
      const recipientId = (row as any).recipient_id as string | undefined;
      if (!recipientId || !monthKey) continue;
      existingRecipientMonthSet.add(`${recipientId}:${monthKey}`);
    }

    const dedupedToCreate = toCreate.filter(
      (row) =>
        !existingRecipientMonthSet.has(
          `${row.recipient_id}:${row.due_month_key}`,
        ),
    );

    if (dedupedToCreate.length === 0) {
      setError("No new deliveries to create. Selected rows already exist.");
      setCreating(false);
      return;
    }

    const payload = dedupedToCreate.map((row) => ({
      recipient_id: row.recipient_id,
      recipient_contact_slot: null,
      requested_date: row.create_requested_date,
      target_delivery_date: row.create_target_date,
      shipped_date: null,
      tracking_number: null,
      completed_date: null,
      status_id: 1,
      coordinator_id: row.create_coordinator_id,
      wigs: 0,
      beanies: 0,
      address: row.create_address,
      notes: null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("deliveries").insert(payload);

    if (error) {
      setError(error.message);
      setCreating(false);
      return;
    }

    const skippedCount = toCreate.length - dedupedToCreate.length;
    setSuccessMessage(
      `Created ${dedupedToCreate.length} delivery${dedupedToCreate.length === 1 ? "" : "ies"}${skippedCount > 0 ? ` (${skippedCount} skipped as already existing)` : ""}.`,
    );

    await load();
    setCreating(false);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Delivery planner</h1>
          <p className="text-sm text-muted-foreground">
            Find recipients due in the next months and create deliveries in
            batch.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => void load()}
            disabled={loading || creating}
          >
            Refresh
          </Button>
          <Button
            onClick={() => void createSelected()}
            disabled={!canEdit || creating || selectedCreatableCount === 0}
          >
            {creating
              ? "Creating…"
              : `Create selected (${selectedCreatableCount})`}
          </Button>
        </div>
      </div>

      {!canEdit ? (
        <div className="rounded-md border border-border bg-muted/35 p-3 text-sm text-foreground">
          You have view-only access to deliveries.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-md border border-chart-2/40 bg-chart-2/10 p-3 text-sm text-chart-2">
          {successMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <SearchableDropdownFilter
          label="Recipient"
          value={recipientQuery}
          options={recipientFilterOptions}
          onChange={setRecipientQuery}
          disabled={loading || creating}
          allLabel="All recipients"
          searchPlaceholder="Type to filter recipients…"
        />

        <div className="flex w-full max-w-xs flex-col gap-1">
          <div className="text-xs text-muted-foreground">Plan horizon</div>
          <select
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            value={String(horizonMonths)}
            onChange={(e) => setHorizonMonths(Number(e.target.value))}
            disabled={loading || creating}
          >
            {HORIZON_OPTIONS.map((months) => (
              <option key={months} value={months}>
                {months} month{months === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </div>

        <label className="inline-flex items-center gap-2 text-sm md:pb-2">
          <input
            type="checkbox"
            className="size-4 rounded border border-input"
            checked={allSelectableSelected}
            onChange={toggleAllVisible}
            disabled={loading || creating || selectableRows.length === 0}
          />
          <span>Select all visible due rows</span>
        </label>

        <div className="text-xs text-muted-foreground md:pb-2">
          {sortedDueRows.length} shown • {selectedRows.length} selected
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card/80">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/35 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Select</th>
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
                    onClick={() => updateSort("chapter_leader")}
                  >
                    Chapter leader{sortIndicator("chapter_leader")}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => updateSort("frequency")}
                  >
                    Frequency{sortIndicator("frequency")}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => updateSort("last_delivery")}
                  >
                    Last delivery{sortIndicator("last_delivery")}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => updateSort("due_month")}
                  >
                    Due month{sortIndicator("due_month")}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => updateSort("target_date")}
                  >
                    Target date{sortIndicator("target_date")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedDueRows.map((row) => {
                const disabled = !row.create_address || !canEdit;

                return (
                  <tr
                    key={row.key}
                    className="border-t border-border/80 hover:bg-muted/20"
                  >
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        className="size-4 rounded border border-input"
                        checked={selectedKeys.has(row.key)}
                        onChange={() => toggleRow(row.key)}
                        disabled={disabled || creating}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium">{row.recipient_name}</div>
                      {row.is_first_delivery ? (
                        <div className="mt-1">
                          <span className="inline-flex rounded-md border border-chart-2/30 bg-chart-2/15 px-2 py-0.5 text-[11px] font-medium text-chart-2">
                            First delivery
                          </span>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {row.chapter_leader}
                    </td>
                    <td className="px-3 py-2 align-top">
                      Every {row.frequency_months} month
                      {row.frequency_months === 1 ? "" : "s"}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {row.last_delivery_date
                        ? new Date(
                            `${row.last_delivery_date}T00:00:00`,
                          ).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {row.due_month_label}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {new Date(
                        `${row.create_target_date}T00:00:00`,
                      ).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
              {sortedDueRows.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-sm text-muted-foreground"
                    colSpan={7}
                  >
                    No due deliveries found for the selected horizon.
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
