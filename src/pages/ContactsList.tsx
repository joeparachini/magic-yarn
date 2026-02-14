import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button } from "../components/ui/button";
import { supabase } from "../lib/supabaseClient";

type ContactRow = {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  updated_at: string;
  organizations?: { name: string } | null;
};

export function ContactsList() {
  const { role } = useAuth();
  const canEdit = role === "admin" || role === "contacts_manager";
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const query = searchParams.get("q") ?? "";
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

    const { data, error } = await supabase
      .from("contacts")
      .select(
        "id, organization_id, first_name, last_name, email, phone, job_title, updated_at, organizations(name)",
      )
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

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
      return {
        ...row,
        organizations: org ? { name: org.name as string } : null,
      };
    });

    setRows(normalized as unknown as ContactRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const org = r.organizations?.name ?? "";
      const haystack =
        `${r.first_name} ${r.last_name} ${r.email ?? ""} ${r.phone ?? ""} ${org}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query]);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            People at organizations you deliver to.
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
            <Link to={listSearch ? `/contacts/new?${listSearch}` : "/contacts/new"}>
              <Button>New contact</Button>
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          className="w-full max-w-md rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          placeholder="Search contacts…"
          value={query}
          onChange={(e) => updateQueryParam(e.target.value)}
        />
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
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Organization</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Updated</th>
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
                      to={
                        listSearch
                          ? `/contacts/${r.id}?${listSearch}`
                          : `/contacts/${r.id}`
                      }
                    >
                      {r.last_name}, {r.first_name}
                    </Link>
                    {r.job_title ? (
                      <div className="text-xs text-muted-foreground">
                        {r.job_title}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{r.organizations?.name ?? "—"}</td>
                  <td className="px-3 py-2">{r.email ?? "—"}</td>
                  <td className="px-3 py-2">{r.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(r.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-sm text-muted-foreground"
                    colSpan={5}
                  >
                    No contacts found.
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
