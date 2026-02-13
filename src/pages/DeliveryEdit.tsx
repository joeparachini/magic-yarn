import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import type { Role } from "../auth/types";
import { Button } from "../components/ui/button";
import { supabase } from "../lib/supabaseClient";

type DeliveryStatus = "pending" | "scheduled" | "completed" | "cancelled";
type OrgOption = { id: string; name: string };
type ContactOption = {
  id: string;
  first_name: string;
  last_name: string;
  organization_id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};
type CoordinatorOption = { id: string; full_name: string | null };

type DeliveryFormState = {
  organization_id: string;
  contact_id: string;
  delivery_date: string;
  status: DeliveryStatus;
  coordinator_id: string;
  notes: string;
};

type DeliveryItemRow = {
  id: string;
  delivery_id: string;
  wig_type: string;
  quantity: number;
  notes: string | null;
  created_at: string;
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
    organization_id: "",
    contact_id: "",
    delivery_date: "",
    status: "pending",
    coordinator_id: "",
    notes: "",
  };
}

const statusOptions: DeliveryStatus[] = [
  "pending",
  "scheduled",
  "completed",
  "cancelled",
];

export function DeliveryEdit() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const canEdit = canEditDeliveries(role);
  const canDelete = role === "admin";
  const isAdmin = role === "admin";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [coordinators, setCoordinators] = useState<CoordinatorOption[]>([]);

  const [orgAddress, setOrgAddress] = useState<string>("");
  const [contactAddress, setContactAddress] = useState<string>("");
  const [addressSource, setAddressSource] = useState<
    "organization" | "contact"
  >("organization");

  const [form, setForm] = useState<DeliveryFormState>(emptyForm());
  const [items, setItems] = useState<DeliveryItemRow[]>([]);

  const title = useMemo(
    () => (isNew ? "New delivery" : "Edit delivery"),
    [isNew],
  );

  const update = (patch: Partial<DeliveryFormState>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const loadOrgs = async () => {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name")
      .order("name");
    if (error) {
      setError(error.message);
      setOrgs([]);
      return;
    }
    setOrgs((data ?? []) as OrgOption[]);
  };

  const loadContactsForOrg = async (organizationId: string) => {
    if (!organizationId) {
      setContacts([]);
      return;
    }
    const { data, error } = await supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, organization_id, address, city, state, zip",
      )
      .eq("organization_id", organizationId)
      .order("last_name")
      .order("first_name");
    if (error) {
      setError(error.message);
      setContacts([]);
      return;
    }
    setContacts((data ?? []) as ContactOption[]);
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

  const loadOrgAddress = async (organizationId: string) => {
    if (!organizationId) {
      setOrgAddress("");
      return;
    }
    const { data, error } = await supabase
      .from("organizations")
      .select("address, city, state, zip")
      .eq("id", organizationId)
      .maybeSingle();
    if (error) {
      setError(error.message);
      setOrgAddress("");
      return;
    }
    setOrgAddress(formatAddress(data as any));
  };

  const loadCoordinators = async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, full_name")
      .order("created_at", { ascending: false });
    if (error) {
      setError(error.message);
      setCoordinators([]);
      return;
    }
    setCoordinators((data ?? []) as CoordinatorOption[]);
  };

  const loadItems = async (deliveryId: string) => {
    const { data, error } = await supabase
      .from("delivery_items")
      .select("id, delivery_id, wig_type, quantity, notes, created_at")
      .eq("delivery_id", deliveryId)
      .order("created_at", { ascending: true });
    if (error) {
      setError(error.message);
      setItems([]);
      return;
    }
    setItems((data ?? []) as DeliveryItemRow[]);
  };

  useEffect(() => {
    void loadOrgs();
    void loadCoordinators();
  }, []);

  useEffect(() => {
    void loadContactsForOrg(form.organization_id);
    void loadOrgAddress(form.organization_id);
    setContactAddress("");
    setAddressSource("organization");
    update({ contact_id: "" });
  }, [form.organization_id]);

  useEffect(() => {
    const selected = contacts.find((c) => c.id === form.contact_id);
    if (!selected) {
      setContactAddress("");
      return;
    }
    setContactAddress(
      formatAddress({
        address: selected.address,
        city: selected.city,
        state: selected.state,
        zip: selected.zip,
      }),
    );
  }, [contacts, form.contact_id]);

  useEffect(() => {
    if (isNew) return;
    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("deliveries")
        .select(
          "organization_id, contact_id, delivery_date, status, coordinator_id, address, notes",
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

      const organizationId = (data as any).organization_id as string;
      const existingAddress = ((data as any).address ?? "") as string;
      setForm({
        organization_id: organizationId,
        contact_id: (data as any).contact_id ?? "",
        delivery_date: (data as any).delivery_date ?? "",
        status: ((data as any).status ?? "pending") as DeliveryStatus,
        coordinator_id: (data as any).coordinator_id ?? "",
        notes: (data as any).notes ?? "",
      });

      await loadContactsForOrg(organizationId);
      await loadOrgAddress(organizationId);
      await loadItems(id);

      // Best-effort detection of address source for existing deliveries
      const contact = ((
        await supabase
          .from("contacts")
          .select("address, city, state, zip")
          .eq("id", (data as any).contact_id)
          .maybeSingle()
      ).data ?? null) as any;
      const contactAddr = formatAddress(contact ?? {});
      setContactAddress(contactAddr);
      if (existingAddress && contactAddr && existingAddress === contactAddr)
        setAddressSource("contact");
      else setAddressSource("organization");

      setLoading(false);
    };

    void load();
  }, [id, isNew]);

  const save = async () => {
    if (!canEdit) {
      setError("Not authorized to edit deliveries.");
      return;
    }
    if (!form.organization_id) {
      setError("Organization is required.");
      return;
    }
    if (!form.contact_id) {
      setError("Contact is required.");
      return;
    }

    const resolvedAddress =
      addressSource === "contact" ? contactAddress : orgAddress;
    if (!resolvedAddress) {
      setError(
        addressSource === "contact"
          ? "Contact address is blank. Add an address to the contact or switch to organization address."
          : "Organization address is blank. Add an address to the organization or switch to contact address.",
      );
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      organization_id: form.organization_id,
      contact_id: form.contact_id,
      delivery_date: form.delivery_date ? form.delivery_date : null,
      status: form.status,
      coordinator_id: form.coordinator_id || null,
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

  const assignToMe = async () => {
    if (!canEdit || !user?.id) return;
    update({ coordinator_id: user.id });
    if (!isNew) {
      setSaving(true);
      const { error } = await supabase
        .from("deliveries")
        .update({
          coordinator_id: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) setError(error.message);
      setSaving(false);
    }
  };

  const addItem = async () => {
    if (!canEdit) return;
    if (isNew || !id) {
      setError("Save the delivery before adding items.");
      return;
    }

    setSaving(true);
    setError(null);
    const { error } = await supabase.from("delivery_items").insert({
      delivery_id: id,
      wig_type: "Standard",
      quantity: 1,
      notes: null,
    });
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    await loadItems(id);
    setSaving(false);
  };

  const updateItem = async (
    itemId: string,
    patch: Partial<Pick<DeliveryItemRow, "wig_type" | "quantity" | "notes">>,
  ) => {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("delivery_items")
      .update(patch)
      .eq("id", itemId);
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    if (id) await loadItems(id);
    setSaving(false);
  };

  const deleteItem = async (itemId: string) => {
    if (!canEdit) return;
    const ok = window.confirm("Delete this item?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("delivery_items")
      .delete()
      .eq("id", itemId);
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    if (id) await loadItems(id);
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-neutral-600">
            <Link className="underline" to="/deliveries">
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
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          You have view-only access to deliveries.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-neutral-600">Loading…</div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-xs font-medium text-neutral-700">
                Organization
              </label>
              <select
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                value={form.organization_id}
                onChange={(e) =>
                  update({ organization_id: e.target.value, contact_id: "" })
                }
                disabled={!canEdit || saving}
              >
                <option value="">Select organization…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-xs font-medium text-neutral-700">
                Contact
              </label>
              <select
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                value={form.contact_id}
                onChange={(e) => update({ contact_id: e.target.value })}
                disabled={!canEdit || saving || !form.organization_id}
              >
                <option value="">Select contact…</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.last_name}, {c.first_name}
                  </option>
                ))}
              </select>
              {!form.organization_id ? (
                <div className="text-xs text-neutral-600">
                  Select an organization first.
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-neutral-700">
                Delivery date
              </label>
              <input
                type="date"
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                value={form.delivery_date}
                onChange={(e) => update({ delivery_date: e.target.value })}
                disabled={!canEdit || saving}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-neutral-700">
                Status
              </label>
              <select
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                value={form.status}
                onChange={(e) =>
                  update({ status: e.target.value as DeliveryStatus })
                }
                disabled={!canEdit || saving}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-xs font-medium text-neutral-700">
                Coordinator
              </label>
              {isAdmin ? (
                <select
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                  value={form.coordinator_id}
                  onChange={(e) => update({ coordinator_id: e.target.value })}
                  disabled={!canEdit || saving}
                >
                  <option value="">Unassigned</option>
                  {coordinators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name ?? c.id}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    className="w-full rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm"
                    value={
                      form.coordinator_id
                        ? form.coordinator_id === user?.id
                          ? "Assigned to you"
                          : form.coordinator_id
                        : "Unassigned"
                    }
                    readOnly
                  />
                  {canEdit ? (
                    <Button
                      variant="secondary"
                      onClick={() => void assignToMe()}
                      disabled={saving}
                    >
                      Assign me
                    </Button>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-xs font-medium text-neutral-700">
                Address
              </label>
              <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="addressSource"
                      checked={addressSource === "organization"}
                      onChange={() => setAddressSource("organization")}
                      disabled={!canEdit || saving}
                    />
                    Organization address
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="addressSource"
                      checked={addressSource === "contact"}
                      onChange={() => setAddressSource("contact")}
                      disabled={!canEdit || saving || !form.contact_id}
                    />
                    Contact address
                  </label>
                </div>
                <div className="rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
                  {(addressSource === "contact"
                    ? contactAddress
                    : orgAddress) || "—"}
                </div>
                <div className="text-xs text-neutral-600">
                  Address is restricted to the selected Organization or Contact
                  address.
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-xs font-medium text-neutral-700">
                Notes
              </label>
              <textarea
                className="min-h-24 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => update({ notes: e.target.value })}
                disabled={!canEdit || saving}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Items</h2>
                <p className="text-sm text-neutral-600">
                  Wig types and quantities.
                </p>
              </div>
              {canEdit ? (
                <Button
                  variant="secondary"
                  onClick={() => void addItem()}
                  disabled={saving}
                >
                  Add item
                </Button>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-md border border-neutral-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
                  <tr>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Notes</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-t border-neutral-200">
                      <td className="px-3 py-2">
                        <input
                          className="w-56 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
                          value={it.wig_type}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((p) =>
                                p.id === it.id
                                  ? { ...p, wig_type: e.target.value }
                                  : p,
                              ),
                            )
                          }
                          onBlur={() =>
                            void updateItem(it.id, { wig_type: it.wig_type })
                          }
                          disabled={!canEdit || saving}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          className="w-24 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
                          value={it.quantity}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((p) =>
                                p.id === it.id
                                  ? {
                                      ...p,
                                      quantity: Number(e.target.value || 1),
                                    }
                                  : p,
                              ),
                            )
                          }
                          onBlur={() =>
                            void updateItem(it.id, { quantity: it.quantity })
                          }
                          disabled={!canEdit || saving}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="w-full min-w-56 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
                          value={it.notes ?? ""}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((p) =>
                                p.id === it.id
                                  ? { ...p, notes: e.target.value }
                                  : p,
                              ),
                            )
                          }
                          onBlur={() =>
                            void updateItem(it.id, {
                              notes: (it.notes ?? "").trim() || null,
                            })
                          }
                          disabled={!canEdit || saving}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        {canEdit ? (
                          <Button
                            variant="secondary"
                            onClick={() => void deleteItem(it.id)}
                            disabled={saving}
                          >
                            Delete
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-sm text-neutral-600"
                        colSpan={4}
                      >
                        No items.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {isNew ? (
              <div className="text-xs text-neutral-600">
                Save the delivery to manage items.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
