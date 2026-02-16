import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import type { Role } from "../auth/types";
import { Button } from "../components/ui/button";
import {
  formatDeliveryStatusById,
  type DeliveryStatusId,
} from "../lib/deliveryStatus";
import { supabase } from "../lib/supabaseClient";

type DeliveryContactSlot = "primary" | "secondary";

type AssociatedDeliveryRow = {
  id: string;
  requested_date: string | null;
  target_delivery_date: string | null;
  shipped_date: string | null;
  status_id: DeliveryStatusId | null;
  recipient_contact_slot: DeliveryContactSlot | null;
  wigs: number | null;
  beanies: number | null;
  notes: string | null;
  updated_at: string;
  recipients?: {
    primary_contact_first_name: string | null;
    primary_contact_last_name: string | null;
    secondary_contact_first_name: string | null;
    secondary_contact_last_name: string | null;
  } | null;
  user_profiles?: { full_name: string | null } | null;
};

type CorrespondenceEntryRow = {
  id: string;
  recipient_id: string;
  correspondence_date: string;
  note: string;
  created_at: string;
};

type AssociatedSortKey =
  | "requested"
  | "target"
  | "status"
  | "shipped"
  | "items"
  | "contact"
  | "coordinator";

type CorrespondenceSortKey = "date" | "note" | "logged";

type SortDir = "asc" | "desc";

const ASSOCIATED_SORT_KEYS: AssociatedSortKey[] = [
  "requested",
  "target",
  "status",
  "shipped",
  "items",
  "contact",
  "coordinator",
];

const CORRESPONDENCE_SORT_KEYS: CorrespondenceSortKey[] = [
  "date",
  "note",
  "logged",
];

function toAssociatedSortKey(value: string | null): AssociatedSortKey | null {
  if (!value) return null;
  if (ASSOCIATED_SORT_KEYS.includes(value as AssociatedSortKey)) {
    return value as AssociatedSortKey;
  }
  return null;
}

function toCorrespondenceSortKey(
  value: string | null,
): CorrespondenceSortKey | null {
  if (!value) return null;
  if (CORRESPONDENCE_SORT_KEYS.includes(value as CorrespondenceSortKey)) {
    return value as CorrespondenceSortKey;
  }
  return null;
}

function toSortDir(value: string | null): SortDir {
  return value === "asc" ? "asc" : "desc";
}

type RecipientType =
  | "hospital"
  | "clinic"
  | "cancer_center"
  | "individual"
  | "other";

type RecipientFormState = {
  name: string;
  type: RecipientType;
  assigned_user_id: string;
  shipment_frequency_months: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  primary_contact_first_name: string;
  primary_contact_last_name: string;
  primary_contact_email: string;
  primary_contact_phone: string;
  primary_contact_job_title: string;
  secondary_contact_first_name: string;
  secondary_contact_last_name: string;
  secondary_contact_email: string;
  secondary_contact_phone: string;
  secondary_contact_job_title: string;
  notes: string;
};

type AssignableUserOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const recipientTypes: RecipientType[] = [
  "hospital",
  "clinic",
  "cancer_center",
  "individual",
  "other",
];

function emptyForm(): RecipientFormState {
  return {
    name: "",
    type: "hospital",
    assigned_user_id: "",
    shipment_frequency_months: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    email: "",
    primary_contact_first_name: "",
    primary_contact_last_name: "",
    primary_contact_email: "",
    primary_contact_phone: "",
    primary_contact_job_title: "",
    secondary_contact_first_name: "",
    secondary_contact_last_name: "",
    secondary_contact_email: "",
    secondary_contact_phone: "",
    secondary_contact_job_title: "",
    notes: "",
  };
}

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

