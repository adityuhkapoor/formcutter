'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/provider'
import { RecommendationsGrid } from '@/components/RecommendationsGrid'
import type {
  TriageFacts,
  TriageMessage,
  TriageOutcome,
} from '@/lib/triage-types'

/**
 * Landing-page chat that triages free-text user input into one of four
 * outcomes (route / recommend / ask / escalate) via POST /api/triage. The
 * chat IS the new front door — replaces the archetype-card interstitial +
 * the /start wizard.
 */
export function TriageChat() {
  const { lang } = useI18n()
  const router = useRouter()

  const [messages, setMessages] = useState<TriageMessage[]>([])
  const [facts, setFacts] = useState<TriageFacts>({})
  const [outcome, setOutcome] = useState<TriageOutcome | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Seed greeting once the lang provider has hydrated.
  useEffect(() => {
    if (messages.length > 0) return
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          "Hi — tell me your situation in a sentence or two and I'll point you to the right USCIS form. You can say something like \"my husband is a U.S. citizen\" or \"I need to fill out I-864\".",
        createdAt: Date.now(),
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

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Tell us about your situation
        </h2>
        <button
          type="button"
          onClick={requestSelfEscalation}
          disabled={loading}
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:border-neutral-900 hover:bg-neutral-100 disabled:opacity-50"
        >
          Speak to a rep
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div
          ref={scrollRef}
          className="max-h-[480px] min-h-[320px] space-y-3 overflow-y-auto px-4 py-4 sm:px-6"
        >
          {messages.map((m) => (
            <ChatBubble key={m.id} msg={m} onChip={handleChip} chipsEnabled={!loading && m === messages[messages.length - 1]} />
          ))}
          {loading && <TypingIndicator />}

          {/* Inline outcome cards rendered below the chat stream */}
          {outcome?.type === 'route' && <RouteCard outcome={outcome} onAccept={() => router.push(`/fill?formId=${outcome.formId}`)} />}
          {outcome?.type === 'recommend' && (
            <div className="pt-2">
              <RecommendationsGrid result={outcome.result} />
            </div>
          )}
          {outcome?.type === 'escalate' && (
            <EscalationCard outcome={outcome} transcript={messages} formId={facts.namedForm} />
          )}
        </div>

        {/* Composer: hidden when the outcome is a terminal state (route / escalate)
         * where further typing doesn't make sense. Still active on ask + recommend. */}
        {outcome?.type !== 'escalate' && (
          <form onSubmit={handleSubmit} className="border-t border-neutral-200 bg-neutral-50 px-3 py-2 sm:px-4">
            <div className="flex items-end gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={lastAskChips?.length ? 'Tap a chip above or type your answer…' : 'e.g. "I married a U.S. citizen and want a green card"'}
                disabled={loading}
                aria-label="Describe your immigration situation"
                className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none disabled:bg-neutral-100"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                Send
              </button>
            </div>
          </form>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-neutral-500">
        Formcutter is not a law firm and does not provide legal advice.
      </p>
    </section>
  )
}

function ChatBubble({
  msg,
  onChip,
  chipsEnabled,
}: {
  msg: TriageMessage
  onChip: (value: string) => void
  chipsEnabled: boolean
}) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'rounded-br-md bg-neutral-900 text-white'
              : 'rounded-bl-md bg-neutral-100 text-neutral-900'
          }`}
        >
          {msg.content}
        </div>
        {!isUser && msg.chips && msg.chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.chips.map((c) => (
              <button
                key={c}
                type="button"
                disabled={!chipsEnabled}
                onClick={() => onChip(c)}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:border-neutral-900 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
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
