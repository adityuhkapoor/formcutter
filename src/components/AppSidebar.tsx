'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * Left nav for / and /chat. Mimics the Granted app shell:
 * - brand top-left
 * - "Ask formcutter" mint pill as the primary entry to the chat (same role as
 *   Granted's "Ask Granted")
 * - vertical nav with Home / Cases / Forms / Reviewer
 * Active item is highlighted based on pathname.
 */
export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-64 shrink-0 border-r border-stone-200/70 bg-[#f5f1e6] lg:flex lg:flex-col">
      <div className="px-6 pb-6 pt-6">
        <Link
          href="/"
          className="font-display text-3xl tracking-tight text-neutral-900"
        >
          formcutter
        </Link>
      </div>

      <div className="px-4">
        <Link
          href="/chat"
          className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-sm font-medium text-neutral-900 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
        >
          <BrandGlyph className="h-5 w-5" />
          Ask formcutter
        </Link>
      </div>

      <nav className="mt-6 flex flex-col gap-1 px-3">
        <NavItem href="/" active={pathname === '/'} icon={<HomeIcon />}>
          Home
        </NavItem>
        <NavItem
          href="/chat"
          active={pathname === '/chat'}
          icon={<CasesIcon />}
        >
          Cases
        </NavItem>
        <NavItem
          href="/rep/cases"
          active={pathname?.startsWith('/rep') ?? false}
          icon={<ReviewIcon />}
        >
          Reviewer
        </NavItem>
        <NavItem
          href="/fill"
          active={pathname?.startsWith('/fill') ?? false}
          icon={<FormIcon />}
        >
          Forms
        </NavItem>
      </nav>

      <div className="mt-auto px-6 pb-6 pt-6 text-xs text-neutral-400">
        Powered by Claude Opus 4.7
      </div>
    </aside>
  )
}

function NavItem({
  href,
  active,
  icon,
  children,
}: {
  href: string
  active: boolean
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-[#ebe5d4] text-neutral-900'
          : 'text-neutral-600 hover:bg-[#efeadc] hover:text-neutral-900'
      }`}
    >
      <span className="text-neutral-500">{icon}</span>
      {children}
    </Link>
  )
}

/** Stylized "F" brand glyph used as a mini avatar in the Ask-formcutter pill. */
export function BrandGlyph({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="fc-brand-grad" x1="0" y1="0" x2="20" y2="20">
          <stop offset="0%" stopColor="#d1fae5" />
          <stop offset="100%" stopColor="#bae6fd" />
        </linearGradient>
      </defs>
      <circle cx="10" cy="10" r="9" fill="url(#fc-brand-grad)" stroke="#0f172a" strokeOpacity="0.08" />
      <path
        d="M7 5.5h6v1.8H8.6v2.2h3.8v1.7H8.6V15H7V5.5z"
        fill="#0f172a"
        fillOpacity="0.75"
      />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 10 4l7 6.5V17a1 1 0 0 1-1 1h-3.5v-4.5h-5V18H4a1 1 0 0 1-1-1v-6.5z" />
    </svg>
  )
}

function CasesIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="14" height="11" rx="1.5" />
      <path d="M10 8v4M8 10h4" />
    </svg>
  )
}

function ReviewIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3 4 5v5c0 3.5 2.5 6.5 6 7 3.5-.5 6-3.5 6-7V5l-6-2z" />
      <path d="m7.5 10 1.8 1.8L13 8.5" />
    </svg>
  )
}

function FormIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h7l3 3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M12 3v3h3M7 10h6M7 13h4" />
    </svg>
  )
}
