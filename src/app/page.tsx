'use client'

import { useState, useRef, useEffect, type FormEvent } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string }
type ExtractionResult = {
  docType: string
  fields: Record<string, unknown>
  taxYear?: number
  totalIncome?: number
  grossYTD?: number
  warnings?: string[]
}
type UploadEntry = {
  id: string
  fileName: string
  docType?: string
  status: 'uploading' | 'done' | 'error'
  warnings?: string[]
  fieldCount?: number
  error?: string
}

const DOC_HINTS = [
  { value: 'license', label: "Driver's license" },
  { value: 'passport', label: 'Passport' },
  { value: 'green-card', label: 'Green card' },
  { value: 'tax-return', label: 'Tax return (1040)' },
  { value: 'tax-transcript', label: 'IRS tax transcript' },
  { value: 'paystub', label: 'Pay stub' },
  { value: 'other', label: 'Other' },
] as const

export default function Home() {
  const [state, setState] = useState<Record<string, unknown>>({})
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        "Hey — I'll help you fill out your I-864. Upload a photo of your license, green card, passport, or tax transcript on the left. I'll extract what I can and ask you about anything missing.",
    },
  ])
  const [uploads, setUploads] = useState<UploadEntry[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [docHint, setDocHint] = useState<(typeof DOC_HINTS)[number]['value']>('license')
  const [isDragging, setIsDragging] = useState(false)
  const [showSensitive, setShowSensitive] = useState(false)
  const dragCounterRef = useRef(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasKickedOffRef = useRef(false)
  const activeUploadsRef = useRef(0)

  // Auto-kickoff: once the first extraction lands and uploads settle, send a
  // silent "start" message so the assistant proactively asks the first question.
  async function maybeKickoffChat(nextState: Record<string, unknown>) {
    if (hasKickedOffRef.current) return
    if (activeUploadsRef.current > 0) return
    if (Object.keys(nextState).length === 0) return
    hasKickedOffRef.current = true
    setSending(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: nextState,
          messages: [
            {
              role: 'user',
              content:
                '(system kickoff) I just uploaded my documents. Please confirm what you extracted and ask me for the next highest-priority missing field.',
            },
          ],
        }),
      })
      const data = await res.json()
      if (res.ok && data.message) {
        setMessages((m) => [...m, { role: 'assistant', content: data.message }])
        if (data.state) setState(data.state)
      }
    } catch {
      // Silently ignore — user can still type to advance.
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleUpload(file: File) {
    const id = crypto.randomUUID()
    setUploads((u) => [...u, { id, fileName: file.name, status: 'uploading' }])
    activeUploadsRef.current += 1

    const fd = new FormData()
    fd.append('file', file)
    fd.append('hint', docHint)

    try {
      const res = await fetch('/api/extract', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) {
        setUploads((u) =>
          u.map((x) => (x.id === id ? { ...x, status: 'error', error: data.error ?? 'failed' } : x))
        )
        return
      }

      const extraction = data.extraction as ExtractionResult
      const fieldCount = Object.keys(extraction.fields ?? {}).length

      let merged: Record<string, unknown> = {}
      setState((prev) => {
        merged = mergeFields(prev, extraction.fields ?? {})
        return merged
      })

      setUploads((u) =>
        u.map((x) =>
          x.id === id
            ? {
                ...x,
                status: 'done',
                docType: extraction.docType,
                warnings: extraction.warnings,
                fieldCount,
              }
            : x
        )
      )

      activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1)
      // Let state settle, then try kickoff.
      setTimeout(() => maybeKickoffChat(merged), 300)
    } catch (err) {
      activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1)
      setUploads((u) =>
        u.map((x) => (x.id === id ? { ...x, status: 'error', error: String(err) } : x))
      )
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    const nextMessages: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, messages: nextMessages }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: `(error: ${data.error ?? 'unknown'})` },
        ])
        return
      }

      setState(data.state ?? state)
      setMessages((m) => [...m, { role: 'assistant', content: data.message }])

      if (data.needsRepReview) {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: `⚑ Flagged for reviewer: ${data.reviewReason ?? 'legal-strategy question'}`,
          },
        ])
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `(network error: ${String(err)})` },
      ])
    } finally {
      setSending(false)
    }
  }

  const filledCount = countFilledPaths(state)

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold tracking-tight">formcutter</span>
            <span className="text-xs text-neutral-500">I-864 Affidavit of Support</span>
          </div>
          <div className="text-xs text-neutral-500">
            not a law firm · does not provide legal advice
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[380px_1fr]">
        <section className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold">Upload documents</h2>
            <label className="mb-2 block text-xs text-neutral-600">
              What is this document?
              <select
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
                value={docHint}
                onChange={(e) => setDocHint(e.target.value as typeof docHint)}
              >
                {DOC_HINTS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </label>
            <label
              onDragEnter={(e) => {
                e.preventDefault()
                dragCounterRef.current += 1
                if (e.dataTransfer?.types?.includes('Files')) setIsDragging(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                dragCounterRef.current -= 1
                if (dragCounterRef.current <= 0) {
                  dragCounterRef.current = 0
                  setIsDragging(false)
                }
              }}
              onDragOver={(e) => {
                e.preventDefault()
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
              }}
              onDrop={(e) => {
                e.preventDefault()
                dragCounterRef.current = 0
                setIsDragging(false)
                const files = Array.from(e.dataTransfer?.files ?? [])
                for (const f of files) {
                  if (f.type.startsWith('image/') || f.type === 'application/pdf') {
                    handleUpload(f)
                  }
                }
              }}
              className={`block cursor-pointer rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors ${
                isDragging
                  ? 'border-neutral-900 bg-neutral-200 text-neutral-900'
                  : 'border-neutral-300 bg-neutral-50 text-neutral-600 hover:border-neutral-400 hover:bg-neutral-100'
              }`}
            >
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  for (const f of files) handleUpload(f)
                  e.target.value = ''
                }}
              />
              {isDragging ? 'Drop to upload' : 'Drag and drop, or click to upload'}
              <br />
              <span className="text-xs text-neutral-400">png, jpg, or pdf — up to 10MB</span>
            </label>

            {uploads.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs">
                {uploads.map((u) => (
                  <li
                    key={u.id}
                    className={`flex items-center justify-between rounded-md px-2 py-1 ${
                      u.status === 'error'
                        ? 'bg-red-50 text-red-700'
                        : u.status === 'done'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    <span className="truncate">{u.fileName}</span>
                    <span>
                      {u.status === 'uploading'
                        ? '…'
                        : u.status === 'done'
                          ? `${u.fieldCount} fields`
                          : 'failed'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="mb-2 flex items-center justify-between text-sm font-semibold">
              <span>Form state</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSensitive((s) => !s)}
                  className="rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 hover:bg-neutral-100"
                >
                  {showSensitive ? 'hide sensitive' : 'show sensitive'}
                </button>
                <span className="text-xs font-normal text-neutral-500">{filledCount} filled</span>
              </div>
            </h2>
            <pre className="max-h-64 overflow-auto rounded-md bg-neutral-50 p-2 text-[11px] leading-snug text-neutral-700">
              {JSON.stringify(
                showSensitive ? state : maskSensitiveForDisplay(state),
                null,
                2
              )}
            </pre>
          </div>

          <button
            type="button"
            onClick={async () => {
              const res = await fetch('/api/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state }),
              })
              if (!res.ok) {
                alert('PDF generation not yet wired up')
                return
              }
              const blob = await res.blob()
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'i-864-filled.pdf'
              a.click()
              URL.revokeObjectURL(url)
            }}
            disabled={filledCount < 3}
            className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            Generate filled PDF
          </button>
        </section>

        <section className="flex min-h-[600px] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="flex-1 space-y-3 overflow-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                    m.role === 'user'
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-800'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSend} className="border-t border-neutral-200 bg-neutral-50 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={sending ? 'thinking...' : 'type your answer...'}
                disabled={sending}
                className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none disabled:bg-neutral-100"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-tight text-neutral-500">
              Formcutter is not a law firm and does not provide legal advice. Legal-strategy
              questions are flagged for an accredited-representative reviewer.
            </p>
          </form>
        </section>
      </main>
    </div>
  )
}

function mergeFields(
  prev: Record<string, unknown>,
  fields: Record<string, unknown>
): Record<string, unknown> {
  const next = structuredClone(prev) as Record<string, unknown>
  for (const [path, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === '') continue
    const keys = path.split('.')
    let cursor: Record<string, unknown> = next
    for (let i = 0; i < keys.length - 1; i += 1) {
      const k = keys[i]
      const existing = cursor[k]
      if (typeof existing !== 'object' || existing === null || Array.isArray(existing)) {
        cursor[k] = {}
      }
      cursor = cursor[k] as Record<string, unknown>
    }
    cursor[keys[keys.length - 1]] = value
  }
  return next
}

// Schema paths whose value should be masked in the UI unless "show sensitive" is on.
const SENSITIVE_PATHS_UI = ['part4.ssn', 'part2.ssn', 'part4.aNumber', 'part2.aNumber']

function maskSensitiveForDisplay(
  state: Record<string, unknown>
): Record<string, unknown> {
  const clone = structuredClone(state) as Record<string, unknown>
  for (const path of SENSITIVE_PATHS_UI) {
    const keys = path.split('.')
    let cursor: Record<string, unknown> | undefined = clone
    for (let i = 0; i < keys.length - 1; i += 1) {
      const next = cursor?.[keys[i]]
      if (typeof next !== 'object' || next === null) { cursor = undefined; break }
      cursor = next as Record<string, unknown>
    }
    if (cursor) {
      const leaf = keys[keys.length - 1]
      const v = cursor[leaf]
      if (typeof v === 'string' && v.length > 0) {
        const digits = v.replace(/\D/g, '')
        cursor[leaf] = digits.length >= 4 ? `xxx-xx-${digits.slice(-4)}` : 'xxx-xx-xxxx'
      }
    }
  }
  return clone
}

function countFilledPaths(state: Record<string, unknown>, prefix = ''): number {
  let n = 0
  for (const [k, v] of Object.entries(state)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v === null || v === undefined || v === '') continue
    if (typeof v === 'object' && !Array.isArray(v)) {
      n += countFilledPaths(v as Record<string, unknown>, path)
    } else {
      n += 1
    }
  }
  return n
}
