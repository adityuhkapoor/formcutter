'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/provider'
import { BrandGlyph } from '@/components/AppSidebar'
import { RecommendationsGrid } from '@/components/RecommendationsGrid'
import { FORM_REGISTRY, type FormId } from '@/lib/forms'
import type {
  TriageFacts,
  TriageMessage,
  TriageOutcome,
} from '@/lib/triage-types'

/** Imperative handle exposed to the landing header so its "Speak to a rep"
 * CTA can trigger the same self-escalation path as the in-card button. */
export type TriageChatHandle = {
  triggerEscalation: () => void
}

// Starter chips are short-circuited by exact label match in sendMessage.
// Both the rendered label and the matching string come from the same i18n
// key, so the transcript shows what the user actually tapped (localized)
// and the short-circuit still triggers regardless of language.

const META_REPLY = `Formcutter helps you fill out U.S. immigration forms without paying a lawyer for paperwork you can do yourself. Three ways I can help:

1. Fill a form you already know — tell me which form (e.g. I-864, N-400) and I'll walk you through it. Upload your docs, I extract what I can, we chat to fill the rest.

2. Find the right form — describe your situation and I'll point you to the USCIS form(s) you likely need.

3. Talk to an accredited rep — if your case is complicated (deportation hearings, criminal history, fraud issues), an accredited representative should weigh in before you file anything. Tap the + button next to the input to request one.

What sounds like your situation?`

/**
 * Landing-page chat that triages free-text user input into one of four
 * outcomes (route / recommend / ask / escalate) via POST /api/triage. The
 * chat IS the new front door — replaces the archetype-card interstitial +
 * the /start wizard.
 */
