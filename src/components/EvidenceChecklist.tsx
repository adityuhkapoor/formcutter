'use client'

import { useI18n } from '@/lib/i18n/provider'
import type { EvidenceStatus } from '@/lib/evidence'

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

export function EvidenceChecklist({ items }: { items: EvidenceStatus[] }) {
  const { t } = useI18n()
  if (items.length === 0) return null

  const metCount = items.filter((i) => i.status === 'met').length

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-1 flex items-center justify-between text-sm font-semibold">
        <span>{t('evidence.heading')}</span>
        <span className="text-xs font-normal text-neutral-500">
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
          return (
            <li
              key={requirement.id}
              className={`group flex items-start gap-2 rounded-md p-2 text-xs ${styles.bg}`}
            >
              <span className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-neutral-800">
                    {t(requirement.labelI18nKey as Parameters<typeof t>[0])}
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
