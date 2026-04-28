'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/provider'
import type { EvidenceStatus } from '@/lib/evidence'

/**
 * Render the localized label for an evidence requirement. Falls back to the
 * hand-written English label if the i18n catalog has no entry — newer forms
 * (I-130/I-485/N-400/etc.) ship with English-only `evidence.<form>.*` keys
 * that the translator script will fill out post-demo. Without this fallback
 * the user sees the literal key string ("evidence.n400.greenCard").
 */
function labelOrFallback(
  t: ReturnType<typeof useI18n>['t'],
  key: string,
  fallback: string
): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out = t(key as any)
  return out === key ? fallback : out
}

const STATUS_STYLES: Record<EvidenceStatus['status'], { dot: string; text: string; bg: string }> = {
  met: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  partial: { dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' },
  stale: { dot: 'bg-amber-500', text: 'text-amber-800', bg: 'bg-amber-50' },
  missing: { dot: 'bg-neutral-300', text: 'text-neutral-500', bg: 'bg-neutral-50' },
}

const TIER_LABEL_KEY = {
  required: 'evidence.tier.required',
  recommended: 'evidence.tier.recommended',
  conditional: 'evidence.tier.conditional',
} as const

/** Status rank — higher = stronger. Used to detect "this just improved" so
 * we can pulse the dot. We treat any upward move (missing → partial → met,
 * or stale → met) as a celebratable change. */
const STATUS_RANK: Record<EvidenceStatus['status'], number> = {
  missing: 0,
  stale: 1,
  partial: 2,
  met: 3,
}

export function EvidenceChecklist({ items }: { items: EvidenceStatus[] }) {
  const { t } = useI18n()
  // Track previous status per requirement so we can pulse only the dots
  // whose status *just improved* on this render — the "AI figured it out"
  // moment. New items (no prior status) don't pulse to avoid first-paint noise.
  const prevStatusRef = useRef<Map<string, EvidenceStatus['status']>>(new Map())
  const prevMetCountRef = useRef<number>(0)
  const prevAllMetRef = useRef<boolean>(false)
  const [pulsing, setPulsing] = useState<Set<string>>(new Set())
  const [countPop, setCountPop] = useState(false)
  const [cardComplete, setCardComplete] = useState(false)

  const metCount = items.filter((i) => i.status === 'met').length
  const allMet = items.length > 0 && metCount === items.length

  // Hold timer handles in refs so re-renders that arrive before the timer
  // fires don't cancel the in-flight cleanup (which used to leave pulsing /
  // cardComplete / countPop stuck on permanently).
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const next = new Set<string>()
    for (const item of items) {
      const prev = prevStatusRef.current.get(item.requirement.id)
      if (prev && STATUS_RANK[item.status] > STATUS_RANK[prev]) {
        next.add(item.requirement.id)
      }
      prevStatusRef.current.set(item.requirement.id, item.status)
    }
    if (next.size > 0) {
      setPulsing(next)
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
      pulseTimerRef.current = setTimeout(() => {
        setPulsing(new Set())
        pulseTimerRef.current = null
      }, 900)
    }
    if (metCount > prevMetCountRef.current) {
      setCountPop(true)
      if (countTimerRef.current) clearTimeout(countTimerRef.current)
      countTimerRef.current = setTimeout(() => {
        setCountPop(false)
        countTimerRef.current = null
      }, 600)
    }
    if (allMet && !prevAllMetRef.current) {
      setCardComplete(true)
      if (cardTimerRef.current) clearTimeout(cardTimerRef.current)
      cardTimerRef.current = setTimeout(() => {
        setCardComplete(false)
        cardTimerRef.current = null
      }, 1200)
    }
    prevMetCountRef.current = metCount
    prevAllMetRef.current = allMet
  }, [items, metCount, allMet])

  // Clear any in-flight timers on unmount so we don't setState on a dead component.
  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
      if (countTimerRef.current) clearTimeout(countTimerRef.current)
      if (cardTimerRef.current) clearTimeout(cardTimerRef.current)
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div
      className="rounded-xl border border-neutral-200 bg-white p-4"
      style={
        cardComplete
          ? { animation: 'fc-evidence-card-complete 1100ms ease-out' }
          : undefined
      }
    >
      <h2 className="mb-1 flex items-center justify-between text-sm font-semibold">
        <span
          className="transition-colors duration-500"
          style={cardComplete ? { color: 'rgb(5, 150, 105)' } : undefined}
        >
          {t('evidence.heading')}
        </span>
        <span
          className="tabular-nums text-xs font-normal text-neutral-500"
          style={
            countPop
              ? { animation: 'fc-evidence-count-pop 550ms ease-out', display: 'inline-block' }
              : undefined
          }
        >
          {metCount} / {items.length}
        </span>
      </h2>
      <p className="mb-3 text-[11px] leading-snug text-neutral-500">
        {t('evidence.subheading')}
      </p>
      <ul className="space-y-1.5">
        {items.map(({ requirement, matching, status }) => {
          const styles = STATUS_STYLES[status]
          const statusLabel = t(
            `evidence.status.${status}` as Parameters<typeof t>[0]
          )
          const justImproved = pulsing.has(requirement.id)
          return (
            <li
              key={requirement.id}
              className={`group relative flex items-start gap-2 overflow-hidden rounded-md p-2 text-xs transition-colors duration-300 ${styles.bg}`}
              style={
                justImproved
                  ? { animation: 'fc-evidence-row-match 850ms ease-out' }
                  : undefined
              }
            >
              {justImproved && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-1/3"
                  style={{
                    animation: 'fc-evidence-sweep 700ms ease-out',
                    background:
                      'linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.28) 50%, transparent 100%)',
                  }}
                />
              )}
              {status === 'met' ? (
                <svg
                  viewBox="0 0 16 16"
                  className="fc-evidence-check mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="8" cy="8" r="7" stroke="rgba(16,185,129,0.35)" strokeWidth="1.2" />
                  <path
                    d="M4.5 8.4 L7 10.8 L11.5 5.6"
                    style={{
                      strokeDasharray: 16,
                      strokeDashoffset: justImproved ? 16 : 0,
                      animation: justImproved
                        ? 'fc-evidence-check-draw 480ms ease-out 120ms forwards'
                        : undefined,
                    }}
                  />
                </svg>
              ) : (
                <span
                  className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full text-emerald-500 transition-colors duration-300 ${styles.dot}`}
                  style={
                    justImproved
                      ? { animation: 'fc-pulse-glow 800ms ease-out' }
                      : undefined
                  }
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-neutral-800">
                    {labelOrFallback(t, requirement.labelI18nKey, requirement.labelEn)}
                  </span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${styles.text}`}>
                    {statusLabel}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] leading-snug text-neutral-500 group-hover:text-neutral-600">
                  {requirement.descriptionEn}
                </p>
                {matching.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {matching.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[9px] font-medium text-neutral-600"
                      >
                        <span>📎</span>
                        <span className="max-w-[120px] truncate">{m.fileName}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-0.5 text-[9px] uppercase tracking-wider text-neutral-400">
                  {t(TIER_LABEL_KEY[requirement.tier])}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