export const TriageChat = forwardRef<TriageChatHandle>(function TriageChat(_, ref) {
  const { lang, t } = useI18n()
  const router = useRouter()

  const metaChip = t('triage.chip.meta')
  const fillFormChip = t('triage.chip.fillKnown')
  const findFormChip = t('triage.chip.findRight')

  const [messages, setMessages] = useState<TriageMessage[]>([])
  const [facts, setFacts] = useState<TriageFacts>({})
  const [outcome, setOutcome] = useState<TriageOutcome | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Seed greeting once the lang provider has hydrated. Three starter chips
  // mirror the "Get help" cards on the home page — zero-blank-state so users
  // who don't know what to type have immediate footholds.
  useEffect(() => {
    if (messages.length > 0) return
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: t('triage.greeting'),
        createdAt: Date.now(),
        chips: [fillFormChip, findFormChip, metaChip],
      },
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  // Auto-scroll on new messages.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, outcome, loading])

  async function sendMessage(text: string) {
    const userMsg: TriageMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: Date.now(),
    }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setOutcome(null)

    // Meta chip is deterministic — no LLM call. Keep the reply identical
    // across demo runs so the walkthrough is predictable.
    if (text === metaChip) {
      appendAssistant(META_REPLY)
      return
    }

    // "I know the form" — render a deterministic form picker rather than
    // asking the LLM to list supported forms (which it does inconsistently).
    if (text === fillFormChip) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: t('triage.formPicker.intro'),
          createdAt: Date.now(),
          formPicker: true,
        },
      ])
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, facts, language: lang }),
      })
      const data = await res.json()
      if (!res.ok || !data.outcome) {
        appendAssistant('Sorry — something went wrong on my end. Try rephrasing, or use the button above to speak with a rep.')
        return
      }
      const out = data.outcome as TriageOutcome
      setFacts(out.facts)
      setOutcome(out)
      appendAssistant(out.assistantMessage, out.type === 'ask' ? out.chips : undefined)
    } catch (err) {
      console.error(err)
      appendAssistant('Network hiccup. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }

  function appendAssistant(content: string, chips?: string[]) {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content,
        createdAt: Date.now(),
        chips,
      },
    ])
  }

  async function requestSelfEscalation() {
    setLoading(true)
    setOutcome(null)
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, facts, language: lang, selfRequested: true }),
      })
      const data = await res.json()
      if (res.ok && data.outcome) {
        const out = data.outcome as TriageOutcome
        setOutcome(out)
        appendAssistant(out.assistantMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  function handleChip(value: string) {
    void sendMessage(value)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const t = input.trim()
    if (!t || loading) return
    void sendMessage(t)
  }

  const lastAskChips =
    outcome?.type === 'ask' ? outcome.chips : undefined

  // Expose triggerEscalation so the landing header's "Speak to a rep" CTA
  // can fire the exact same path as the in-card button.
  useImperativeHandle(
    ref,
    () => ({ triggerEscalation: () => void requestSelfEscalation() }),
    // requestSelfEscalation is stable enough for demo purposes; we accept the
    // lint warning to avoid memoizing the handler and over-engineering this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const today = new Date().toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return (
    <section
      id="triage-chat"
      className="flex h-full w-full flex-1 flex-col"
    >
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-8 sm:px-10 sm:py-10"
      >
        <div className="mx-auto w-full max-w-3xl">
          {messages.length > 0 && (
            <div className="mb-8 text-center text-[13px] text-neutral-500">
              {today}
            </div>
          )}

          {messages.map((m, i) => {
            const isLast = i === messages.length - 1
            return (
              <ChatBubble
                key={m.id}
                msg={m}
                showHeader={
                  m.role === 'assistant' &&
                  (i === 0 || messages[i - 1]?.role !== 'assistant')
                }
                onChip={handleChip}
                chipsEnabled={!loading && isLast}
                // Once a newer message arrives, stale chips/pickers vanish
                // entirely rather than sitting around as grayed-out clutter.
                showInteractive={isLast}
                onSelectForm={(formId) => router.push(`/fill?formId=${formId}`)}
                onTypeFallback={(text) => void sendMessage(text)}
              />
            )
          })}

          {loading && <TypingIndicator />}

          {/* Inline outcome cards rendered below the chat stream */}
          {outcome?.type === 'route' && (
            <RouteCard
              outcome={outcome}
              onAccept={() => router.push(`/fill?formId=${outcome.formId}`)}
            />
          )}
          {outcome?.type === 'recommend' && (
            <div className="pt-4">
              <RecommendationsGrid result={outcome.result} />
            </div>
          )}
          {outcome?.type === 'escalate' && (
            <EscalationCard
              outcome={outcome}
              transcript={messages}
              formId={facts.namedForm}
            />
          )}
        </div>
      </div>

      {/* Composer: full-width bottom bar with + prefix and circular send. */}
      {outcome?.type !== 'escalate' && (
        <form
          onSubmit={handleSubmit}
          className="bg-gradient-to-t from-[#faf7ee] via-[#faf7ee] to-[#faf7ee]/0 px-4 pb-5 pt-8 sm:px-10"
        >
          <div className="mx-auto flex w-full max-w-3xl items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 transition-colors focus-within:border-stone-300">
            <button
              type="button"
              onClick={requestSelfEscalation}
              disabled={loading}
              aria-label={t('triage.repAriaLabel')}
              title={t('triage.repAriaLabel')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-stone-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <PlusIcon />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('triage.placeholder')}
              disabled={loading}
              aria-label="Describe your immigration situation"
              className="flex-1 bg-transparent px-1 text-[15px] outline-none placeholder:text-neutral-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-200 text-neutral-500 transition-colors hover:bg-neutral-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/40 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-neutral-400 disabled:hover:bg-stone-200 disabled:hover:text-neutral-400"
            >
              <SendArrow />
            </button>
          </div>
          <p className="mx-auto mt-3 max-w-3xl text-center text-[11px] text-neutral-400">
            Formcutter is not a law firm and does not provide legal advice.
          </p>
        </form>
      )}
    </section>
  )
})

/**
 * Tiny inline-markdown renderer for `**bold**` only. The triage LLM emits
 * markdown bold around question phrasing ("**Are you currently…**"); rendering
 * those literally as asterisks looked broken. We keep this deliberately
 * narrow — no italics, lists, or links — to avoid pulling a markdown lib
 * for one feature. Unclosed/unbalanced `**` just render as plain text.
 */
function renderInlineBold(text: string): ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

/**
 * Subtle copy / thumbs-up / thumbs-down row beneath each assistant message.
 * Mimics Granted's micro-interaction footer. Copy actually works; the thumbs
 * are visual-only for now (no feedback API wired up yet — toggling local
 * state keeps the affordance honest without lying about a saved rating).
 */
