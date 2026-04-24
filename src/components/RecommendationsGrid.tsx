'use client'

import Link from 'next/link'
import { FORM_REGISTRY, type FormId } from '@/lib/forms'
import type { WizardResult, ReliefVerdict } from '@/lib/eligibility-types'

/** Normalize USCIS form references ("I-864", "i-864", "Form I-864") into our
 * FormId lowercase kebab-case id. Returns null if unrecognizable or outside
 * the registry. */
export function normalizeFormId(raw: string): FormId | null {
  const m = raw.match(/([iI]-?\d{3,4}[a-zA-Z]?|[nN]-?\d{3})/)
  if (!m) return null
  const normalized = m[1]
    .toLowerCase()
    .replace(/^([in])/, '$1-')
    .replace(/^([in])-+/, '$1-')
  const candidates: FormId[] = ['i-864', 'i-130', 'i-485', 'n-400', 'i-589', 'i-765', 'i-821', 'i-102']
  return candidates.find((c) => c === normalized) ?? null
}

const VERDICT_STYLE: Record<ReliefVerdict, { label: string; cls: string }> = {
  likely: { label: 'Likely eligible', cls: 'bg-emerald-100 text-emerald-800' },
  possibly: { label: 'Possibly eligible', cls: 'bg-amber-100 text-amber-800' },
  unlikely: { label: 'Unlikely', cls: 'bg-neutral-200 text-neutral-700' },
  'not-eligible': { label: 'Not eligible', cls: 'bg-red-100 text-red-800' },
}

/** A top recommendation earns the "Best match" highlight only when it's
 * meaningfully better than the runner-up: verdict must be "likely", and the
 * second recommendation must be strictly weaker (or not exist). */
export function deservesBestMatch(
  top: WizardResult['recommendations'][number],
  second: WizardResult['recommendations'][number] | undefined,
): boolean {
  if (top.verdict !== 'likely') return false
  if (!second) return true
  return second.verdict === 'possibly' || second.verdict === 'unlikely' || second.verdict === 'not-eligible'
}

export function RecommendationsGrid({ result }: { result: WizardResult }) {
  const top3 = result.recommendations.slice(0, 3)
  const showBestMatch = top3.length > 0 && deservesBestMatch(top3[0], top3[1])

  return (
    <div>
      {result.urgentDeadlines && result.urgentDeadlines.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4">
          <h3 className="text-sm font-semibold text-red-900">⚠ Time-sensitive</h3>
          <ul className="mt-2 space-y-1 text-sm text-red-800">
            {result.urgentDeadlines.map((d, i) => (
              <li key={i} className="flex items-center justify-between">
                <span>{d.label}</span>
                <span className="font-mono text-xs">
                  {d.daysRemaining} days · due {d.byDate}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {top3.map((r, idx) => (
          <OptionCard key={r.id} rec={r} isBestMatch={idx === 0 && showBestMatch} />
        ))}
      </div>

      <a
        href="https://www.cliniclegal.org/find-help"
        target="_blank"
        rel="noreferrer noopener"
        className="mt-4 flex w-full items-center justify-between rounded-2xl border border-neutral-300 bg-white px-6 py-5 transition-colors hover:border-neutral-900 hover:bg-neutral-50"
      >
        <div>
          <div className="text-sm font-semibold text-neutral-900">
            None of these fit? Speak to a DOJ-accredited legal representative.
          </div>
          <div className="mt-0.5 text-xs text-neutral-600">
            Free or low-cost help near you, searchable by ZIP code and language.
          </div>
        </div>
        <span className="shrink-0 text-sm font-medium text-neutral-900">Find help →</span>
      </a>

      {result.disclaimer && (
        <p className="mt-4 text-xs italic text-neutral-500">{result.disclaimer}</p>
      )}
    </div>
  )
}

function OptionCard({
  rec,
  isBestMatch,
}: {
  rec: WizardResult['recommendations'][number]
  isBestMatch: boolean
}) {
  const v = VERDICT_STYLE[rec.verdict]
  const primaryRawForm = rec.forms[0]
  const primaryFormId = primaryRawForm ? normalizeFormId(primaryRawForm) : null
  const primarySupported = Boolean(primaryFormId && FORM_REGISTRY[primaryFormId])

  return (
    <div
      className={`relative flex flex-col rounded-xl border bg-white p-5 ${
        isBestMatch ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-neutral-200'
      }`}
    >
      {isBestMatch && (
        <div className="absolute -top-2.5 left-4 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Best match
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold">{rec.relief}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${v.cls}`}
        >
          {v.label}
        </span>
      </div>

      <p className="mt-2 text-sm text-neutral-600">{rec.summary}</p>

      {rec.forms.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rec.forms.map((f) => (
            <span
              key={f}
              className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-mono text-[11px]"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      {rec.deadlines && rec.deadlines.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {rec.deadlines.map((d, i) => (
            <li
              key={i}
              className={
                d.severity === 'critical'
                  ? 'text-red-700'
                  : d.severity === 'warn'
                    ? 'text-amber-700'
                    : 'text-neutral-600'
              }
            >
              • {d.label}
              {d.daysRemaining !== undefined && ` — ${d.daysRemaining} days`}
            </li>
          ))}
        </ul>
      )}

      {rec.evidenceNeeded.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
            Evidence you&apos;ll need
          </div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-neutral-700">
            {rec.evidenceNeeded.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs italic text-neutral-500">{rec.reasoning}</p>

      <div className="mt-4 text-xs font-medium text-neutral-800">Next step: {rec.nextStep}</div>

      <div className="mt-4 flex-grow" />
      <div className="mt-2">
        {primarySupported && primaryFormId ? (
          <Link
            href={`/fill?formId=${primaryFormId}`}
            className={`block w-full rounded-lg px-3 py-2 text-center text-sm font-medium text-white ${
              isBestMatch ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-neutral-900 hover:bg-neutral-800'
            }`}
          >
            Start {primaryRawForm} →
          </Link>
        ) : (
          <span
            className="block w-full rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-center text-sm font-medium text-neutral-500"
            title="This form isn't supported yet. Consult an accredited rep or attorney."
          >
            {primaryRawForm ?? 'No form'} · not yet supported
          </span>
        )}
      </div>
    </div>
  )
}
