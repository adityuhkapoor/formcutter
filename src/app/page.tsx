'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/provider'
import { LanguagePicker } from '@/components/LanguagePicker'
import { TriageChat } from '@/components/TriageChat'
import { FORM_REGISTRY } from '@/lib/forms'

export default function LandingPage() {
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Header />
      <Hero t={t} />
      <TriageChat />
      <HowItWorks t={t} />
      <FormsSupported t={t} />
      <TrustSection t={t} />
      <FAQ t={t} />
      <Footer t={t} />
    </div>
  )
}

// ─── Header ─────────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
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
        </div>
      </div>
    </header>
  )
}

// ─── Hero ───────────────────────────────────────────────────────────────

function Hero({ t }: { t: ReturnType<typeof useI18n>['t'] }) {
  return (
    <section className="mx-auto max-w-4xl px-6 pb-4 pt-16 text-center md:pt-20">
      <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
        {t('landing.hero.title')}
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-neutral-600 md:text-lg">
        {t('landing.hero.subtitle')}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-neutral-500">
        <TrustPill>{t('landing.hero.trust1')}</TrustPill>
        <TrustPill>{t('landing.hero.trust2')}</TrustPill>
        <TrustPill>{t('landing.hero.trust3')}</TrustPill>
      </div>
    </section>
  )
}

function TrustPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-1 w-1 rounded-full bg-emerald-500" />
      {children}
    </span>
  )
}

// ─── How it works ───────────────────────────────────────────────────────

function HowItWorks({ t }: { t: ReturnType<typeof useI18n>['t'] }) {
  const steps = [
    { n: '1', titleKey: 'landing.how.step1.title' as const, descKey: 'landing.how.step1.desc' as const, emoji: '📸' },
    { n: '2', titleKey: 'landing.how.step2.title' as const, descKey: 'landing.how.step2.desc' as const, emoji: '💬' },
    { n: '3', titleKey: 'landing.how.step3.title' as const, descKey: 'landing.how.step3.desc' as const, emoji: '✅' },
    { n: '4', titleKey: 'landing.how.step4.title' as const, descKey: 'landing.how.step4.desc' as const, emoji: '📄' },
  ]
  return (
    <section className="border-y border-neutral-200 bg-white py-16">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center text-2xl font-semibold tracking-tight">
          {t('landing.how.heading')}
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              {i < steps.length - 1 && (
                <div className="absolute left-full top-6 hidden h-px w-full -translate-x-4 bg-neutral-200 md:block" />
              )}
              <div className="relative flex flex-col items-start">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-xl text-white">
                  {s.emoji}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                  Step {s.n}
                </div>
                <h3 className="mt-1 text-base font-semibold">{t(s.titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  {t(s.descKey)}
                </p>
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
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-center text-2xl font-semibold tracking-tight">
        {t('landing.forms.heading')}
      </h2>
      <p className="mt-2 text-center text-sm text-neutral-500">
        {t('landing.forms.subheading')}
      </p>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {forms.map((f) => (
          <div
            key={f.id}
            className="rounded-xl border border-neutral-200 bg-white p-4"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-sm font-semibold uppercase">
                {f.id}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-neutral-400">
                {f.mappedFieldCount} fields
              </span>
            </div>
            <div className="mt-1 text-xs font-medium">{f.name.replace(`${f.id.toUpperCase()} `, '')}</div>
            <p className="mt-2 text-xs leading-snug text-neutral-600">
              {f.shortDescription}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Trust section ──────────────────────────────────────────────────────

function TrustSection({ t }: { t: ReturnType<typeof useI18n>['t'] }) {
  const items = [
    {
      emoji: '⚖️',
      titleKey: 'landing.trust.notLawFirm.title' as const,
      descKey: 'landing.trust.notLawFirm.desc' as const,
    },
    {
      emoji: '🔒',
      titleKey: 'landing.trust.privacy.title' as const,
      descKey: 'landing.trust.privacy.desc' as const,
    },
    {
      emoji: '🤝',
      titleKey: 'landing.trust.humans.title' as const,
      descKey: 'landing.trust.humans.desc' as const,
    },
  ]
  return (
    <section className="border-t border-neutral-200 bg-neutral-900 py-16 text-neutral-100">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center text-2xl font-semibold tracking-tight">
          {t('landing.trust.heading')}
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {items.map((i) => (
            <div key={i.titleKey}>
              <div className="text-2xl">{i.emoji}</div>
              <h3 className="mt-2 text-base font-semibold">{t(i.titleKey)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                {t(i.descKey)}
              </p>
            </div>
          ))}
        </div>
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
