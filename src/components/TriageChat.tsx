'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
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

/** Meta starter chip — short-circuited to a deterministic reply instead of
 * burning an LLM call. Recognized by exact string match in sendMessage. */
const META_CHIP = 'How can Formcutter help me?'

/** "I know the form" starter chip — short-circuited to render a deterministic
 * form picker in-message rather than letting the LLM improvise a chip list. */
const FILL_FORM_CHIP = 'Help me fill out a USCIS form I know about'

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
  const { lang } = useI18n()
  const router = useRouter()

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
        content: 'Hi there! What can I help you with today?',
        createdAt: Date.now(),
        chips: [
          'Help me fill out a USCIS form I know about',
          "I'm not sure which form I need",
          META_CHIP,
        ],
      },
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    if (text === META_CHIP) {
      appendAssistant(META_REPLY)
      return
    }

    // "I know the form" — render a deterministic form picker rather than
    // asking the LLM to list supported forms (which it does inconsistently).
    if (text === FILL_FORM_CHIP) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            "Great — pick the form you want to fill out. If you don't see it in the list, let me know which one and I'll check if we support it.",
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
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-10"
      >
        <div className="mx-auto w-full max-w-3xl">
          {messages.length > 0 && (
            <div className="mb-3 text-center text-xs text-neutral-400">
              {today}
            </div>
          )}

          {messages.map((m, i) => (
            <ChatBubble
              key={m.id}
              msg={m}
              showHeader={
                m.role === 'assistant' &&
                (i === 0 || messages[i - 1]?.role !== 'assistant')
              }
              onChip={handleChip}
              chipsEnabled={!loading && m === messages[messages.length - 1]}
              onSelectForm={(formId) => router.push(`/fill?formId=${formId}`)}
              onTypeFallback={(text) => void sendMessage(text)}
            />
          ))}

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
          className="border-t border-neutral-200 bg-white px-4 py-4 sm:px-10"
        >
          <div className="mx-auto flex w-full max-w-3xl items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 shadow-sm focus-within:border-neutral-400">
            <button
              type="button"
              onClick={requestSelfEscalation}
              disabled={loading}
              aria-label="Speak to an accredited representative"
              title="Speak to a rep"
              className="shrink-0 text-neutral-400 hover:text-neutral-700 disabled:opacity-50"
            >
              <PlusIcon />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Formcutter..."
              disabled={loading}
              aria-label="Describe your immigration situation"
              className="flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-neutral-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              <SendArrow />
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-neutral-400">
            Formcutter is not a law firm and does not provide legal advice.
          </p>
        </form>
      )}
    </section>
  )
})

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
  onSelectForm,
  onTypeFallback,
}: {
  msg: TriageMessage
  onChip: (value: string) => void
  chipsEnabled: boolean
  showHeader: boolean
  onSelectForm: (formId: FormId) => void
  onTypeFallback: (text: string) => void
}) {
  const isUser = msg.role === 'user'
  const timeLabel = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })

  if (isUser) {
    // User's own typed message renders as a plain right-aligned row.
    return (
      <div className="mb-4 flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-neutral-900 px-4 py-2 text-sm text-white">
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6">
      {showHeader && (
        <div className="mb-2 flex items-center gap-2 text-xs">
          <BrandGlyph className="h-5 w-5" />
          <span className="font-medium text-neutral-700">Formcutter AI</span>
          <span className="ml-auto text-neutral-400">{timeLabel}</span>
        </div>
      )}
      <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-900">
        {msg.content}
      </div>
      {msg.formPicker && (
        <FormPicker
          enabled={chipsEnabled}
          onSelectForm={onSelectForm}
          onTypeFallback={onTypeFallback}
        />
      )}
      {msg.chips && msg.chips.length > 0 && (
        <div className="mt-4 flex flex-col items-end gap-2">
          <div className="text-xs text-neutral-500">Select an option:</div>
          {msg.chips.map((c) => (
            <button
              key={c}
              type="button"
              disabled={!chipsEnabled}
              onClick={() => onChip(c)}
              className="rounded-full border border-neutral-300 bg-white px-5 py-2 text-sm text-neutral-800 hover:border-neutral-900 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
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
  const [showFallback, setShowFallback] = useState(false)
  const [typed, setTyped] = useState('')
  const forms = Object.values(FORM_REGISTRY)

  function submitFallback() {
    const v = typed.trim()
    if (!v) return
    onTypeFallback(`I need to fill out ${v}`)
  }

  return (
    <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {forms.map((f) => (
          <button
            key={f.id}
            type="button"
            disabled={!enabled}
            onClick={() => onSelectForm(f.id)}
            className="flex flex-col items-start gap-0.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left transition-colors hover:border-neutral-900 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="font-mono text-xs font-semibold uppercase text-neutral-900">
              {f.id}
            </span>
            <span className="text-xs text-neutral-600">
              {f.name.replace(`${f.id.toUpperCase()} `, '')}
            </span>
          </button>
        ))}
      </div>

      {showFallback ? (
        <div className="mt-3 flex items-center gap-2">
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
            placeholder="Type the form number (e.g. I-751)"
            disabled={!enabled}
            className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            disabled={!enabled || !typed.trim()}
            onClick={submitFallback}
            className="rounded-md bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            Submit
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!enabled}
          onClick={() => setShowFallback(true)}
          className="mt-3 text-xs text-neutral-500 underline-offset-2 hover:text-neutral-800 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          Don&apos;t see your form? →
        </button>
      )}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-md bg-neutral-100 px-4 py-3">
        <span className="flex gap-1">
          <Dot delay="0ms" />
          <Dot delay="150ms" />
          <Dot delay="300ms" />
        </span>
      </div>
    </div>
  )
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-500"
      style={{ animationDelay: delay }}
    />
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
