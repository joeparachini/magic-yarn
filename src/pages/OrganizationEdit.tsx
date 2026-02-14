import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import type { Role } from "../auth/types";
import { Button } from "../components/ui/button";
import { supabase } from "../lib/supabaseClient";

type AssociatedContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  updated_at: string;
};

type DeliveryStatus = "pending" | "scheduled" | "completed" | "cancelled";

type AssociatedDeliveryRow = {
  id: string;
  delivery_date: string | null;
  status: DeliveryStatus;
  updated_at: string;
  contacts?: { first_name: string; last_name: string } | null;
  user_profiles?: { full_name: string | null } | null;
};

type OrganizationType = "hospital" | "clinic" | "cancer_center" | "other";

type OrganizationFormState = {
  name: string;
  type: OrganizationType;
  region_code: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  notes: string;
};

type RegionOption = {
  code: string;
  name: string;
  sort_order: number;
};

const organizationTypes: OrganizationType[] = [
  "hospital",
  "clinic",
  "cancer_center",
  "other",
];

function emptyForm(): OrganizationFormState {
  return {
    name: "",
    type: "hospital",
    region_code: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    email: "",
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

export function OrganizationEdit() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();

  const canEdit = role === "admin" || role === "contacts_manager";
  const canDelete = role === "admin";
  const canViewContacts = role === "admin" || role === "contacts_manager";
  const canCreateDeliveries = canEditDeliveries(role);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<OrganizationFormState>(emptyForm());
  const [regions, setRegions] = useState<RegionOption[]>([]);

  const [associatedContacts, setAssociatedContacts] = useState<
    AssociatedContactRow[]
  >([]);
  const [associatedContactsLoading, setAssociatedContactsLoading] =
    useState(false);
  const [associatedContactsError, setAssociatedContactsError] = useState<
    string | null
  >(null);

  const [associatedDeliveries, setAssociatedDeliveries] = useState<
    AssociatedDeliveryRow[]
  >([]);
  const [associatedDeliveriesLoading, setAssociatedDeliveriesLoading] =
    useState(false);
  const [associatedDeliveriesError, setAssociatedDeliveriesError] = useState<
    string | null
  >(null);

  const title = useMemo(
    () => (isNew ? "New organization" : "Edit organization"),
    [isNew],
  );

  useEffect(() => {
    const loadRegions = async () => {
      const { data, error } = await supabase.rpc("list_regions");
      if (error) {
        setError(error.message);
        setRegions([]);
        return;
      }
      setRegions((data ?? []) as RegionOption[]);
    };

    void loadRegions();
  }, []);

  useEffect(() => {
    if (isNew) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("organizations")
        .select(
          "name, type, region_code, address, city, state, zip, phone, email, notes",
        )
        .eq("id", id)
        .maybeSingle();

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setError("Organization not found.");
        setLoading(false);
        return;
      }

      setForm({
        name: (data as any).name ?? "",
        type: (data as any).type ?? "hospital",
        region_code: (data as any).region_code ?? "",
        address: (data as any).address ?? "",
        city: (data as any).city ?? "",
        state: (data as any).state ?? "",
        zip: (data as any).zip ?? "",
        phone: (data as any).phone ?? "",
        email: (data as any).email ?? "",
        notes: (data as any).notes ?? "",
      });
      setLoading(false);
    };

    void load();
  }, [id, isNew]);

  const loadAssociatedContacts = async () => {
    if (!id) return;
    setAssociatedContactsLoading(true);
    setAssociatedContactsError(null);

    const { data, error } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone, job_title, updated_at")
      .eq("organization_id", id)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    if (error) {
      setAssociatedContactsError(error.message);
      setAssociatedContacts([]);
      setAssociatedContactsLoading(false);
      return;
    }

    setAssociatedContacts((data ?? []) as AssociatedContactRow[]);
    setAssociatedContactsLoading(false);
  };

  const loadAssociatedDeliveries = async () => {
    if (!id) return;
    setAssociatedDeliveriesLoading(true);
    setAssociatedDeliveriesError(null);

    const { data, error } = await supabase
      .from("deliveries")
      .select(
        "id, delivery_date, status, updated_at, contacts(first_name,last_name), user_profiles(full_name)",
      )
      .eq("organization_id", id)
      .order("delivery_date", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });

    if (error) {
      setAssociatedDeliveriesError(error.message);
      setAssociatedDeliveries([]);
      setAssociatedDeliveriesLoading(false);
      return;
    }

    const normalized = (data ?? []).map((row: any) => {
      const contact = Array.isArray(row.contacts)
        ? row.contacts[0]
        : row.contacts;
      const coordinator = Array.isArray(row.user_profiles)
        ? row.user_profiles[0]
        : row.user_profiles;

      return {
        ...row,
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

    setAssociatedDeliveries(normalized as unknown as AssociatedDeliveryRow[]);
    setAssociatedDeliveriesLoading(false);
  };

  useEffect(() => {
    if (isNew || !canViewContacts) return;
    void loadAssociatedContacts();
  }, [id, isNew, canViewContacts]);

  useEffect(() => {
    if (isNew) return;
    void loadAssociatedDeliveries();
  }, [id, isNew]);

  const update = (patch: Partial<OrganizationFormState>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    if (!canEdit) {
      setError("Not authorized to edit organizations.");
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
      region_code: form.region_code || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      zip: form.zip || null,
      phone: form.phone || null,
      email: form.email || null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };

    if (isNew) {
      const { data, error } = await supabase
        .from("organizations")
        .insert(payload)
        .select("id")
        .maybeSingle();

      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }

      const createdId = (data as any)?.id as string | undefined;
      navigate(createdId ? `/organizations/${createdId}` : "/organizations", {
        replace: true,
      });
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("organizations")
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
    const ok = window.confirm(
      "Delete this organization? This cannot be undone.",
    );
    if (!ok) return;

    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("organizations")
      .delete()
      .eq("id", id);
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    navigate("/organizations", { replace: true });
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            <Link className="underline" to={`/organizations${location.search}`}>
              Back to organizations
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
          You have view-only access to organizations.
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-foreground">
                Name
              </label>
              <input
                className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                disabled={!canEdit || saving}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-foreground">
                Type
              </label>
              <select
                className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={form.type}
                onChange={(e) =>
                  update({ type: e.target.value as OrganizationType })
                }
                disabled={!canEdit || saving}
              >
                {organizationTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-foreground">
                Region
              </label>
              <select
                className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={form.region_code}
                onChange={(e) => update({ region_code: e.target.value })}
                disabled={!canEdit || saving}
              >
                <option value="">Unassigned</option>
                {regions.map((region) => (
                  <option key={region.code} value={region.code}>
                    {region.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-xs font-medium text-foreground">
                Address
              </label>
              <input
                className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={form.address}
                onChange={(e) => update({ address: e.target.value })}
                disabled={!canEdit || saving}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-foreground">
                City
              </label>
              <input
                className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={form.city}
                onChange={(e) => update({ city: e.target.value })}
                disabled={!canEdit || saving}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-foreground">
                State
              </label>
              <input
                className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={form.state}
                onChange={(e) => update({ state: e.target.value })}
                disabled={!canEdit || saving}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-foreground">ZIP</label>
              <input
                className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={form.zip}
                onChange={(e) => update({ zip: e.target.value })}
                disabled={!canEdit || saving}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-foreground">
                Phone
              </label>
              <input
                className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={form.phone}
                onChange={(e) => update({ phone: e.target.value })}
                disabled={!canEdit || saving}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-foreground">
                Email
              </label>
              <input
                className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={form.email}
                onChange={(e) => update({ email: e.target.value })}
                disabled={!canEdit || saving}
              />
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-xs font-medium text-foreground">
                Notes
              </label>
              <textarea
                className="min-h-28 rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => update({ notes: e.target.value })}
                disabled={!canEdit || saving}
              />
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Associated contacts</h2>
                <p className="text-sm text-muted-foreground">
                  Contacts at this organization.
                </p>
              </div>
              {!isNew && canViewContacts ? (
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">
                    {associatedContacts.length} total
                  </div>
                  {canEdit ? (
                    <Link
                      to={`/contacts/new?organizationId=${encodeURIComponent(id)}`}
                    >
                      <Button size="sm">New contact</Button>
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>

            {!canViewContacts ? (
              <div className="rounded-md border border-border bg-muted/35 p-3 text-sm text-foreground">
                You don’t have access to view contacts.
              </div>
            ) : isNew ? (
              <div className="rounded-md border border-border bg-muted/35 p-3 text-sm text-foreground">
                Save this organization to see its contacts.
              </div>
            ) : associatedContactsError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {associatedContactsError}
              </div>
            ) : associatedContactsLoading ? (
              <div className="text-sm text-muted-foreground">
                Loading contacts…
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card/80">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted/35 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {associatedContacts.map((c) => (
                      <tr
                        key={c.id}
                        className="border-t border-border/80 hover:bg-muted/20"
                      >
                        <td className="px-3 py-2">
                          <Link
                            className="font-medium text-foreground underline decoration-muted-foreground/50 underline-offset-2"
                            to={`/contacts/${c.id}`}
                          >
                            {c.last_name}, {c.first_name}
                          </Link>
                          {c.job_title ? (
                            <div className="text-xs text-muted-foreground">
                              {c.job_title}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">{c.email ?? "—"}</td>
                        <td className="px-3 py-2">{c.phone ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(c.updated_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {associatedContacts.length === 0 ? (
                      <tr>
                        <td
                          className="px-3 py-6 text-center text-sm text-muted-foreground"
                          colSpan={4}
                        >
                          No contacts for this organization.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-col gap-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Associated deliveries</h2>
                <p className="text-sm text-muted-foreground">
                  Deliveries for this organization.
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
                Save this organization to see its deliveries.
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
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Contact</th>
                      <th className="px-3 py-2">Coordinator</th>
                      <th className="px-3 py-2">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {associatedDeliveries.map((d) => (
                      <tr
                        key={d.id}
                        className="border-t border-border/80 hover:bg-muted/20"
                      >
                        <td className="px-3 py-2">
                          <Link
                            className="font-medium text-foreground underline decoration-muted-foreground/50 underline-offset-2"
                            to={`/deliveries/${d.id}`}
                          >
                            {d.delivery_date
                              ? new Date(d.delivery_date).toLocaleDateString()
                              : "—"}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{d.status}</td>
                        <td className="px-3 py-2">
                          {d.contacts
                            ? `${d.contacts.last_name}, ${d.contacts.first_name}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {d.user_profiles?.full_name ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(d.updated_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {associatedDeliveries.length === 0 ? (
                      <tr>
                        <td
                          className="px-3 py-6 text-center text-sm text-muted-foreground"
                          colSpan={5}
                        >
                          No deliveries for this organization.
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
