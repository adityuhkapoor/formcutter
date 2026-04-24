'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'

type FlagRow = {
  id: string
  caseId: string
  kind: string
  severity: 'info' | 'warn' | 'error'
  title: string
  detail: string
  llmReasoning: string | null
  suggestedFieldPath: string | null
  status: 'pending' | 'approved' | 'dismissed' | 'edited'
  resolvedAt: string | null
  resolvedNote: string | null
  createdAt: string
}

type CaseRow = {
  id: string
  status: 'drafting' | 'pending_review' | 'approved' | 'released'
  state: Record<string, unknown>
  formType: string
  displayName: string | null
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  approvedAt: string | null
}

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [caseData, setCaseData] = useState<CaseRow | null>(null)
  const [flags, setFlags] = useState<FlagRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const r = await fetch(`/api/case/${id}`)
    if (!r.ok) return
    const data = await r.json()
    setCaseData(data.case)
    setFlags(data.flags ?? [])
  }

  useEffect(() => {
    load()
    // Lighter poll here — rep is actively viewing this case, state updates
    // matter less than on the queue page
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function resolveFlag(flagId: string, status: 'approved' | 'dismissed') {
    setBusy(true)
    try {
      const r = await fetch(`/api/case/${id}/flags/${flagId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (r.ok) await load()
    } finally {
      setBusy(false)
    }
  }

  async function releaseCase() {
    setError(null)
    setBusy(true)
    try {
      const r = await fetch(`/api/case/${id}/release`, { method: 'POST' })
      const data = await r.json()
      if (!r.ok) {
        setError(data.error ?? 'release_failed')
      } else {
        await load()
      }
    } finally {
      setBusy(false)
    }
  }

  if (!caseData || !flags) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-6 text-sm text-slate-500">
        Loading case...
      </main>
    )
  }

  const pendingFlags = flags.filter((f) => f.status === 'pending')
  const resolvedFlags = flags.filter((f) => f.status !== 'pending')
  const allResolved = pendingFlags.length === 0

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
        <Link href="/rep/cases" className="hover:text-slate-900">
          ← Cases
        </Link>
        <span>/</span>
        <span className="font-mono text-[11px]">{caseData.id.slice(0, 8)}</span>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {caseData.displayName ?? <em className="text-slate-400">(unnamed sponsor)</em>}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
            <span className="uppercase">{caseData.formType}</span>
            <span>·</span>
            <span>Submitted {caseData.submittedAt ? new Date(caseData.submittedAt).toLocaleString() : '—'}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              caseData.status === 'approved'
                ? 'bg-emerald-100 text-emerald-800'
                : caseData.status === 'pending_review'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-neutral-100 text-neutral-700'
            }`}
          >
            {caseData.status.replace('_', ' ')}
          </span>
          {caseData.status === 'pending_review' && (
            <button
              type="button"
              disabled={busy || !allResolved}
              onClick={releaseCase}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                allResolved
                  ? 'bg-emerald-700 hover:bg-emerald-800'
                  : 'cursor-not-allowed bg-neutral-300'
              }`}
            >
              {busy ? 'Working...' : allResolved ? 'Release PDF to sponsor' : `Resolve ${pendingFlags.length} flag${pendingFlags.length === 1 ? '' : 's'} first`}
            </button>
          )}
          {error && (
            <span className="text-xs text-red-600">
              Error: {error}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
        {/* Flag review panel */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Review queue ({pendingFlags.length} pending · {resolvedFlags.length} resolved)
          </h2>
          {pendingFlags.length === 0 && resolvedFlags.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No flags — case looks clean.
            </div>
          )}
          <div className="space-y-3">
            {pendingFlags.map((f) => (
              <FlagCard
                key={f.id}
                flag={f}
                busy={busy}
                onApprove={() => resolveFlag(f.id, 'approved')}
                onDismiss={() => resolveFlag(f.id, 'dismissed')}
              />
            ))}
            {resolvedFlags.length > 0 && (
              <details className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
                <summary className="cursor-pointer font-medium">
                  {resolvedFlags.length} resolved
                </summary>
                <div className="mt-2 space-y-2">
                  {resolvedFlags.map((f) => (
                    <div key={f.id} className="border-t border-slate-100 pt-2">
                      <span
                        className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                          f.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {f.status}
                      </span>
                      {f.title}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </section>

        {/* State inspection */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Submitted form state
            </h3>
            <pre className="max-h-[500px] overflow-auto rounded-md bg-slate-50 p-2 text-[11px] leading-snug text-slate-700">
              {JSON.stringify(caseData.state, null, 2)}
            </pre>
          </div>
        </aside>
      </div>
    </main>
  )
}

function FlagCard({
  flag,
  busy,
  onApprove,
  onDismiss,
}: {
  flag: FlagRow
  busy: boolean
  onApprove: () => void
  onDismiss: () => void
}) {
  const severityStyle = {
    error: 'border-red-300 bg-red-50',
    warn: 'border-amber-300 bg-amber-50',
    info: 'border-slate-300 bg-slate-50',
  }[flag.severity]

  const severityDot = {
    error: 'bg-red-500',
    warn: 'bg-amber-500',
    info: 'bg-slate-400',
  }[flag.severity]

  return (
    <div className={`rounded-xl border p-4 ${severityStyle}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${severityDot}`} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {flag.kind.replace(/_/g, ' ')}
            </span>
          </div>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">{flag.title}</h3>
          <p className="mt-1 text-sm text-slate-700">{flag.detail}</p>
          {flag.llmReasoning && (
            <details className="mt-2 text-xs text-slate-500">
              <summary className="cursor-pointer">Why this was flagged</summary>
              <p className="mt-1 rounded border border-slate-200 bg-white p-2">{flag.llmReasoning}</p>
            </details>
          )}
          {flag.suggestedFieldPath && (
            <p className="mt-2 font-mono text-[10px] text-slate-500">
              field: {flag.suggestedFieldPath}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onApprove}
              className="rounded border border-emerald-600 bg-white px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onDismiss}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