function MessageActions({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)
  const [vote, setVote] = useState<'up' | 'down' | null>(null)

  function handleCopy() {
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  return (
    <div className="mt-3 flex items-center gap-1 text-neutral-400">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy message'}
        title={copied ? 'Copied' : 'Copy'}
        className="rounded-md p-1.5 transition-colors hover:bg-stone-100 hover:text-neutral-700"
      >
        <CopyIcon />
      </button>
      <button
        type="button"
        onClick={() => setVote(vote === 'up' ? null : 'up')}
        aria-label="Helpful"
        aria-pressed={vote === 'up'}
        className={`rounded-md p-1.5 transition-colors hover:bg-stone-100 hover:text-neutral-700 ${vote === 'up' ? 'text-emerald-600' : ''}`}
      >
        <ThumbIcon direction="up" />
      </button>
      <button
        type="button"
        onClick={() => setVote(vote === 'down' ? null : 'down')}
        aria-label="Not helpful"
        aria-pressed={vote === 'down'}
        className={`rounded-md p-1.5 transition-colors hover:bg-stone-100 hover:text-neutral-700 ${vote === 'down' ? 'text-red-600' : ''}`}
      >
        <ThumbIcon direction="down" />
      </button>
    </div>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="6" width="10" height="10" rx="1.5" />
      <path d="M4 12V5a1 1 0 0 1 1-1h7" />
    </svg>
  )
}

function ThumbIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-4 w-4 ${direction === 'down' ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 9.5V16H4.5a1 1 0 0 1-1-1V10.5a1 1 0 0 1 1-1H7zm0 0L10 3a2 2 0 0 1 2 2v3.5h3.2a1.5 1.5 0 0 1 1.48 1.74l-1 6A1.5 1.5 0 0 1 14.2 17.5H7" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M10 4v12M4 10h12" />
    </svg>
  )
}

function SendArrow() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 15V5M5 10l5-5 5 5" />
    </svg>
  )
}

