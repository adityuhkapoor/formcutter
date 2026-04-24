'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/provider'
import { LanguagePicker } from '@/components/LanguagePicker'
import { TriageChat, type TriageChatHandle } from '@/components/TriageChat'
import { FORM_REGISTRY } from '@/lib/forms'

export default function LandingPage() {
  const { t } = useI18n()
  const triageRef = useRef<TriageChatHandle>(null)

  // Header "Speak to a rep" CTA mirrors the in-card button. Scroll into view
  // first (especially on mobile where the chat may be below the fold once
  // someone's scrolled down) and then trigger the chat's self-escalation.
  function requestEscalation() {
    const el = document.getElementById('triage-chat')
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    triageRef.current?.triggerEscalation()
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Header onRequestEscalation={requestEscalation} />
      <Hero t={t} />
      <TriageChat ref={triageRef} />
      <HowItWorks t={t} />
      <FormsSupported t={t} />
      <FAQ t={t} />
      <Footer t={t} />
    </div>
  )
}

// ─── Header ─────────────────────────────────────────────────────────────

function Header({ onRequestEscalation }: { onRequestEscalation: () => void }) {
  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-block h-5 w-5 rounded-sm bg-neutral-900" />
          <span className="text-lg font-semibold tracking-tight">formcutter</span>
        </Link>
        <div className="flex items-center gap-3 text-xs">
          <LanguagePicker />
          <Link
            href="/rep/cases"
            className="hidden text-neutral-500 hover:text-neutral-900 sm:inline"
          >
            Reviewer console →
          </Link>
          <button
            type="button"
            onClick={onRequestEscalation}
            className="rounded-full bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-emerald-400"
          >
            Speak to a rep
          </button>
        </div>
      </div>
    </header>
  )
}

// ─── Hero ───────────────────────────────────────────────────────────────

function Hero({ t }: { t: ReturnType<typeof useI18n>['t'] }) {
  return (
    <section className="mx-auto max-w-4xl px-6 pb-2 pt-12 text-center md:pt-16">
      <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
        {t('landing.hero.title')}
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-neutral-600 md:text-lg">
        {t('landing.hero.subtitle')}
      </p>
    </section>
  )
}

// ─── How it works ───────────────────────────────────────────────────────

function HowItWorks({ t }: { t: ReturnType<typeof useI18n>['t'] }) {
  const steps = [
    { n: '1', titleKey: 'landing.how.step1.title' as const, emoji: '📸' },
    { n: '2', titleKey: 'landing.how.step2.title' as const, emoji: '💬' },
    { n: '3', titleKey: 'landing.how.step3.title' as const, emoji: '✅' },
    { n: '4', titleKey: 'landing.how.step4.title' as const, emoji: '📄' },
  ]
  return (
    <section className="border-t border-neutral-200 bg-white py-10">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-neutral-500">
          {t('landing.how.heading')}
        </h2>
        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="flex items-start gap-3">
              <span className="text-xl leading-none">{s.emoji}</span>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                  Step {s.n}
                </div>
                <h3 className="mt-0.5 text-sm font-semibold">{t(s.titleKey)}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Forms supported ────────────────────────────────────────────────────

function FormsSupported({ t }: { t: ReturnType<typeof useI18n>['t'] }) {
  const forms = Object.values(FORM_REGISTRY)
  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-neutral-500">
        {t('landing.forms.heading')}
      </h2>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {forms.map((f) => (
          <span
            key={f.id}
            title={f.shortDescription}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs"
          >
            <span className="font-mono font-semibold uppercase">{f.id}</span>
            <span className="text-neutral-300">·</span>
            <span className="text-neutral-600">
              {f.name.replace(`${f.id.toUpperCase()} `, '')}
            </span>
          </span>
        ))}
      </div>
    </section>
  )
}

// ─── FAQ ────────────────────────────────────────────────────────────────

function FAQ({ t }: { t: ReturnType<typeof useI18n>['t'] }) {
  const items: Array<{ q: Parameters<typeof t>[0]; a: Parameters<typeof t>[0] }> = [
    { q: 'landing.faq.q1.q', a: 'landing.faq.q1.a' },
    { q: 'landing.faq.q2.q', a: 'landing.faq.q2.a' },
    { q: 'landing.faq.q3.q', a: 'landing.faq.q3.a' },
    { q: 'landing.faq.q4.q', a: 'landing.faq.q4.a' },
    { q: 'landing.faq.q5.q', a: 'landing.faq.q5.a' },
    { q: 'landing.faq.q6.q', a: 'landing.faq.q6.a' },
  ]
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h2 className="text-center text-2xl font-semibold tracking-tight">
        {t('landing.faq.heading')}
      </h2>
      <div className="mt-8 space-y-2">
        {items.map((i) => (
          <details
            key={i.q}
            className="group rounded-xl border border-neutral-200 bg-white p-4 [&[open]]:border-neutral-400"
          >
            <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
              <span>{t(i.q)}</span>
              <span className="ml-3 text-neutral-400 group-open:rotate-45 transition-transform">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              {t(i.a)}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}

// ─── Footer ─────────────────────────────────────────────────────────────

function Footer({ t }: { t: ReturnType<typeof useI18n>['t'] }) {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 text-xs text-neutral-500 sm:flex-row">
        <div>
          {t('landing.footer.tagline')} · built by{' '}
          <a
            href="https://github.com/adityuhkapoor/formcutter"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-neutral-700"
          >
            @adityuhkapoor
          </a>
        </div>
        <div className="flex gap-4">
          <Link href="/rep/cases" className="hover:text-neutral-900">
            Reviewer console
          </Link>
          <a
            href="https://github.com/adityuhkapoor/formcutter"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-900"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
