import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/ui/button'
import { supabase } from '../lib/supabaseClient'

type OrgOption = { id: string; name: string }

type ContactFormState = {
  organization_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  job_title: string
  address: string
  city: string
  state: string
  zip: string
}

function emptyForm(): ContactFormState {
  return {
    organization_id: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    job_title: '',
    address: '',
    city: '',
    state: '',
    zip: '',
  }
}

export function ContactEdit() {
  const { id } = useParams()
  const isNew = !id
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { role } = useAuth()
  const preselectedOrganizationId = searchParams.get('organizationId')?.trim() ?? ''

  const canEdit = role === 'admin' || role === 'contacts_manager'
  const canDelete = role === 'admin'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [form, setForm] = useState<ContactFormState>(emptyForm())

  const title = useMemo(() => (isNew ? 'New contact' : 'Edit contact'), [isNew])

  const loadOrgs = async () => {
    const { data, error } = await supabase.from('organizations').select('id, name').order('name')
    if (error) {
      setError(error.message)
      setOrgs([])
      return
    }
    setOrgs((data ?? []) as OrgOption[])
  }

  useEffect(() => {
    void loadOrgs()
  }, [])

  useEffect(() => {
    if (!isNew || !preselectedOrganizationId || form.organization_id || orgs.length === 0) return

    if (orgs.some((o) => o.id === preselectedOrganizationId)) {
      setForm((prev) => ({ ...prev, organization_id: preselectedOrganizationId }))
    }
  }, [form.organization_id, isNew, orgs, preselectedOrganizationId])

  useEffect(() => {
    if (isNew) return
    const load = async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('contacts')
        .select('organization_id, first_name, last_name, email, phone, job_title, address, city, state, zip')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      if (!data) {
        setError('Contact not found.')
        setLoading(false)
        return
      }

      setForm({
        organization_id: (data as any).organization_id ?? '',
        first_name: (data as any).first_name ?? '',
        last_name: (data as any).last_name ?? '',
        email: (data as any).email ?? '',
        phone: (data as any).phone ?? '',
        job_title: (data as any).job_title ?? '',
        address: (data as any).address ?? '',
        city: (data as any).city ?? '',
        state: (data as any).state ?? '',
        zip: (data as any).zip ?? '',
      })
      setLoading(false)
    }
    void load()
  }, [id, isNew])

  const update = (patch: Partial<ContactFormState>) => setForm((prev) => ({ ...prev, ...patch }))

  const save = async () => {
    if (!canEdit) {
      setError('Not authorized to edit contacts.')
      return
    }
    if (!form.organization_id) {
      setError('Organization is required.')
      return
    }
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('First and last name are required.')
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      organization_id: form.organization_id,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      job_title: form.job_title.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      zip: form.zip.trim() || null,
      updated_at: new Date().toISOString(),
    }

    if (isNew) {
      const { data, error } = await supabase.from('contacts').insert(payload).select('id').maybeSingle()
      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
      const createdId = (data as any)?.id as string | undefined
      navigate(createdId ? `/contacts/${createdId}` : '/contacts', { replace: true })
      setSaving(false)
      return
    }

    const { error } = await supabase.from('contacts').update(payload).eq('id', id)
    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }
    setSaving(false)
  }

  const del = async () => {
    if (!canDelete || !id) return
    const ok = window.confirm('Delete this contact? This cannot be undone.')
    if (!ok) return

    setSaving(true)
    setError(null)
    const { error } = await supabase.from('contacts').delete().eq('id', id)
    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }
    navigate('/contacts', { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-neutral-600">
            <Link className="underline" to="/contacts">
              Back to contacts
            </Link>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && canDelete ? (
            <Button variant="secondary" onClick={() => void del()} disabled={saving}>
              Delete
            </Button>
          ) : null}
          <Button onClick={() => void save()} disabled={saving || loading || !canEdit}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {!canEdit ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          You have view-only access to contacts.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      ) : null}

      {loading ? (
        <div className="text-sm text-neutral-600">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="text-xs font-medium text-neutral-700">Organization</label>
            <select
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              value={form.organization_id}
              onChange={(e) => update({ organization_id: e.target.value })}
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

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-neutral-700">First name</label>
            <input
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              value={form.first_name}
              onChange={(e) => update({ first_name: e.target.value })}
              disabled={!canEdit || saving}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-neutral-700">Last name</label>
            <input
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              value={form.last_name}
              onChange={(e) => update({ last_name: e.target.value })}
              disabled={!canEdit || saving}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-neutral-700">Email</label>
            <input
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              value={form.email}
              onChange={(e) => update({ email: e.target.value })}
              disabled={!canEdit || saving}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-neutral-700">Phone</label>
            <input
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              value={form.phone}
              onChange={(e) => update({ phone: e.target.value })}
              disabled={!canEdit || saving}
            />
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="text-xs font-medium text-neutral-700">Job title</label>
            <input
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              value={form.job_title}
              onChange={(e) => update({ job_title: e.target.value })}
              disabled={!canEdit || saving}
            />
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="text-xs font-medium text-neutral-700">Address (optional)</label>
            <input
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              value={form.address}
              onChange={(e) => update({ address: e.target.value })}
              disabled={!canEdit || saving}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-neutral-700">City</label>
            <input
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              value={form.city}
              onChange={(e) => update({ city: e.target.value })}
              disabled={!canEdit || saving}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-neutral-700">State</label>
            <input
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              value={form.state}
              onChange={(e) => update({ state: e.target.value })}
              disabled={!canEdit || saving}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-neutral-700">ZIP</label>
            <input
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              value={form.zip}
              onChange={(e) => update({ zip: e.target.value })}
              disabled={!canEdit || saving}
            />
          </div>
        </div>
      )}
    </div>
  )
}