function ChatBubble({
  msg,
  onChip,
  chipsEnabled,
  showHeader,
  showInteractive,
  onSelectForm,
  onTypeFallback,
}: {
  msg: TriageMessage
  onChip: (value: string) => void
  chipsEnabled: boolean
  showHeader: boolean
  showInteractive: boolean
  onSelectForm: (formId: FormId) => void
  onTypeFallback: (text: string) => void
}) {
  const { t } = useI18n()
  const isUser = msg.role === 'user'
  const timeLabel = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })

  if (isUser) {
    // Granted-style user pill: warm taupe with dark text. The aggressive
    // black-on-white we had before felt jarring against the cream canvas.
    return (
      <div className="mb-8 flex justify-end animate-[fc-fade-in_240ms_ease-out]">
        <div className="max-w-[80%] rounded-full bg-[#ece4d3] px-5 py-2.5 text-[15px] leading-relaxed text-neutral-900">
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="mb-8 animate-[fc-fade-in_280ms_ease-out]">
      {showHeader && (
        <div className="mb-2.5 flex items-center gap-2 text-xs">
          <BrandGlyph className="h-5 w-5" />
          <span className="font-medium text-neutral-700">Formcutter AI</span>
          <span className="ml-auto text-neutral-400">{timeLabel}</span>
        </div>
      )}
      <div className="whitespace-pre-wrap text-[16px] leading-[1.65] text-neutral-900">
        {renderInlineBold(msg.content)}
      </div>
      <MessageActions content={msg.content} />
      {showInteractive && msg.formPicker && (
        <FormPicker
          enabled={chipsEnabled}
          onSelectForm={onSelectForm}
          onTypeFallback={onTypeFallback}
        />
      )}
      {showInteractive && msg.chips && msg.chips.length > 0 && (
        <div className="mt-6 flex flex-col items-end gap-2.5 animate-[fc-fade-in_320ms_ease-out]">
          <div className="text-[14px] text-neutral-700">
            {t('triage.selectOption')}
          </div>
          {msg.chips.map((c) => (
            <button
              key={c}
              type="button"
              disabled={!chipsEnabled}
              onClick={() => onChip(c)}
              className="rounded-full border border-stone-200 bg-white px-6 py-2.5 text-[15px] text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Deterministic form picker rendered in-message. 2-col grid of supported
 * USCIS forms; clicking one routes straight to /fill?formId=X. "Don't see
 * your form?" reveals a text input — the typed value is fed back through
 * the regular triage path so the LLM can route it if supported or escalate
 * if not.
 */
function FormPicker({
  enabled,
  onSelectForm,
  onTypeFallback,
}: {
  enabled: boolean
  onSelectForm: (formId: FormId) => void
  onTypeFallback: (text: string) => void
}) {
  const { t } = useI18n()
  const [showFallback, setShowFallback] = useState(false)
  const [typed, setTyped] = useState('')
  const forms = Object.values(FORM_REGISTRY)

  function submitFallback() {
    const v = typed.trim()
    if (!v) return
    onTypeFallback(`I need to fill out ${v}`)
  }

  return (
    <div className="mt-5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {forms.map((f) => (
          <button
            key={f.id}
            type="button"
            disabled={!enabled}
            onClick={() => onSelectForm(f.id)}
            className="group flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-px hover:border-neutral-900 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
          >
            <div className="min-w-0">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                {f.id}
              </div>
              <div className="mt-0.5 truncate text-[13px] font-medium text-neutral-900">
                {f.name.replace(`${f.id.toUpperCase()} `, '')}
              </div>
            </div>
            <span
              aria-hidden
              className="text-neutral-300 transition-colors group-hover:text-neutral-900"
            >
              →
            </span>
          </button>
        ))}
      </div>

      {showFallback ? (
        <div className="mt-3 flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 shadow-sm focus-within:border-neutral-400">
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitFallback()
              }
            }}
            placeholder={t('triage.formPicker.fallbackPlaceholder')}
            disabled={!enabled}
            className="flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-neutral-400 disabled:opacity-50"
          />
          <button
            type="button"
            disabled={!enabled || !typed.trim()}
            onClick={submitFallback}
            className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {t('triage.formPicker.submit')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!enabled}
          onClick={() => setShowFallback(true)}
          className="mt-3 text-xs text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('triage.formPicker.fallbackPrompt')}
        </button>
      )}
    </div>
  )
}

function TypingIndicator() {
  // Morphing blob — `border-radius` is animated through several asymmetric
  // ratios so the shape continuously deforms (square → leaf → circle → blob)
  // while a slow rotation + gradient give it depth. Reads as "thinking" not
  // "loading bar".
  return (
    <div className="mb-8 animate-[fc-fade-in_240ms_ease-out]">
      <div
        className="h-8 w-8 bg-gradient-to-br from-emerald-200 via-cyan-100 to-sky-200 shadow-[0_2px_12px_-4px_rgba(16,185,129,0.35)]"
        style={{ animation: 'fc-morph 3.2s ease-in-out infinite' }}
      />
    </div>
  )
}

function RouteCard({
  outcome,
  onAccept,
}: {
  outcome: Extract<TriageOutcome, { type: 'route' }>
  onAccept: () => void
}) {
  return (
    <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
        Matched
      </div>
      <div className="mt-1 text-base font-semibold text-neutral-900">
        Form {outcome.formId.toUpperCase()}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAccept}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Start {outcome.formId.toUpperCase()} →
        </button>
        <Link
          href={`/fill?formId=${outcome.formId}`}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-900 hover:bg-neutral-100"
        >
          Open in new tab
        </Link>
      </div>
    </div>
  )
}

function EscalationCard({
  outcome,
  transcript,
  formId,
}: {
  outcome: Extract<TriageOutcome, { type: 'escalate' }>
  transcript: TriageMessage[]
  formId?: string
}) {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formType: formId ?? 'i-864',
          triageTranscript: transcript.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          })),
          triageEscalation: {
            reason: outcome.reason,
            severity: outcome.severity,
            contactEmail: email.trim(),
            contactPhone: phone.trim() || undefined,
          },
        }),
      })
      if (res.ok) setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
        <div className="text-sm font-semibold text-emerald-900">Request received.</div>
        <p className="mt-1 text-xs text-emerald-800">
          An accredited representative will reach out within 48 hours. You can close this tab.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-amber-900">
        Flagged for accredited-rep review
      </div>
      <p className="mt-1 text-xs text-amber-800">{outcome.reason}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-neutral-700">
          Email (required)
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            placeholder="you@example.com"
          />
        </label>
        <label className="text-xs font-medium text-neutral-700">
          Phone (optional)
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            placeholder="(555) 555-5555"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={submitting || !email.trim()}
        className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        {submitting ? 'Sending…' : 'Request review'}
      </button>
    </form>
  )
}
