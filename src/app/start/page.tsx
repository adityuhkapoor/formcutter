'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/provider'
import { LanguagePicker } from '@/components/LanguagePicker'
import { FORM_REGISTRY, type FormId } from '@/lib/forms'
import {
  IMMIGRATION_STATUS_OPTIONS,
  ENTRY_METHOD_OPTIONS,
  FAMILY_OPTIONS,
  REMOVAL_OPTIONS,
  GOAL_OPTIONS,
  type WizardAnswers,
  type WizardResult,
  type ReliefVerdict,
} from '@/lib/eligibility-types'

type Step = 'status' | 'entry' | 'entryDate' | 'family' | 'removal' | 'goal'

const STEPS: Step[] = ['status', 'entry', 'entryDate', 'family', 'removal', 'goal']

export default function StartPage() {
  const { t, lang } = useI18n()
  const [step, setStep] = useState<Step>('status')
  const [answers, setAnswers] = useState<Partial<WizardAnswers>>({ family: [] })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<WizardResult | null>(null)

  const idx = STEPS.indexOf(step)
  const isLast = idx === STEPS.length - 1
  const isFirst = idx === 0

  async function finish() {
    setLoading(true)
    try {
      const r = await fetch('/api/eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, language: lang }),
      })
      const data = await r.json()
      if (r.ok && data.result) setResult(data.result)
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return <ResultsPage result={result} />
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <Link href="/fill" className="text-lg font-semibold tracking-tight">
            {t('header.brand')}
          </Link>
          <div className="flex items-center gap-3">
            <LanguagePicker />
            <Link
              href="/fill"
              className="rounded-lg border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              {t('wizard.bypass')}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{t('wizard.heading')}</h1>
        <p className="mt-2 text-sm text-neutral-600">{t('wizard.subheading')}</p>

        {/* Progress dots */}
        <div className="mt-6 flex gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= idx ? 'bg-neutral-900' : 'bg-neutral-200'
              }`}
            />
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6">
          {step === 'status' && (
            <QuestionRadio
              questionKey="wizard.q.status"
              value={answers.status}
              options={IMMIGRATION_STATUS_OPTIONS}
              onChange={(v) => setAnswers((a) => ({ ...a, status: v }))}
            />
          )}
          {step === 'entry' && (
            <QuestionRadio
              questionKey="wizard.q.entry"
              value={answers.entry}
              options={ENTRY_METHOD_OPTIONS}
              onChange={(v) => setAnswers((a) => ({ ...a, entry: v }))}
            />
          )}
          {step === 'entryDate' && (
            <QuestionDate
              questionKey="wizard.q.entryDate"
              value={answers.entryDate}
              onChange={(v) => setAnswers((a) => ({ ...a, entryDate: v }))}
            />
          )}
          {step === 'family' && (
            <QuestionCheckboxes
              questionKey="wizard.q.family"
              values={answers.family ?? []}
              options={FAMILY_OPTIONS}
              onChange={(v) => setAnswers((a) => ({ ...a, family: v }))}
            />
          )}
          {step === 'removal' && (
            <QuestionRadio
              questionKey="wizard.q.removal"
              value={answers.removal}
              options={REMOVAL_OPTIONS}
              onChange={(v) => setAnswers((a) => ({ ...a, removal: v }))}
            />
          )}
          {step === 'goal' && (
            <QuestionRadio
              questionKey="wizard.q.goal"
              value={answers.goal}
              options={GOAL_OPTIONS}
              onChange={(v) => setAnswers((a) => ({ ...a, goal: v }))}
            />
          )}
        </div>

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            disabled={isFirst || loading}
            onClick={() => setStep(STEPS[Math.max(0, idx - 1)])}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            {t('wizard.back')}
          </button>
          {isLast ? (
            <button
              type="button"
              disabled={loading || !canProceed(step, answers)}
              onClick={finish}
              className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {loading ? '…' : t('wizard.finish')}
            </button>
          ) : (
            <button
              type="button"
              disabled={!canProceed(step, answers)}
              onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, idx + 1)])}
              className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {t('wizard.continue')}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

function canProceed(step: Step, answers: Partial<WizardAnswers>): boolean {
  switch (step) {
    case 'status':
      return Boolean(answers.status)
    case 'entry':
      return Boolean(answers.entry)
    case 'entryDate':
      return true // optional
    case 'family':
      return (answers.family ?? []).length > 0
    case 'removal':
      return Boolean(answers.removal)
    case 'goal':
      return Boolean(answers.goal)
  }
}

function QuestionRadio<V extends string>({
  questionKey,
  value,
  options,
  onChange,
}: {
  questionKey: string
  value: string | undefined
  options: readonly { value: V; label: string; emoji?: string }[]
  onChange: (v: V) => void
}) {
  const { t } = useI18n()
  return (
    <fieldset>
      <legend className="mb-4 text-base font-medium">
        {t(questionKey as Parameters<typeof t>[0])}
      </legend>
      <div className="space-y-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${
              value === o.value
                ? 'border-neutral-900 bg-neutral-50'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <input
              type="radio"
              name="q"
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="h-4 w-4"
            />
            {o.emoji && <span className="text-lg leading-none">{o.emoji}</span>}
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function QuestionCheckboxes({
  questionKey,
  values,
  options,
  onChange,
}: {
  questionKey: string
  values: string[]
  options: readonly { value: string; label: string; emoji?: string }[]
  onChange: (v: string[]) => void
}) {
  const { t } = useI18n()
  function toggle(v: string) {
    if (values.includes(v)) onChange(values.filter((x) => x !== v))
    else onChange([...values, v])
  }
  return (
    <fieldset>
      <legend className="mb-4 text-base font-medium">
        {t(questionKey as Parameters<typeof t>[0])}
      </legend>
      <div className="space-y-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${
              values.includes(o.value)
                ? 'border-neutral-900 bg-neutral-50'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <input
              type="checkbox"
              checked={values.includes(o.value)}
              onChange={() => toggle(o.value)}
              className="h-4 w-4"
            />
            {o.emoji && <span className="text-lg leading-none">{o.emoji}</span>}
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function QuestionDate({
  questionKey,
  value,
  onChange,
}: {
  questionKey: string
  value: string | undefined
  onChange: (v: string | undefined) => void
}) {
  const { t } = useI18n()
  return (
    <fieldset>
      <legend className="mb-4 text-base font-medium">
        {t(questionKey as Parameters<typeof t>[0])}
      </legend>
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
      />
    </fieldset>
  )
}

// ─── Results ────────────────────────────────────────────────────────────

/** Normalize various USCIS form references ("I-864", "i-864", "Form I-864")
 * into our FormId lowercase kebab-case id. Returns null if unrecognizable. */
function normalizeFormId(raw: string): FormId | null {
  const m = raw.match(/([iI]-?\d{3,4}[a-zA-Z]?|[nN]-?\d{3})/)
  if (!m) return null
  const normalized = m[1].toLowerCase().replace(/^([in])/, '$1-').replace(/^([in])-+/, '$1-')
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
 * meaningfully better than the runner-up: verdict must be "likely", and
 * either no second exists or the second is strictly weaker. */
function deservesBestMatch(
  top: WizardResult['recommendations'][number],
  second: WizardResult['recommendations'][number] | undefined,
): boolean {
  if (top.verdict !== 'likely') return false
  if (!second) return true
  return second.verdict === 'possibly' || second.verdict === 'unlikely' || second.verdict === 'not-eligible'
}

function ResultsPage({ result }: { result: WizardResult }) {
  const { t } = useI18n()
  const top3 = result.recommendations.slice(0, 3)
  const showBestMatch = top3.length > 0 && deservesBestMatch(top3[0], top3[1])

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/fill" className="text-lg font-semibold tracking-tight">
            {t('header.brand')}
          </Link>
          <LanguagePicker />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Your options</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Based on what you shared, here are the paths most worth considering.
        </p>

        {result.urgentDeadlines && result.urgentDeadlines.length > 0 && (
          <div className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4">
            <h2 className="text-sm font-semibold text-red-900">⚠ Time-sensitive</h2>
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

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {top3.map((r, idx) => (
            <OptionCard
              key={r.id}
              rec={r}
              isBestMatch={idx === 0 && showBestMatch}
            />
          ))}
        </div>

        {/* Full-width escape hatch — accredited legal help for anyone whose
         * situation doesn't match the suggestions above. */}
        <a
          href="https://www.cliniclegal.org/find-help"
          target="_blank"
          rel="noreferrer noopener"
          className="mt-6 flex w-full items-center justify-between rounded-2xl border border-neutral-300 bg-white px-6 py-5 transition-colors hover:border-neutral-900 hover:bg-neutral-50"
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

        <p className="mt-8 text-xs italic text-neutral-500">{result.disclaimer}</p>
      </main>
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
            Evidence you'll need
          </div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-neutral-700">
            {rec.evidenceNeeded.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs italic text-neutral-500">{rec.reasoning}</p>

      <div className="mt-4 text-xs font-medium text-neutral-800">
        Next step: {rec.nextStep}
      </div>

      {/* Pin the primary CTA to the bottom so all 3 cards align. */}
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
