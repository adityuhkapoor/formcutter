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
  filledCount,
  threshold,
  onSubmitted,
}: {
  caseId: string | null
  formId: FormId
  state: Record<string, unknown>
  /** Has the user filled enough to reasonably finish? */
  canSubmit: boolean
  /** Number of fields filled so far. Drives the locked-state progress hint. */
  filledCount: number
  /** Threshold above which canSubmit flips true. */
  threshold: number
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
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-neutral-500">
            <span>Keep answering a few more questions to unlock these.</span>
            <span className="font-mono text-neutral-700">
              {Math.min(filledCount, threshold)}/{threshold}
            </span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full bg-neutral-900 transition-all"
              style={{
                width: `${Math.min(100, Math.round((filledCount / threshold) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