export function RecipientEdit() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();

  const canEdit = role === "admin" || role === "contacts_manager";
  const canDelete = role === "admin";
  const canCreateDeliveries = canEditDeliveries(role);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<RecipientFormState>(emptyForm());
  const [assignableUsers, setAssignableUsers] = useState<
    AssignableUserOption[]
  >([]);

  const [associatedDeliveries, setAssociatedDeliveries] = useState<
    AssociatedDeliveryRow[]
  >([]);
  const [associatedDeliveriesLoading, setAssociatedDeliveriesLoading] =
    useState(false);
  const [associatedDeliveriesError, setAssociatedDeliveriesError] = useState<
    string | null
  >(null);

  const [correspondenceRows, setCorrespondenceRows] = useState<
    CorrespondenceEntryRow[]
  >([]);
  const [correspondenceLoading, setCorrespondenceLoading] = useState(false);
  const [correspondenceSaving, setCorrespondenceSaving] = useState(false);
  const [correspondenceError, setCorrespondenceError] = useState<string | null>(
    null,
  );
  const [isCorrespondenceBackendReady, setIsCorrespondenceBackendReady] =
    useState(true);
  const [newCorrespondenceDate, setNewCorrespondenceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [newCorrespondenceNote, setNewCorrespondenceNote] = useState("");
  const associatedSortKey = toAssociatedSortKey(searchParams.get("dsort"));
  const associatedSortDir = toSortDir(searchParams.get("ddir"));
  const correspondenceSortKey = toCorrespondenceSortKey(
    searchParams.get("csort"),
  );
  const correspondenceSortDir = toSortDir(searchParams.get("cdir"));

  const title = useMemo(
    () => (isNew ? "New recipient" : "Edit recipient"),
    [isNew],
  );

  useEffect(() => {
    if (!canEdit) return;

    const loadAssignableUsers = async () => {
      const { data, error } = await supabase.rpc("list_assignable_users");
      if (error) {
        setError(error.message);
        setAssignableUsers([]);
        return;
      }
      setAssignableUsers((data ?? []) as AssignableUserOption[]);
    };

    void loadAssignableUsers();
  }, [canEdit]);

  useEffect(() => {
    if (isNew) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("recipients")
        .select(
          "name, type, assigned_user_id, shipment_frequency_months, address, city, state, zip, phone, email, primary_contact_first_name, primary_contact_last_name, primary_contact_email, primary_contact_phone, primary_contact_job_title, secondary_contact_first_name, secondary_contact_last_name, secondary_contact_email, secondary_contact_phone, secondary_contact_job_title, notes",
        )
        .eq("id", id)
        .maybeSingle();

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setError("Recipient not found.");
        setLoading(false);
        return;
      }

      setForm({
        name: (data as any).name ?? "",
        type: (data as any).type ?? "hospital",
        assigned_user_id: (data as any).assigned_user_id ?? "",
        shipment_frequency_months: (data as any).shipment_frequency_months
          ? String((data as any).shipment_frequency_months)
          : "",
        address: (data as any).address ?? "",
        city: (data as any).city ?? "",
        state: (data as any).state ?? "",
        zip: (data as any).zip ?? "",
        phone: (data as any).phone ?? "",
        email: (data as any).email ?? "",
        primary_contact_first_name:
          (data as any).primary_contact_first_name ?? "",
        primary_contact_last_name:
          (data as any).primary_contact_last_name ?? "",
        primary_contact_email: (data as any).primary_contact_email ?? "",
        primary_contact_phone: (data as any).primary_contact_phone ?? "",
        primary_contact_job_title:
          (data as any).primary_contact_job_title ?? "",
        secondary_contact_first_name:
          (data as any).secondary_contact_first_name ?? "",
        secondary_contact_last_name:
          (data as any).secondary_contact_last_name ?? "",
        secondary_contact_email: (data as any).secondary_contact_email ?? "",
        secondary_contact_phone: (data as any).secondary_contact_phone ?? "",
        secondary_contact_job_title:
          (data as any).secondary_contact_job_title ?? "",
        notes: (data as any).notes ?? "",
      });
      setLoading(false);
    };

    void load();
  }, [id, isNew]);

  const loadAssociatedDeliveries = async () => {
    if (!id) return;
    setAssociatedDeliveriesLoading(true);
    setAssociatedDeliveriesError(null);

    const { data, error } = await supabase
      .from("deliveries")
      .select(
        "id, requested_date, target_delivery_date, shipped_date, status_id, recipient_contact_slot, wigs, beanies, notes, updated_at, recipients(primary_contact_first_name,primary_contact_last_name,secondary_contact_first_name,secondary_contact_last_name), user_profiles(full_name)",
      )
      .eq("recipient_id", id)
      .order("target_delivery_date", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });

    if (error) {
      setAssociatedDeliveriesError(error.message);
      setAssociatedDeliveries([]);
      setAssociatedDeliveriesLoading(false);
      return;
    }

    const normalized = (data ?? []).map((row: any) => {
      const recipient = Array.isArray(row.recipients)
        ? row.recipients[0]
        : row.recipients;
      const coordinator = Array.isArray(row.user_profiles)
        ? row.user_profiles[0]
        : row.user_profiles;

      return {
        ...row,
        recipients: recipient
          ? {
              primary_contact_first_name:
                (recipient.primary_contact_first_name as string | null) ?? null,
              primary_contact_last_name:
                (recipient.primary_contact_last_name as string | null) ?? null,
              secondary_contact_first_name:
                (recipient.secondary_contact_first_name as string | null) ??
                null,
              secondary_contact_last_name:
                (recipient.secondary_contact_last_name as string | null) ??
                null,
            }
          : null,
        user_profiles: coordinator
          ? { full_name: (coordinator.full_name as string | null) ?? null }
          : null,
      };
    });

    setAssociatedDeliveries(normalized as unknown as AssociatedDeliveryRow[]);
    setAssociatedDeliveriesLoading(false);
  };

  useEffect(() => {
    if (isNew) return;
    void loadAssociatedDeliveries();
  }, [id, isNew]);

  const loadCorrespondenceHistory = async () => {
    if (!id) return;

    setCorrespondenceLoading(true);
    setCorrespondenceError(null);

    const { data, error } = await supabase
      .from("recipient_correspondence")
      .select("id, recipient_id, correspondence_date, note, created_at")
      .eq("recipient_id", id)
      .order("correspondence_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      if ((error as { code?: string }).code === "42P01") {
        setIsCorrespondenceBackendReady(false);
        setCorrespondenceRows([]);
        setCorrespondenceLoading(false);
        return;
      }

      setCorrespondenceError(error.message);
      setCorrespondenceRows([]);
      setCorrespondenceLoading(false);
      return;
    }

    setIsCorrespondenceBackendReady(true);
    setCorrespondenceRows((data ?? []) as CorrespondenceEntryRow[]);
    setCorrespondenceLoading(false);
  };

  useEffect(() => {
    if (isNew) return;
    void loadCorrespondenceHistory();
  }, [id, isNew]);

  const update = (patch: Partial<RecipientFormState>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const sortedCorrespondenceRows = useMemo(() => {
    if (!correspondenceSortKey) return correspondenceRows;

    const withIndex = correspondenceRows.map((row, index) => ({ row, index }));
    const direction = correspondenceSortDir === "asc" ? 1 : -1;

    withIndex.sort((a, b) => {
      const left = a.row;
      const right = b.row;
      let result = 0;

      if (correspondenceSortKey === "date") {
        result = left.correspondence_date.localeCompare(
          right.correspondence_date,
        );
      } else if (correspondenceSortKey === "note") {
        result = left.note.localeCompare(right.note);
      } else if (correspondenceSortKey === "logged") {
        result = left.created_at.localeCompare(right.created_at);
      }

      if (result === 0) return a.index - b.index;
      return result * direction;
    });

    return withIndex.map((entry) => entry.row);
  }, [correspondenceRows, correspondenceSortDir, correspondenceSortKey]);

  const sortedAssociatedDeliveries = useMemo(() => {
    if (!associatedSortKey) return associatedDeliveries;

    const withIndex = associatedDeliveries.map((row, index) => ({
      row,
      index,
    }));
    const direction = associatedSortDir === "asc" ? 1 : -1;

    withIndex.sort((a, b) => {
      const left = a.row;
      const right = b.row;
      let result = 0;

      if (associatedSortKey === "requested") {
        result = (left.requested_date ?? "").localeCompare(
          right.requested_date ?? "",
        );
      } else if (associatedSortKey === "target") {
        result = (left.target_delivery_date ?? "").localeCompare(
          right.target_delivery_date ?? "",
        );
      } else if (associatedSortKey === "status") {
        result = formatDeliveryStatusById(left.status_id).localeCompare(
          formatDeliveryStatusById(right.status_id),
        );
      } else if (associatedSortKey === "shipped") {
        result = (left.shipped_date ?? "").localeCompare(
          right.shipped_date ?? "",
        );
      } else if (associatedSortKey === "items") {
        result =
          Number(left.wigs ?? 0) +
          Number(left.beanies ?? 0) -
          (Number(right.wigs ?? 0) + Number(right.beanies ?? 0));
      } else if (associatedSortKey === "contact") {
        const leftContact =
          left.recipient_contact_slot === "primary"
            ? [
                left.recipients?.primary_contact_last_name,
                left.recipients?.primary_contact_first_name,
              ]
                .filter(Boolean)
                .join(", ") || "Primary"
            : left.recipient_contact_slot === "secondary"
              ? [
                  left.recipients?.secondary_contact_last_name,
                  left.recipients?.secondary_contact_first_name,
                ]
                  .filter(Boolean)
                  .join(", ") || "Secondary"
              : "";
        const rightContact =
          right.recipient_contact_slot === "primary"
            ? [
                right.recipients?.primary_contact_last_name,
                right.recipients?.primary_contact_first_name,
              ]
                .filter(Boolean)
                .join(", ") || "Primary"
            : right.recipient_contact_slot === "secondary"
              ? [
                  right.recipients?.secondary_contact_last_name,
                  right.recipients?.secondary_contact_first_name,
                ]
                  .filter(Boolean)
                  .join(", ") || "Secondary"
              : "";
        result = leftContact.localeCompare(rightContact);
      } else if (associatedSortKey === "coordinator") {
        result = (left.user_profiles?.full_name ?? "").localeCompare(
          right.user_profiles?.full_name ?? "",
        );
      }

      if (result === 0) return a.index - b.index;
      return result * direction;
    });

    return withIndex.map((entry) => entry.row);
  }, [associatedDeliveries, associatedSortDir, associatedSortKey]);

  const updateAssociatedSort = (nextKey: AssociatedSortKey) => {
    const next = new URLSearchParams(searchParams);
    const defaultDir: SortDir =
      nextKey === "requested" || nextKey === "target" || nextKey === "shipped"
        ? "desc"
        : "asc";
    if (associatedSortKey !== nextKey) {
      next.set("dsort", nextKey);
      next.set("ddir", defaultDir);
    } else if (associatedSortDir === "asc") {
      next.set("dsort", nextKey);
      next.set("ddir", "desc");
    } else {
      next.delete("dsort");
      next.delete("ddir");
    }

    setSearchParams(next, { replace: true });
  };

  const updateCorrespondenceSort = (nextKey: CorrespondenceSortKey) => {
    const next = new URLSearchParams(searchParams);
    const defaultDir: SortDir =
      nextKey === "date" || nextKey === "logged" ? "desc" : "asc";
    if (correspondenceSortKey !== nextKey) {
      next.set("csort", nextKey);
      next.set("cdir", defaultDir);
    } else if (correspondenceSortDir === "asc") {
      next.set("csort", nextKey);
      next.set("cdir", "desc");
    } else {
      next.delete("csort");
      next.delete("cdir");
    }

    setSearchParams(next, { replace: true });
  };

  const associatedSortIndicator = (key: AssociatedSortKey) => {
    if (associatedSortKey !== key) return "";
    return associatedSortDir === "asc" ? " ↑" : " ↓";
  };

  const correspondenceSortIndicator = (key: CorrespondenceSortKey) => {
    if (correspondenceSortKey !== key) return "";
    return correspondenceSortDir === "asc" ? " ↑" : " ↓";
  };

  const save = async () => {
    if (!canEdit) {
      setError("Not authorized to edit recipients.");
      return;
    }

    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      type: form.type,
      assigned_user_id: form.assigned_user_id || null,
      shipment_frequency_months: form.shipment_frequency_months
        ? Number.parseInt(form.shipment_frequency_months, 10)
        : null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      zip: form.zip || null,
      phone: form.phone || null,
      email: form.email || null,
      primary_contact_first_name:
        form.primary_contact_first_name.trim() || null,
      primary_contact_last_name: form.primary_contact_last_name.trim() || null,
      primary_contact_email: form.primary_contact_email.trim() || null,
      primary_contact_phone: form.primary_contact_phone.trim() || null,
      primary_contact_job_title: form.primary_contact_job_title.trim() || null,
      secondary_contact_first_name:
        form.secondary_contact_first_name.trim() || null,
      secondary_contact_last_name:
        form.secondary_contact_last_name.trim() || null,
      secondary_contact_email: form.secondary_contact_email.trim() || null,
      secondary_contact_phone: form.secondary_contact_phone.trim() || null,
      secondary_contact_job_title:
        form.secondary_contact_job_title.trim() || null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };

    if (isNew) {
      const { data, error } = await supabase
        .from("recipients")
        .insert(payload)
        .select("id")
        .maybeSingle();

      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }

      const createdId = (data as any)?.id as string | undefined;
      navigate(createdId ? `/recipients/${createdId}` : "/recipients", {
        replace: true,
      });
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("recipients")
      .update(payload)
      .eq("id", id);
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
  };

  const addCorrespondenceEntry = async () => {
    if (!canEdit || !id || !newCorrespondenceDate) return;

    const trimmedNote = newCorrespondenceNote.trim();
    if (!trimmedNote) {
      setCorrespondenceError("Correspondence note is required.");
      return;
    }

    setCorrespondenceSaving(true);
    setCorrespondenceError(null);

    const { error } = await supabase.from("recipient_correspondence").insert({
      recipient_id: id,
      correspondence_date: newCorrespondenceDate,
      note: trimmedNote,
    });

    if (error) {
      if ((error as { code?: string }).code === "42P01") {
        setIsCorrespondenceBackendReady(false);
        setCorrespondenceError(
          "Correspondence backend is not available yet for this environment.",
        );
        setCorrespondenceSaving(false);
        return;
      }

      setCorrespondenceError(error.message);
      setCorrespondenceSaving(false);
      return;
    }

    setIsCorrespondenceBackendReady(true);
    setNewCorrespondenceNote("");
    setCorrespondenceSaving(false);
    await loadCorrespondenceHistory();
  };

  const del = async () => {
    if (!canDelete || !id) return;
    const ok = window.confirm("Delete this recipient? This cannot be undone.");
    if (!ok) return;

    setSaving(true);
    setError(null);
    const { error } = await supabase.from("recipients").delete().eq("id", id);
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    navigate("/recipients", { replace: true });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            <Link className="underline" to={`/recipients${location.search}`}>
              Back to recipients
            </Link>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && canDelete ? (
            <Button
              variant="secondary"
              onClick={() => void del()}
              disabled={saving}
            >
              Delete
            </Button>
          ) : null}
          <Button
            onClick={() => void save()}
            disabled={saving || loading || !canEdit}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {!canEdit ? (
        <div className="rounded-md border border-border bg-muted/35 p-3 text-sm text-foreground">
          You have view-only access to recipients.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="grid grid-cols-1 gap-3 md:col-span-2 md:grid-cols-12">
              <div className="flex flex-col gap-1.5 md:col-span-5">
                <label className="text-xs font-medium text-foreground">
                  Name
                </label>
                <input
                  className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                  value={form.name}
                  onChange={(e) => update({ name: e.target.value })}
                  disabled={!canEdit || saving}
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-3">
                <label className="text-xs font-medium text-foreground">
                  Chapter Leader
                </label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                  value={form.assigned_user_id}
                  onChange={(e) => update({ assigned_user_id: e.target.value })}
                  disabled={!canEdit || saving}
                >
                  <option value="">Unassigned</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name ?? u.email ?? u.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-medium text-foreground">
                  Type
                </label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
                  value={form.type}
                  onChange={(e) =>
                    update({ type: e.target.value as RecipientType })
                  }
                  disabled={!canEdit || saving}
                >
                  {recipientTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-medium text-foreground">
                  Shipment freq (mo)
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="h-9 w-full rounded-md border border-input bg-card px-1.5 py-1.5 text-sm"
                  value={form.shipment_frequency_months}
                  onChange={(e) =>
                    update({ shipment_frequency_months: e.target.value })
                  }
                  disabled={!canEdit || saving}
                  placeholder="3"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:col-span-2 md:grid-cols-12">
              <div className="flex flex-col gap-1.5 md:col-span-5">
                <label className="text-xs font-medium text-foreground">
                  Address
                </label>
                <input
                  className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                  value={form.address}
                  onChange={(e) => update({ address: e.target.value })}
                  disabled={!canEdit || saving}
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-3">
                <label className="text-xs font-medium text-foreground">
                  City
                </label>
                <input
                  className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                  value={form.city}
                  onChange={(e) => update({ city: e.target.value })}
                  disabled={!canEdit || saving}
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-medium text-foreground">
                  State
                </label>
                <input
                  className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                  value={form.state}
                  onChange={(e) => update({ state: e.target.value })}
                  disabled={!canEdit || saving}
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-medium text-foreground">
                  ZIP
                </label>
                <input
                  className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                  value={form.zip}
                  onChange={(e) => update({ zip: e.target.value })}
                  disabled={!canEdit || saving}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:col-span-2 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">
                  Phone
                </label>
                <input
                  className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                  value={form.phone}
                  onChange={(e) => update({ phone: e.target.value })}
                  disabled={!canEdit || saving}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">
                  Email
                </label>
                <input
                  className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                  value={form.email}
                  onChange={(e) => update({ email: e.target.value })}
                  disabled={!canEdit || saving}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-medium text-foreground">
                Notes
              </label>
              <textarea
                className="min-h-20 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                value={form.notes}
                onChange={(e) => update({ notes: e.target.value })}
                disabled={!canEdit || saving}
              />
            </div>

            <div className="mt-1 rounded-lg border border-border/80 p-2.5 md:col-span-2">
              <h2 className="text-sm font-semibold">Primary contact</h2>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    First name
                  </label>
                  <input
                    className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                    value={form.primary_contact_first_name}
                    onChange={(e) =>
                      update({ primary_contact_first_name: e.target.value })
                    }
                    disabled={!canEdit || saving}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Last name
                  </label>
                  <input
                    className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                    value={form.primary_contact_last_name}
                    onChange={(e) =>
                      update({ primary_contact_last_name: e.target.value })
                    }
                    disabled={!canEdit || saving}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Job title
                  </label>
                  <input
                    className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                    value={form.primary_contact_job_title}
                    onChange={(e) =>
                      update({ primary_contact_job_title: e.target.value })
                    }
                    disabled={!canEdit || saving}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Email
                  </label>
                  <input
                    className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                    value={form.primary_contact_email}
                    onChange={(e) =>
                      update({ primary_contact_email: e.target.value })
                    }
                    disabled={!canEdit || saving}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Phone
                  </label>
                  <input
                    className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                    value={form.primary_contact_phone}
                    onChange={(e) =>
                      update({ primary_contact_phone: e.target.value })
                    }
                    disabled={!canEdit || saving}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/80 p-2.5 md:col-span-2">
              <h2 className="text-sm font-semibold">Secondary contact</h2>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    First name
                  </label>
                  <input
                    className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                    value={form.secondary_contact_first_name}
                    onChange={(e) =>
                      update({ secondary_contact_first_name: e.target.value })
                    }
                    disabled={!canEdit || saving}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Last name
                  </label>
                  <input
                    className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                    value={form.secondary_contact_last_name}
                    onChange={(e) =>
                      update({ secondary_contact_last_name: e.target.value })
                    }
                    disabled={!canEdit || saving}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Job title
                  </label>
                  <input
                    className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                    value={form.secondary_contact_job_title}
                    onChange={(e) =>
                      update({ secondary_contact_job_title: e.target.value })
                    }
                    disabled={!canEdit || saving}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Email
                  </label>
                  <input
                    className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                    value={form.secondary_contact_email}
                    onChange={(e) =>
                      update({ secondary_contact_email: e.target.value })
                    }
                    disabled={!canEdit || saving}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Phone
                  </label>
                  <input
                    className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                    value={form.secondary_contact_phone}
                    onChange={(e) =>
                      update({ secondary_contact_phone: e.target.value })
                    }
                    disabled={!canEdit || saving}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-3">
            <div className="rounded-lg border border-border/80 p-2.5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    Correspondence history
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Track the latest correspondence and keep a simple audit
                    trail.
                  </p>
                </div>
                {!isNew ? (
                  <div className="text-xs text-muted-foreground">
                    {correspondenceRows.length} total
                  </div>
                ) : null}
              </div>

              {isNew ? (
                <div className="mt-2 rounded-md border border-border bg-muted/35 p-3 text-sm text-foreground">
                  Save this recipient to add correspondence history.
                </div>
              ) : !isCorrespondenceBackendReady ? (
                <div className="mt-2 rounded-md border border-border bg-muted/35 p-3 text-sm text-foreground">
                  Correspondence history will appear here after the backend
                  table is available.
                </div>
              ) : (
                <>
                  <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-12">
                    <div className="flex flex-col gap-1.5 md:col-span-3">
                      <label className="text-xs font-medium text-foreground">
                        Date
                      </label>
                      <input
                        type="date"
                        className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                        value={newCorrespondenceDate}
                        onChange={(e) =>
                          setNewCorrespondenceDate(e.target.value)
                        }
                        disabled={!canEdit || saving || correspondenceSaving}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 md:col-span-7">
                      <label className="text-xs font-medium text-foreground">
                        Short note
                      </label>
                      <input
                        className="h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
                        value={newCorrespondenceNote}
                        maxLength={240}
                        onChange={(e) =>
                          setNewCorrespondenceNote(e.target.value)
                        }
                        disabled={!canEdit || saving || correspondenceSaving}
                        placeholder="Called primary contact to confirm intake process"
                      />
                    </div>

                    <div className="flex items-end md:col-span-2">
                      <Button
                        className="w-full"
                        onClick={() => void addCorrespondenceEntry()}
                        disabled={
                          !canEdit ||
                          saving ||
                          correspondenceSaving ||
                          !newCorrespondenceDate ||
                          !newCorrespondenceNote.trim()
                        }
                      >
                        {correspondenceSaving ? "Adding…" : "Add entry"}
                      </Button>
                    </div>
                  </div>

                  {correspondenceError ? (
                    <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                      {correspondenceError}
                    </div>
                  ) : null}

                  {correspondenceLoading ? (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Loading correspondence…
                    </div>
                  ) : (
                    <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-card/80">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-muted/35 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">
                              <button
                                type="button"
                                className="text-left"
                                onClick={() => updateCorrespondenceSort("date")}
                              >
                                Date{correspondenceSortIndicator("date")}
                              </button>
                            </th>
                            <th className="px-3 py-2">
                              <button
                                type="button"
                                className="text-left"
                                onClick={() => updateCorrespondenceSort("note")}
                              >
                                Note{correspondenceSortIndicator("note")}
                              </button>
                            </th>
                            <th className="px-3 py-2">
                              <button
                                type="button"
                                className="text-left"
                                onClick={() =>
                                  updateCorrespondenceSort("logged")
                                }
                              >
                                Logged{correspondenceSortIndicator("logged")}
                              </button>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedCorrespondenceRows.map((entry) => (
                            <tr
                              key={entry.id}
                              className="border-t border-border/80 hover:bg-muted/20"
                            >
                              <td className="px-3 py-2">
                                {new Date(
                                  entry.correspondence_date,
                                ).toLocaleDateString()}
                              </td>
                              <td className="px-3 py-2">{entry.note}</td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {new Date(
                                  entry.created_at,
                                ).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                          {sortedCorrespondenceRows.length === 0 ? (
                            <tr>
                              <td
                                className="px-3 py-6 text-center text-sm text-muted-foreground"
                                colSpan={3}
                              >
                                No correspondence history yet.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Associated deliveries</h2>
                <p className="text-sm text-muted-foreground">
                  Deliveries for this recipient.
                </p>
              </div>
              {!isNew ? (
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">
                    {associatedDeliveries.length} total
                  </div>
                  {canCreateDeliveries ? (
                    <Link to="/deliveries/new">
                      <Button size="sm">New delivery</Button>
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>

            {isNew ? (
              <div className="rounded-md border border-border bg-muted/35 p-3 text-sm text-foreground">
                Save this recipient to see its deliveries.
              </div>
            ) : associatedDeliveriesError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {associatedDeliveriesError}
              </div>
            ) : associatedDeliveriesLoading ? (
              <div className="text-sm text-muted-foreground">
                Loading deliveries…
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card/80">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted/35 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => updateAssociatedSort("requested")}
                        >
                          Requested on{associatedSortIndicator("requested")}
                        </button>
                      </th>
                      <th className="px-3 py-2">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => updateAssociatedSort("target")}
                        >
                          Target date{associatedSortIndicator("target")}
                        </button>
                      </th>
                      <th className="px-3 py-2">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => updateAssociatedSort("status")}
                        >
                          Status{associatedSortIndicator("status")}
                        </button>
                      </th>
                      <th className="px-3 py-2">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => updateAssociatedSort("shipped")}
                        >
                          Shipped date{associatedSortIndicator("shipped")}
                        </button>
                      </th>
                      <th className="px-3 py-2">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => updateAssociatedSort("items")}
                        >
                          <div>Items{associatedSortIndicator("items")}</div>
                        </button>
                        <div className="text-[10px] font-normal normal-case text-muted-foreground">
                          W | B | T
                        </div>
                      </th>
                      <th className="px-3 py-2">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => updateAssociatedSort("contact")}
                        >
                          Contact{associatedSortIndicator("contact")}
                        </button>
                      </th>
                      <th className="px-3 py-2">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => updateAssociatedSort("coordinator")}
                        >
                          Coordinator{associatedSortIndicator("coordinator")}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAssociatedDeliveries.map((d) => (
                      <Fragment key={d.id}>
                        <tr className="border-t border-border/80 hover:bg-muted/20">
                          <td className="px-3 py-2">
                            {d.requested_date
                              ? new Date(d.requested_date).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <Link
                              className="font-medium text-foreground underline decoration-muted-foreground/50 underline-offset-2"
                              to={`/deliveries/${d.id}`}
                            >
                              {d.target_delivery_date
                                ? new Date(
                                    d.target_delivery_date,
                                  ).toLocaleDateString()
                                : "—"}
                            </Link>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${statusClassName(d.status_id)}`}
                            >
                              {formatDeliveryStatusById(d.status_id)}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {d.shipped_date
                              ? new Date(d.shipped_date).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-medium">
                              {Number(d.wigs ?? 0)}
                            </span>
                            <span className="mx-2 text-muted-foreground">
                              |
                            </span>
                            <span className="font-medium">
                              {Number(d.beanies ?? 0)}
                            </span>
                            <span className="mx-2 text-muted-foreground">
                              |
                            </span>
                            <span className="font-medium">
                              {Number(d.wigs ?? 0) + Number(d.beanies ?? 0)}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {d.recipient_contact_slot === "primary"
                              ? [
                                  d.recipients?.primary_contact_last_name,
                                  d.recipients?.primary_contact_first_name,
                                ]
                                  .filter(Boolean)
                                  .join(", ") || "Primary"
                              : d.recipient_contact_slot === "secondary"
                                ? [
                                    d.recipients?.secondary_contact_last_name,
                                    d.recipients?.secondary_contact_first_name,
                                  ]
                                    .filter(Boolean)
                                    .join(", ") || "Secondary"
                                : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {d.user_profiles?.full_name ?? "Unassigned"}
                          </td>
                        </tr>
                        {d.notes?.trim() ? (
                          <tr className="bg-muted/5">
                            <td
                              className="px-3 pb-2 pt-0 text-xs text-muted-foreground"
                              colSpan={7}
                            >
                              <span className="font-medium text-foreground">
                                Note:
                              </span>{" "}
                              {d.notes}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                    {sortedAssociatedDeliveries.length === 0 ? (
                      <tr>
                        <td
                          className="px-3 py-6 text-center text-sm text-muted-foreground"
                          colSpan={7}
                        >
                          No deliveries for this recipient.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
