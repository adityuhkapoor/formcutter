'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type CaseListItem = {
  id: string
  status: 'drafting' | 'pending_review' | 'approved' | 'released'
  formType: string
  displayName: string | null
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  approvedAt: string | null
  flagCount: number
}

const STATUS_LABEL = {
  drafting: { label: 'Drafting', cls: 'bg-neutral-100 text-neutral-700' },
  pending_review: { label: 'Pending review', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-800' },
  released: { label: 'Released', cls: 'bg-emerald-100 text-emerald-800' },
} as const

export default function CasesPage() {
  const [cases, setCases] = useState<CaseListItem[] | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const r = await fetch('/api/case')
      if (!r.ok) return
      const data = await r.json()
      if (!cancelled) setCases(data.cases ?? [])
    }
    load()
    const t = setInterval(load, 3000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  const pending = cases?.filter((c) => c.status === 'pending_review') ?? []
  const others = cases?.filter((c) => c.status !== 'pending_review') ?? []

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Case queue</h1>
          <p className="mt-1 text-sm text-slate-600">
            Submitted I-864 cases awaiting your review.
          </p>
        </div>
        <div className="flex gap-4 text-xs text-slate-600">
          <span>
            Pending: <span className="font-semibold text-amber-700">{pending.length}</span>
          </span>
          <span>
            Total: <span className="font-semibold">{cases?.length ?? 0}</span>
          </span>
        </div>
      </div>

      {cases === null ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading cases...
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          No cases yet. Cases appear here once a sponsor submits for review.
        </div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && <CaseTable heading="Awaiting your review" rows={pending} />}
          {others.length > 0 && <CaseTable heading="Earlier cases" rows={others} />}
        </div>
      )}
    </main>
  )
}

function CaseTable({ heading, rows }: { heading: string; rows: CaseListItem[] }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {heading}
      </h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-4 py-3">Sponsor</th>
              <th className="px-4 py-3">Form</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Flags</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => {
              const s = STATUS_LABEL[c.status]
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{c.displayName ?? <em className="text-slate-400">(unnamed)</em>}</td>
                  <td className="px-4 py-3 uppercase text-slate-500">{c.formType}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${s.cls}`}>
                      {s.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.flagCount > 0 ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                        {c.flagCount} pending
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {c.submittedAt ? new Date(c.submittedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/rep/cases/${c.id}`}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-900 hover:bg-slate-100"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
