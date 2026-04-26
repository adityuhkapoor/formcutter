'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { AppSidebar, BrandGlyph } from '@/components/AppSidebar'
import { LanguagePicker } from '@/components/LanguagePicker'

/**
 * Home. Mimics Granted's app-shell landing: cream sidebar + soft drifting
 * gradient canvas + centered brand glyph + "Meet Formcutter" heading + dark
 * pill "Get started" CTA + three "Get help" rows that all funnel into /chat.
 *
 * Motion is intentional and ambient — three blurred color blobs drift in the
 * background, the brand glyph gently floats, and content fades in with a
 * staggered cascade. Users with `prefers-reduced-motion: reduce` get the
 * static layout (see globals.css).
 */
export default function HomePage() {
  return (
    <div className="flex min-h-screen bg-[#faf7ee] text-neutral-900">
      <AppSidebar />
      <main className="relative flex-1 overflow-hidden">
        {/* Soft drifting blob wash — three large blurred circles in pastel
         * tones, each on its own slow loop. Lives behind a cream base so the
         * blobs feel like a wash, not a paint splatter. blur-2xl keeps them
         * visible (blur-3xl diffuses the color past the eye's threshold at
         * these sizes); /80 opacity gives a clear pastel without crowding. */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="fc-motion-blob absolute left-[-8%] top-[-12%] h-[36rem] w-[36rem] rounded-full bg-amber-200/80 blur-2xl"
            style={{ animation: 'fc-blob-1 22s ease-in-out infinite' }}
          />
          <div
            className="fc-motion-blob absolute right-[-10%] top-[8%] h-[42rem] w-[42rem] rounded-full bg-sky-200/75 blur-2xl"
            style={{ animation: 'fc-blob-2 26s ease-in-out infinite' }}
          />
          <div
            className="fc-motion-blob absolute bottom-[-18%] left-[18%] h-[38rem] w-[38rem] rounded-full bg-emerald-200/65 blur-2xl"
            style={{ animation: 'fc-blob-3 30s ease-in-out infinite' }}
          />
        </div>

        {/* Mobile-only top bar with brand + language */}
        <div className="flex items-center justify-between border-b border-stone-200/60 bg-[#faf7ee]/80 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            formcutter
          </Link>
          <LanguagePicker />
        </div>

        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pb-20 pt-16 md:pt-24">
          {/* Brand glyph with gentle float. Larger than before to anchor the
           * hero on the now-richer background. */}
          <div
            className="fc-motion-float"
            style={{ animation: 'fc-float 5s ease-in-out infinite' }}
          >
            <BrandGlyph className="h-24 w-24 drop-shadow-[0_8px_24px_rgba(15,23,42,0.12)]" />
          </div>

          <h1
            className="font-display mt-6 text-center text-5xl tracking-tight md:text-6xl lg:text-7xl opacity-0"
            style={{ animation: 'fc-fade-in 500ms ease-out 80ms forwards' }}
          >
            Meet <em className="italic">Formcutter</em>
          </h1>
          <p
            className="mt-2 text-center text-sm text-neutral-600 md:text-base opacity-0"
            style={{ animation: 'fc-fade-in 500ms ease-out 200ms forwards' }}
          >
            Your AI USCIS immigration assistant
          </p>

          <Link
            href="/chat"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-7 py-3 text-sm font-medium text-white shadow-[0_4px_16px_-4px_rgba(15,23,42,0.35)] transition-all hover:-translate-y-px hover:bg-neutral-800 hover:shadow-[0_8px_24px_-6px_rgba(15,23,42,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf7ee] opacity-0"
            style={{ animation: 'fc-fade-in 500ms ease-out 320ms forwards' }}
          >
            Get started
            <span aria-hidden>✨</span>
          </Link>

          <div
            className="mt-16 w-full opacity-0"
            style={{ animation: 'fc-fade-in 500ms ease-out 460ms forwards' }}
          >
            <h2 className="font-display text-2xl text-neutral-900">Get help</h2>
            <div className="mt-3 divide-y divide-stone-200/70 rounded-2xl border border-stone-200/70 bg-white/70 backdrop-blur-sm">
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

          <p
            className="mt-8 text-center text-[11px] italic text-neutral-500 opacity-0"
            style={{ animation: 'fc-fade-in 500ms ease-out 600ms forwards' }}
          >
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
      // group/hover-lift: the icon tile glows + scales while the whole row
      // nudges upward 1px. Keeps the card list reading as a single object
      // even as individual rows respond to the cursor.
      className="group flex items-center gap-4 px-5 py-4 transition-all first:rounded-t-2xl last:rounded-b-2xl hover:-translate-y-px hover:bg-white"
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-neutral-700 shadow-sm transition-transform group-hover:scale-105 group-hover:shadow ${tint}`}
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-neutral-900">{title}</span>
        <span className="block text-xs text-neutral-600">{description}</span>
      </span>
      <span
        aria-hidden
        className="text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-700"
      >
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
