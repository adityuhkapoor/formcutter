'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { AppSidebar, BrandGlyph } from '@/components/AppSidebar'
import { LanguagePicker } from '@/components/LanguagePicker'

/**
 * Home. Mimics Granted's app-shell landing: left sidebar + soft gradient
 * canvas + centered brand glyph + "Meet Formcutter" heading + dark pill
 * "Get started" CTA + three "Get help" rows that all funnel into /chat.
 *
 * All brochure content (FAQ, how-it-works, etc.) is intentionally gone —
 * the chat is the single funnel and this page is purely the door to it.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900">
      <AppSidebar />
      <main className="relative flex-1 overflow-hidden bg-gradient-to-br from-sky-50 via-emerald-50 to-amber-50">
        {/* Mobile-only top bar with brand + language */}
        <div className="flex items-center justify-between border-b border-neutral-200 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            formcutter
          </Link>
          <LanguagePicker />
        </div>

        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-20 pt-16 md:pt-24">
          <BrandGlyph className="h-20 w-20" />

          <h1 className="mt-6 text-center text-4xl font-semibold tracking-tight md:text-5xl">
            Meet Formcutter
          </h1>
          <p className="mt-2 text-center text-sm text-neutral-600 md:text-base">
            Your AI USCIS immigration assistant
          </p>

          <Link
            href="/chat"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-7 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-800"
          >
            Get started
            <span aria-hidden>✨</span>
          </Link>

          <div className="mt-16 w-full">
            <h2 className="text-sm font-semibold text-neutral-900">Get help</h2>
            <div className="mt-3 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
              <HelpCard
                href="/chat"
                tint="from-sky-100 to-indigo-100"
                icon={<BillLikeIcon />}
                title="Fill a form"
                description="Upload your docs, chat through the gaps, get a USCIS-ready PDF."
              />
              <HelpCard
                href="/chat"
                tint="from-emerald-100 to-teal-100"
                icon={<ShieldIcon />}
                title="Find the right form"
                description="Not sure what you need? Answer a few questions and we'll point you to it."
              />
              <HelpCard
                href="/chat"
                tint="from-amber-100 to-lime-100"
                icon={<ChatIcon />}
                title="Something else"
                description="Complex situation? We'll connect you to an accredited representative."
              />
            </div>
          </div>

          <p className="mt-8 text-center text-[11px] italic text-neutral-500">
            Not a law firm. Not legal advice. Accredited representatives review before you file.
          </p>
        </div>
      </main>
    </div>
  )
}

function HelpCard({
  href,
  tint,
  icon,
  title,
  description,
}: {
  href: string
  tint: string
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 px-5 py-4 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-neutral-50"
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-neutral-700 ${tint}`}
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-neutral-900">{title}</span>
        <span className="block text-xs text-neutral-600">{description}</span>
      </span>
      <span aria-hidden className="text-neutral-400">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7 5 6 5-6 5" />
        </svg>
      </span>
    </Link>
  )
}

function BillLikeIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h7l3 3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M12 3v3h3M7 10h6M7 13h4" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3 4 5v5c0 3.5 2.5 6.5 6 7 3.5-.5 6-3.5 6-7V5l-6-2z" />
      <path d="m7.5 10 1.8 1.8L13 8.5" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v6a1.5 1.5 0 0 1-1.5 1.5H9l-3 3v-3h-.5A1.5 1.5 0 0 1 4 12.5v-6z" />
    </svg>
  )
}
