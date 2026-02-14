import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import type { Role } from "../auth/types";
import { Button } from "../components/ui/button";
import {
  DELIVERY_STATUS_OPTIONS,
  type DeliveryStatusId,
  toDeliveryStatusId,
} from "../lib/deliveryStatus";
import { supabase } from "../lib/supabaseClient";
type RecipientOption = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  assigned_user_id: string | null;
  user_profiles?: { full_name: string | null } | null;
};

type DeliveryFormState = {
  recipient_id: string;
  requested_date: string;
  target_delivery_date: string;
  shipped_date: string;
  tracking_number: string;
  completed_date: string;
  status_id: DeliveryStatusId;
  coordinator_id: string;
  wigs: number;
  beanies: number;
  notes: string;
};

function canEditDeliveries(role: Role | null) {
  return (
    role === "admin" ||
    role === "delivery_coordinator" ||
    role === "contacts_manager"
  );
}

function emptyForm(): DeliveryFormState {
  return {
    recipient_id: "",
    requested_date: "",
    target_delivery_date: "",
    shipped_date: "",
    tracking_number: "",
    completed_date: "",
    status_id: 1,
    coordinator_id: "",
    wigs: 0,
    beanies: 0,
    notes: "",
  };
}

export function DeliveryEdit() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const canEdit = canEditDeliveries(role);
  const canDelete = role === "admin";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recipients, setRecipients] = useState<RecipientOption[]>([]);

  const [recipientAddress, setRecipientAddress] = useState<string>("");

  const [form, setForm] = useState<DeliveryFormState>(emptyForm());

  const title = useMemo(
    () => (isNew ? "New delivery" : "Edit delivery"),
    [isNew],
  );
  const totalItems = form.wigs + form.beanies;

  const update = (patch: Partial<DeliveryFormState>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const loadRecipients = async () => {
    const { data, error } = await supabase
      .from("recipients")
      .select(
        "id, name, address, city, state, zip, assigned_user_id, user_profiles(full_name)",
      )
      .order("name");
    if (error) {
      setError(error.message);
      setRecipients([]);
      return;
    }

    const normalized = (data ?? []).map((row: any) => {
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
    });

    setRecipients(normalized as RecipientOption[]);
  };

  const formatAddress = (parts: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  }) => {
    const line1 = (parts.address ?? "").trim();
    const line2 = [parts.city, parts.state, parts.zip]
      .filter(Boolean)
      .join(", ")
      .replace(", ,", ",")
      .trim();
    return [line1, line2].filter(Boolean).join(" | ").trim();
  };

  const loadRecipientAddress = (recipientId: string) => {
    if (!recipientId) {
      setRecipientAddress("");
      return;
    }
    const selected = recipients.find(
      (recipient) => recipient.id === recipientId,
    );
    if (!selected) {
      setRecipientAddress("");
      return;
    }
    setRecipientAddress(formatAddress(selected));
  };

  useEffect(() => {
    void loadRecipients();
  }, []);

  useEffect(() => {
    loadRecipientAddress(form.recipient_id);
  }, [form.recipient_id, recipients]);

  const selectedRecipient = useMemo(
    () => recipients.find((recipient) => recipient.id === form.recipient_id),
    [recipients, form.recipient_id],
  );

  const chapterLeaderLabel = useMemo(() => {
    if (!selectedRecipient?.assigned_user_id) return "Unassigned";
    return (
      selectedRecipient.user_profiles?.full_name?.trim() ||
      selectedRecipient.assigned_user_id
    );
  }, [selectedRecipient]);

  useEffect(() => {
    const nextCoordinator = selectedRecipient?.assigned_user_id ?? "";
    setForm((prev) =>
      prev.coordinator_id === nextCoordinator
        ? prev
        : { ...prev, coordinator_id: nextCoordinator },
    );
  }, [selectedRecipient]);

  useEffect(() => {
    if (isNew) return;
    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("deliveries")
        .select(
          "recipient_id, requested_date, target_delivery_date, shipped_date, tracking_number, completed_date, status_id, coordinator_id, address, wigs, beanies, notes",
        )
        .eq("id", id)
        .maybeSingle();

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      if (!data) {
        setError("Delivery not found.");
        setLoading(false);
        return;
      }

      const recipientId = (data as any).recipient_id as string;
      setForm({
        recipient_id: recipientId,
        requested_date: (data as any).requested_date ?? "",
        target_delivery_date: (data as any).target_delivery_date ?? "",
        shipped_date: (data as any).shipped_date ?? "",
        tracking_number: (data as any).tracking_number ?? "",
        completed_date: (data as any).completed_date ?? "",
        status_id: toDeliveryStatusId((data as any).status_id) ?? 1,
        coordinator_id: (data as any).coordinator_id ?? "",
        wigs: Number((data as any).wigs ?? 0),
        beanies: Number((data as any).beanies ?? 0),
        notes: (data as any).notes ?? "",
      });

      loadRecipientAddress(recipientId);

      setLoading(false);
    };

    void load();
  }, [id, isNew]);

  const save = async () => {
    if (!canEdit) {
      setError("Not authorized to edit deliveries.");
      return;
    }
    if (!form.recipient_id) {
      setError("Recipient is required.");
      return;
    }

    const resolvedAddress = recipientAddress;
    if (!resolvedAddress) {
      setError("Recipient address is blank. Add an address to the recipient.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      recipient_id: form.recipient_id,
      recipient_contact_slot: null,
      requested_date: form.requested_date ? form.requested_date : null,
      target_delivery_date: form.target_delivery_date
        ? form.target_delivery_date
        : null,
      shipped_date: form.shipped_date ? form.shipped_date : null,
      tracking_number: form.tracking_number.trim() || null,
      completed_date: form.completed_date ? form.completed_date : null,
      status_id: form.status_id,
      coordinator_id: form.coordinator_id || null,
      wigs: Math.max(0, Math.trunc(Number(form.wigs) || 0)),
      beanies: Math.max(0, Math.trunc(Number(form.beanies) || 0)),
      address: resolvedAddress,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (isNew) {
      const { data, error } = await supabase
        .from("deliveries")
        .insert(payload)
        .select("id")
        .maybeSingle();
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
      const createdId = (data as any)?.id as string | undefined;
      navigate(createdId ? `/deliveries/${createdId}` : "/deliveries", {
        replace: true,
      });
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("deliveries")
      .update(payload)
      .eq("id", id);
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
  };

  const del = async () => {
    if (!canDelete || !id) return;
    const ok = window.confirm("Delete this delivery? This cannot be undone.");
    if (!ok) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("deliveries").delete().eq("id", id);
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    navigate("/deliveries", { replace: true });
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            <Link className="underline" to={`/deliveries${location.search}`}>
              Back to deliveries
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
          You have view-only access to deliveries.
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
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-foreground">
                Recipient
              </label>
              <select
                className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={form.recipient_id}
                onChange={(e) => {
                  update({
                    recipient_id: e.target.value,
                  });
                }}
                disabled={!canEdit || saving}
              >
                <option value="">Select recipient…</option>
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-foreground">
                Status
              </label>
              <select
                className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={String(form.status_id)}
                onChange={(e) => {
                  const nextStatusId = toDeliveryStatusId(e.target.value);
                  if (!nextStatusId) return;
                  update({ status_id: nextStatusId });
                }}
                disabled={!canEdit || saving}
              >
                {DELIVERY_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={String(option.value)}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-foreground">
                Chapter leader
              </label>
              <input
                className="w-full rounded-md border border-input bg-muted/35 px-3 py-2 text-sm"
                value={chapterLeaderLabel}
                readOnly
              />
            </div>

            <div className="grid grid-cols-3 gap-4 md:col-span-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-foreground">
                  Requested on
                </label>
                <input
                  type="date"
                  className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={form.requested_date}
                  onChange={(e) => update({ requested_date: e.target.value })}
                  disabled={!canEdit || saving}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-foreground">
                  Target delivery date
                </label>
                <input
                  type="date"
                  className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={form.target_delivery_date}
                  onChange={(e) =>
                    update({ target_delivery_date: e.target.value })
                  }
                  disabled={!canEdit || saving}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:col-span-3 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-foreground">
                  Shipped date
                </label>
                <input
                  type="date"
                  className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={form.shipped_date}
                  onChange={(e) => update({ shipped_date: e.target.value })}
                  disabled={!canEdit || saving}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-foreground">
                  Tracking number
                </label>
                <input
                  type="text"
                  className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={form.tracking_number}
                  onChange={(e) => update({ tracking_number: e.target.value })}
                  disabled={!canEdit || saving}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-foreground">
                  Completed date
                </label>
                <input
                  type="date"
                  className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={form.completed_date}
                  onChange={(e) => update({ completed_date: e.target.value })}
                  disabled={!canEdit || saving}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 md:col-span-3">
              <label className="text-xs font-medium text-foreground">
                Address
              </label>
              <div className="rounded-md border border-input bg-muted/35 px-3 py-2 text-sm text-foreground">
                {recipientAddress || "—"}
              </div>
            </div>

            <div className="flex flex-col gap-2 md:col-span-3">
              <label className="text-xs font-medium text-foreground">
                Notes
              </label>
              <textarea
                className="min-h-24 rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => update({ notes: e.target.value })}
                disabled={!canEdit || saving}
              />
            </div>

            <div className="flex gap-4 md:col-span-3">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <label className="text-xs font-medium text-foreground">
                  Wigs
                </label>
                <input
                  type="number"
                  min={0}
                  className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={form.wigs}
                  onChange={(e) =>
                    update({ wigs: Math.max(0, Number(e.target.value || 0)) })
                  }
                  disabled={!canEdit || saving}
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <label className="text-xs font-medium text-foreground">
                  Beanies
                </label>
                <input
                  type="number"
                  min={0}
                  className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={form.beanies}
                  onChange={(e) =>
                    update({
                      beanies: Math.max(0, Number(e.target.value || 0)),
                    })
                  }
                  disabled={!canEdit || saving}
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <label className="text-xs font-medium text-foreground">
                  Total items
                </label>
                <div className="rounded-md border border-input bg-muted/35 px-3 py-2 text-sm text-foreground">
                  {totalItems}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
