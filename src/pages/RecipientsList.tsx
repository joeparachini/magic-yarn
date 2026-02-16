import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button } from "../components/ui/button";
import { supabase } from "../lib/supabaseClient";

type RecipientType =
  | "hospital"
  | "clinic"
  | "cancer_center"
  | "individual"
  | "other";

type RecipientRow = {
  id: string;
  name: string;
  type: RecipientType;
  shipment_frequency_months: number | null;
  city: string | null;
  state: string | null;
  updated_at: string;
};

type CorrespondenceSummaryRow = {
  recipient_id: string;
  correspondence_date: string;
  note: string;
  created_at: string;
};

type SortKey =
  | "name"
  | "type"
  | "frequency"
  | "location"
  | "latest_correspondence"
  | "updated";

type SortDir = "asc" | "desc";

const SORT_KEYS: SortKey[] = [
  "name",
  "type",
  "frequency",
  "location",
  "latest_correspondence",
  "updated",
];

function toSortKey(value: string | null): SortKey | null {
  if (!value) return null;
  if (SORT_KEYS.includes(value as SortKey)) return value as SortKey;
  return null;
}

function toSortDir(value: string | null): SortDir {
  return value === "desc" ? "desc" : "asc";
}

export function RecipientsList() {
  const { role } = useAuth();
  const canEdit = role === "admin" || role === "contacts_manager";
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<RecipientRow[]>([]);
  const [latestCorrespondenceByRecipient, setLatestCorrespondenceByRecipient] =
    useState<Record<string, CorrespondenceSummaryRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [correspondenceWarning, setCorrespondenceWarning] = useState<
    string | null
  >(null);
  const query = searchParams.get("q") ?? "";
  const sortKey = toSortKey(searchParams.get("sort"));
  const sortDir = toSortDir(searchParams.get("dir"));
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

    const recipientsRes = await supabase
      .from("recipients")
      .select(
        "id, name, type, shipment_frequency_months, city, state, updated_at",
      )
      .order("name", { ascending: true });

    if (recipientsRes.error) {
      setError(recipientsRes.error.message ?? "Failed to load recipients.");
      setRows([]);
      setLoading(false);
      return;
    }

    const loadedRows = (recipientsRes.data ?? []) as RecipientRow[];
    setRows(loadedRows);

    const correspondenceRes = await supabase
      .from("recipient_correspondence")
      .select("recipient_id, correspondence_date, note, created_at")
      .order("correspondence_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (correspondenceRes.error) {
      if ((correspondenceRes.error as { code?: string }).code !== "42P01") {
        setCorrespondenceWarning(
          correspondenceRes.error.message ??
            "Could not load correspondence summaries.",
        );
      }
      setLatestCorrespondenceByRecipient({});
      setLoading(false);
      return;
    }

    setCorrespondenceWarning(null);
    const latestByRecipient: Record<string, CorrespondenceSummaryRow> = {};
    for (const row of (correspondenceRes.data ??
      []) as CorrespondenceSummaryRow[]) {
      if (!latestByRecipient[row.recipient_id]) {
        latestByRecipient[row.recipient_id] = row;
      }
    }

    setLatestCorrespondenceByRecipient(latestByRecipient);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const haystack =
        `${r.name} ${r.city ?? ""} ${r.state ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;

    const withIndex = filtered.map((row, index) => ({ row, index }));
    const direction = sortDir === "asc" ? 1 : -1;

    withIndex.sort((a, b) => {
      const left = a.row;
      const right = b.row;

      let result = 0;
      if (sortKey === "name") {
        result = left.name.localeCompare(right.name);
      } else if (sortKey === "type") {
        result = left.type.localeCompare(right.type);
      } else if (sortKey === "frequency") {
        result =
          Number(left.shipment_frequency_months ?? 0) -
          Number(right.shipment_frequency_months ?? 0);
      } else if (sortKey === "location") {
        const leftLocation = `${left.city ?? ""}, ${left.state ?? ""}`;
        const rightLocation = `${right.city ?? ""}, ${right.state ?? ""}`;
        result = leftLocation.localeCompare(rightLocation);
      } else if (sortKey === "latest_correspondence") {
        const leftValue =
          latestCorrespondenceByRecipient[left.id]?.correspondence_date ?? "";
        const rightValue =
          latestCorrespondenceByRecipient[right.id]?.correspondence_date ?? "";
        result = leftValue.localeCompare(rightValue);
      } else if (sortKey === "updated") {
        result = left.updated_at.localeCompare(right.updated_at);
      }

      if (result === 0) return a.index - b.index;
      return result * direction;
    });

    return withIndex.map((entry) => entry.row);
  }, [filtered, latestCorrespondenceByRecipient, sortDir, sortKey]);

  const updateSort = (nextKey: SortKey) => {
    const next = new URLSearchParams(searchParams);
    const defaultDir: SortDir =
      nextKey === "updated" || nextKey === "latest_correspondence"
        ? "desc"
        : "asc";
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

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Recipients</h1>
          <p className="text-sm text-muted-foreground">
            Hospitals, clinics, individuals, and other delivery destinations.
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
                listSearch ? `/recipients/new?${listSearch}` : "/recipients/new"
              }
            >
              <Button>New recipient</Button>
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {correspondenceWarning ? (
        <div className="rounded-md border border-border bg-muted/35 p-3 text-sm text-foreground">
          {correspondenceWarning}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          className="w-full max-w-md rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          placeholder="Search recipients…"
          value={query}
          onChange={(e) => updateQueryParam(e.target.value)}
        />
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
                    onClick={() => updateSort("type")}
                  >
                    Type{sortIndicator("type")}
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
                    onClick={() => updateSort("location")}
                  >
                    Location{sortIndicator("location")}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => updateSort("latest_correspondence")}
                  >
                    Latest correspondence
                    {sortIndicator("latest_correspondence")}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => updateSort("updated")}
                  >
                    Updated{sortIndicator("updated")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border/80 hover:bg-muted/20"
                >
                  <td className="px-3 py-2">
                    <Link
                      className="font-medium text-foreground underline decoration-muted-foreground/50 underline-offset-2"
                      to={
                        listSearch
                          ? `/recipients/${r.id}?${listSearch}`
                          : `/recipients/${r.id}`
                      }
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.type}</td>
                  <td className="px-3 py-2">
                    {r.shipment_frequency_months
                      ? `Every ${r.shipment_frequency_months} month${r.shipment_frequency_months === 1 ? "" : "s"}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {[r.city, r.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {latestCorrespondenceByRecipient[r.id] ? (
                      <div className="max-w-72">
                        <div className="text-xs text-muted-foreground">
                          {new Date(
                            latestCorrespondenceByRecipient[r.id]
                              .correspondence_date,
                          ).toLocaleDateString()}
                        </div>
                        <div className="truncate">
                          {latestCorrespondenceByRecipient[r.id].note}
                        </div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(r.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-sm text-muted-foreground"
                    colSpan={6}
                  >
                    No recipients found.
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
