'use client'

import { useState } from 'react'
import type { FormId } from '@/lib/forms'

/**
 * End-of-fill card shown in the left sidebar of /fill when the applicant has
 * entered enough data to finish. Two CTAs: free PDF download vs optional
 * accredited-rep review. Hello-Divorce-style a la carte framing — the user
 * always gets their form, review is the premium layer.
 */
export function CompleteCaseCard({
  caseId,
  formId,
  state,
  canSubmit,
  onSubmitted,
}: {
  caseId: string | null
  formId: FormId
  state: Record<string, unknown>
  /** Has the user filled enough to reasonably finish? */
  canSubmit: boolean
  /** Called after a successful rep-review submit (so parent can flip case status). */
  onSubmitted: () => void
}) {
  const [downloading, setDownloading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function downloadPdf() {
    setDownloading(true)
    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, formId }),
      })
      if (!res.ok) {
        alert('Download failed. Check server logs.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${formId}-filled.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  async function submitForReview() {
    if (!caseId) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/case/${caseId}/submit`, { method: 'POST' })
      if (r.ok) {
        onSubmitted()
      } else {
        alert('Submit failed. Check server logs.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const canAct = Boolean(caseId) && canSubmit

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold">You&apos;re done — how do you want to finish?</h2>
      <p className="mt-1 text-xs text-neutral-600">
        Your form is ready. Download it and file yourself, or have an accredited representative
        review it first.
      </p>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          disabled={!canAct || downloading}
          onClick={downloadPdf}
          className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {downloading ? 'Preparing PDF…' : `Download ${formId.toUpperCase()} PDF`}
        </button>

        <button
          type="button"
          disabled={!canAct || submitting}
          onClick={submitForReview}
          className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:border-neutral-900 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit for accredited review'}
          <span className="ml-1 text-xs font-normal text-neutral-500">
            · typical turnaround 48h
          </span>
        </button>
      </div>

      {!canSubmit && (
        <p className="mt-2 text-[11px] italic text-neutral-500">
          Keep answering a few more questions to unlock these.
        </p>
      )}
    </div>
  )
}
