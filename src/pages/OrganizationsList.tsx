import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/ui/button'
import { supabase } from '../lib/supabaseClient'

type OrganizationType = 'hospital' | 'clinic' | 'cancer_center' | 'other'

type OrganizationRow = {
  id: string
  name: string
  type: OrganizationType
  city: string | null
  state: string | null
  updated_at: string
}

export function OrganizationsList() {
  const { role } = useAuth()
  const canEdit = role === 'admin' || role === 'contacts_manager'

  const [rows, setRows] = useState<OrganizationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const load = async () => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, type, city, state, updated_at')
      .order('name', { ascending: true })

    if (error) {
      setError(error.message)
      setRows([])
      setLoading(false)
      return
    }

    setRows((data ?? []) as OrganizationRow[])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const haystack = `${r.name} ${r.city ?? ''} ${r.state ?? ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [rows, query])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Organizations</h1>
          <p className="text-sm text-neutral-600">Hospitals, clinics, and other delivery destinations.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
          {canEdit ? (
            <Link to="/organizations/new">
              <Button>New organization</Button>
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          className="w-full max-w-md rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          placeholder="Search organizations…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="text-xs text-neutral-600">{filtered.length} shown</div>
      </div>

      {loading ? (
        <div className="text-sm text-neutral-600">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-neutral-200">
                  <td className="px-3 py-2">
                    <Link className="font-medium underline" to={`/organizations/${r.id}`}>
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.type}</td>
                  <td className="px-3 py-2">{[r.city, r.state].filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-3 py-2 text-neutral-600">
                    {new Date(r.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-neutral-600" colSpan={4}>
                    No organizations found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
