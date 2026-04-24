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

type QuestionHelpItem = {
  flagId: string
  caseId: string
  formType: string
  displayName: string | null
  caseStatus: string
  flagTitle: string
  flagDetail: string
  flagCreatedAt: string
  suggestedFieldPath: string | null
}

const STATUS_LABEL = {
  drafting: { label: 'Drafting', cls: 'bg-neutral-100 text-neutral-700' },
  pending_review: { label: 'Pending review', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-800' },
  released: { label: 'Released', cls: 'bg-emerald-100 text-emerald-800' },
} as const

export default function CasesPage() {
  const [cases, setCases] = useState<CaseListItem[] | null>(null)
  const [questionHelp, setQuestionHelp] = useState<QuestionHelpItem[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [caseRes, qhRes] = await Promise.all([
        fetch('/api/case'),
        fetch('/api/rep/question-help'),
      ])
      if (!cancelled && caseRes.ok) {
        const data = await caseRes.json()
        setCases(data.cases ?? [])
      }
      if (!cancelled && qhRes.ok) {
        const data = await qhRes.json()
        setQuestionHelp(data.items ?? [])
      }
    }
    load()
    const t = setInterval(load, 3000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  const pending = cases?.filter((c) => c.status === 'pending_review') ?? []
  // Drafting cases do NOT belong in the rep queue — they're still being filled.
  // Approved and released are history.
  const done = cases?.filter((c) => c.status === 'approved' || c.status === 'released') ?? []

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Case queue</h1>
          <p className="mt-1 text-sm text-slate-600">
            Cases awaiting review + in-flight question-help requests.
          </p>
        </div>
        <div className="flex gap-4 text-xs text-slate-600">
          <span>
            Pending cases: <span className="font-semibold text-amber-700">{pending.length}</span>
          </span>
          <span>
            Question help: <span className="font-semibold text-blue-700">{questionHelp.length}</span>
          </span>
        </div>
      </div>

      {cases === null ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading cases...
        </div>
      ) : (
        <div className="space-y-6">
          {questionHelp.length > 0 && <QuestionHelpTable rows={questionHelp} />}
          {pending.length > 0 && <CaseTable heading="Cases awaiting full review" rows={pending} />}
          {done.length > 0 && <CaseTable heading="Approved / released" rows={done} />}
          {questionHelp.length === 0 && pending.length === 0 && done.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
              No cases yet. Cases appear here once a sponsor submits for review or asks for help on a specific question.
            </div>
          )}
        </div>
      )}
    </main>
  )
}

function QuestionHelpTable({ rows }: { rows: QuestionHelpItem[] }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        🙋 In-flight question help ({rows.length})
      </h2>
      <div className="overflow-hidden rounded-xl border border-blue-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-blue-50 text-left text-xs font-semibold uppercase tracking-wider text-blue-800">
            <tr>
              <th className="px-4 py-3">Sponsor</th>
              <th className="px-4 py-3">Form</th>
              <th className="px-4 py-3">Question</th>
              <th className="px-4 py-3">Asked</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.flagId} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">
                  {r.displayName ?? <em className="text-slate-400">(unnamed)</em>}
                </td>
                <td className="px-4 py-3 uppercase text-slate-500">{r.formType}</td>
                <td className="max-w-md truncate px-4 py-3 text-slate-700">{r.flagDetail.split('\n')[0]}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {new Date(r.flagCreatedAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/rep/cases/${r.caseId}`}
                    className="rounded-lg border border-blue-300 bg-white px-3 py-1 text-xs font-medium text-blue-700 hover:border-blue-900 hover:bg-blue-50"
                  >
                    Answer →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
