import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'formcutter · reviewer',
  description: 'Accredited-representative reviewer console',
}

/**
 * Reviewer console gets its own visual treatment — darker chrome, muted
 * accent — so the demo audience can tell at a glance that this is a
 * professional-facing surface, distinct from the consumer-facing immigrant app.
 */
export default function RepLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-slate-900 text-slate-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href="/rep/cases" className="text-lg font-semibold tracking-tight">
              formcutter
            </Link>
            <span className="rounded bg-slate-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-slate-300">
              Reviewer console
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-300">
            <span>signed in as: Aditya K. · accredited rep (demo)</span>
            <Link href="/" className="underline hover:text-white">
              Back to immigrant view
            </Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
