'use client'

import Link from 'next/link'
import { AppSidebar } from '@/components/AppSidebar'
import { LanguagePicker } from '@/components/LanguagePicker'
import { TriageChat } from '@/components/TriageChat'
import { useI18n } from '@/lib/i18n/provider'

/**
 * /chat — app-shell with sidebar + top bar + full-height chat area.
 * Every "Get started" on / routes here. TriageChat owns the message stream
 * and all outcome rendering.
 */
export default function ChatPage() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-screen bg-[#faf7ee] text-neutral-900">
      <AppSidebar />
      <main className="flex min-h-screen flex-1 flex-col">
        {/* Mobile-only top brand row */}
        <div className="flex items-center justify-between border-b border-stone-200/70 bg-[#faf7ee]/80 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            formcutter
          </Link>
          <LanguagePicker />
        </div>

        {/* Desktop top bar — title + info icons, same spot as Granted's */}
        <div className="hidden items-center justify-between border-b border-stone-200/70 bg-[#faf7ee]/60 px-6 py-4 backdrop-blur lg:flex">
          <div className="flex items-center gap-3">
            <PanelIcon />
            <h1 className="font-display text-lg text-neutral-900">
              {t('triage.topbar')}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <LanguagePicker />
            <InfoIcon />
          </div>
        </div>

        {/* Chat canvas */}
        <div className="flex flex-1 flex-col">
          <TriageChat />
        </div>
      </main>
    </div>
  )
}

function PanelIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 text-neutral-600" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="14" height="12" rx="1.5" />
      <path d="M8 4v12" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 9v4.5M10 6.5v.01" />
    </svg>
  )
}
