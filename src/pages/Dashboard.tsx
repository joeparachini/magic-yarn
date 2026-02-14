import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  DELIVERY_STATUS_IDS,
  DELIVERY_STATUS_LABELS_BY_ID,
} from "../lib/deliveryStatus";
import { supabase } from "../lib/supabaseClient";

type MonthlyDeliverySummary = {
  key: string;
  label: string;
  total: number;
  wigs: number;
  beanies: number;
  awaitingConfirmation: number;
  approved: number;
  completed: number;
  cancelled: number;
};

async function hasPermission(permission: "deliveries.read"): Promise<boolean> {
  const { data, error } = await supabase.rpc("current_user_has_permission", {
    p: permission,
  });
  if (error) return false;
  return Boolean(data);
}

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canReadDeliveries, setCanReadDeliveries] = useState(false);

  const currentYear = new Date().getFullYear();
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [monthlySummaries, setMonthlySummaries] = useState<
    MonthlyDeliverySummary[]
  >([]);

  const loadAvailableYears = async (): Promise<number[]> => {
    const [minResult, maxResult] = await Promise.all([
      supabase
        .from("deliveries")
        .select("target_delivery_date")
        .not("target_delivery_date", "is", null)
        .order("target_delivery_date", { ascending: true })
        .limit(1),
      supabase
        .from("deliveries")
        .select("target_delivery_date")
        .not("target_delivery_date", "is", null)
        .order("target_delivery_date", { ascending: false })
        .limit(1),
    ]);

    if (minResult.error) throw minResult.error;
    if (maxResult.error) throw maxResult.error;

    const minDate = minResult.data?.[0]?.target_delivery_date as
      | string
      | undefined;
    const maxDate = maxResult.data?.[0]?.target_delivery_date as
      | string
      | undefined;

    const minYear = minDate ? Number(minDate.slice(0, 4)) : currentYear;
    const maxYear = maxDate ? Number(maxDate.slice(0, 4)) : currentYear;

    const startYear = Number.isFinite(minYear) ? minYear : currentYear;
    const endYear = Number.isFinite(maxYear) ? maxYear : currentYear;

    const years: number[] = [];
    for (let year = endYear; year >= startYear; year -= 1) {
      years.push(year);
    }

    return years.length > 0 ? years : [currentYear];
  };

  const loadMonthlySummaries = async (year: number) => {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const { data, error } = await supabase
      .from("deliveries")
      .select("target_delivery_date,status_id,wigs,beanies")
      .not("target_delivery_date", "is", null)
      .gte("target_delivery_date", yearStart)
      .lte("target_delivery_date", yearEnd)
      .in("status_id", [...DELIVERY_STATUS_IDS]);

    if (error) throw error;

    const months = Array.from({ length: 12 }, (_, monthIndex) => {
      const monthDate = new Date(year, monthIndex, 1);
      const month = String(monthIndex + 1).padStart(2, "0");
      return {
        key: `${year}-${month}`,
        label: monthDate.toLocaleDateString(undefined, {
          month: "long",
        }),
        total: 0,
        wigs: 0,
        beanies: 0,
        awaitingConfirmation: 0,
        approved: 0,
        completed: 0,
        cancelled: 0,
      };
    });

    const byKey = new Map(months.map((month) => [month.key, month]));

    for (const row of data ?? []) {
      const monthKey = String(row.target_delivery_date).slice(0, 7);
      const summary = byKey.get(monthKey);
      if (!summary) continue;

      summary.total += 1;
      summary.wigs += Number(row.wigs ?? 0);
      summary.beanies += Number(row.beanies ?? 0);
      if (row.status_id === 3) {
        summary.completed += 1;
      } else if (row.status_id === 4) {
        summary.cancelled += 1;
      } else if (row.status_id === 2) {
        summary.approved += 1;
      } else {
        summary.awaitingConfirmation += 1;
      }
    }

    setMonthlySummaries(months);
  };

  const load = async (year: number, refreshYears: boolean) => {
    setLoading(true);
    setError(null);

    try {
      const deliveriesOk = await hasPermission("deliveries.read");
      setCanReadDeliveries(deliveriesOk);

      if (!deliveriesOk) {
        setMonthlySummaries([]);
        setLoading(false);
        return;
      }

      if (refreshYears) {
        const years = await loadAvailableYears();
        setAvailableYears(years);

        const nextYear = years.includes(year) ? year : years[0];
        if (nextYear !== selectedYear) {
          setSelectedYear(nextYear);
        }

        await loadMonthlySummaries(nextYear);
      } else {
        await loadMonthlySummaries(year);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load monthly deliveries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(selectedYear, true);
  }, []);

  const onYearChange = (year: number) => {
    setSelectedYear(year);
    void load(year, false);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Monthly deliveries</h1>
          <p className="text-sm text-muted-foreground">
            Delivery totals and status breakdown by month.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => void load(selectedYear, true)}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {canReadDeliveries ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <label className="text-muted-foreground" htmlFor="dashboard-year">
                Year
              </label>
              <select
                id="dashboard-year"
                className="w-36 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                value={selectedYear}
                onChange={(e) => onYearChange(Number(e.target.value))}
                disabled={loading}
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-destructive" />
                {DELIVERY_STATUS_LABELS_BY_ID[4]}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-chart-4" />
                {DELIVERY_STATUS_LABELS_BY_ID[1]}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-chart-1" />
                {DELIVERY_STATUS_LABELS_BY_ID[2]}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-chart-2" />
                {DELIVERY_STATUS_LABELS_BY_ID[3]}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {monthlySummaries.map((month) => (
              <div
                key={month.key}
                className="rounded-lg border border-border/80 bg-background/70 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{month.label}</div>
                  <Link
                    className="text-xs underline"
                    to={`/deliveries?month=${month.key}`}
                  >
                    View
                  </Link>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-muted/30 px-2 py-2">
                    <div className="text-4xl font-semibold leading-none">
                      {month.total}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Total deliveries
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/30 px-2 py-2">
                    <div className="text-4xl font-semibold leading-none">
                      {month.wigs}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Wigs
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/30 px-2 py-2">
                    <div className="text-4xl font-semibold leading-none">
                      {month.beanies}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Beanies
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <div className="flex h-full flex-col items-center rounded-md bg-destructive/10 px-2 py-2 text-destructive">
                    <div className="text-lg font-semibold leading-none">
                      {month.cancelled}
                    </div>
                    <div className="mt-1 min-h-[2.25em] text-[11px] leading-tight">
                      {DELIVERY_STATUS_LABELS_BY_ID[4]}
                    </div>
                  </div>
                  <div className="flex h-full flex-col items-center rounded-md bg-chart-4/15 px-2 py-2 text-chart-4">
                    <div className="text-lg font-semibold leading-none">
                      {month.awaitingConfirmation}
                    </div>
                    <div className="mt-1 min-h-[2.25em] text-[11px] leading-tight">
                      {DELIVERY_STATUS_LABELS_BY_ID[1]}
                    </div>
                  </div>
                  <div className="flex h-full flex-col items-center rounded-md bg-chart-1/15 px-2 py-2 text-chart-1">
                    <div className="text-lg font-semibold leading-none">
                      {month.approved}
                    </div>
                    <div className="mt-1 min-h-[2.25em] text-[11px] leading-tight">
                      {DELIVERY_STATUS_LABELS_BY_ID[2]}
                    </div>
                  </div>
                  <div className="flex h-full flex-col items-center rounded-md bg-chart-2/15 px-2 py-2 text-chart-2">
                    <div className="text-lg font-semibold leading-none">
                      {month.completed}
                    </div>
                    <div className="mt-1 min-h-[2.25em] text-[11px] leading-tight">
                      {DELIVERY_STATUS_LABELS_BY_ID[3]}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-border bg-card/80 p-4 text-sm text-muted-foreground">
          You don’t have permission to view delivery metrics.
        </div>
      )}
    </div>
  );
}
