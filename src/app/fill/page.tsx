'use client'

import { useState, useRef, useEffect, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { useI18n } from '@/lib/i18n/provider'
import { LanguagePicker } from '@/components/LanguagePicker'
import { EvidenceChecklist } from '@/components/EvidenceChecklist'
import { MicButton } from '@/components/MicButton'
import {
  evaluateEvidence,
  I864_EVIDENCE,
  type DocType,
  type UploadedDoc,
} from '@/lib/evidence'
import { FORM_REGISTRY, type FormId } from '@/lib/forms'

type Msg = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  /** Attachment marker — used for "file uploaded" chat bubbles. */
  attachment?: { fileName: string; docType?: string; status: 'uploading' | 'done' | 'error' }
  /** Structured option choices the user can tap instead of typing. */
  options?: string[]
  /** If a Simplify call rewrote the message, store the simplified version. */
  simplified?: string
  /** Whether to render the simplified version (toggled by button). */
  showSimplified?: boolean
}

function makeMsg(
  role: 'user' | 'assistant',
  content: string,
  extra?: Partial<Omit<Msg, 'id'>> & { id?: string }
): Msg {
  return {
    id: extra?.id ?? crypto.randomUUID(),
    role,
    content,
    createdAt: Date.now(),
    ...extra,
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatDateHeader(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}
type ExtractionResult = {
  docType: string
  fields: Record<string, unknown>
  taxYear?: number
  totalIncome?: number
  grossYTD?: number
  warnings?: string[]
  missingComponents?: string[]
  docDate?: string
  mismatchReason?: string
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
  { value: 'license', i18nKey: 'upload.docType.license' },
  { value: 'passport', i18nKey: 'upload.docType.passport' },
  { value: 'green-card', i18nKey: 'upload.docType.greenCard' },
  { value: 'tax-return', i18nKey: 'upload.docType.taxReturn' },
  { value: 'tax-transcript', i18nKey: 'upload.docType.taxTranscript' },
  { value: 'paystub', i18nKey: 'upload.docType.paystub' },
  { value: 'other', i18nKey: 'upload.docType.other' },
] as const

// Build stamp set once at module evaluation on the client. Because this
// module reloads on every Next.js dev rebuild, the stamp bumps whenever
// we actually ship a change. If the stamp doesn't move after refresh,
// the browser served stale JS. Kept client-only to avoid SSR hydration
// mismatch (#1 listed cause per Next.js docs).
const BUILD_STAMP_VALUE = new Date().toISOString().slice(11, 19)

type CaseStatus = 'drafting' | 'pending_review' | 'approved' | 'released'

const LOCAL_CASE_KEY = 'formcutter:caseId'

export default function Home() {
  const { t, lang } = useI18n()
  const searchParams = useSearchParams()
  const requestedFormId = searchParams?.get('formId') as FormId | null
  const [state, setState] = useState<Record<string, unknown>>({})
  const [buildStamp, setBuildStamp] = useState<string>('')
  const [caseId, setCaseId] = useState<string | null>(null)
  const [caseStatus, setCaseStatus] = useState<CaseStatus>('drafting')
  const [formId, setFormId] = useState<FormId>('i-864')
  const [submitting, setSubmitting] = useState(false)
  // Messages start empty to avoid SSR/hydration timestamp drift. Initial
  // greeting is added after mount so Date.now() only runs client-side.
  const [messages, setMessages] = useState<Msg[]>([])
  const [uploads, setUploads] = useState<UploadEntry[]>([])
  const [docs, setDocs] = useState<UploadedDoc[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [docHint, setDocHint] = useState<(typeof DOC_HINTS)[number]['value']>('license')
  const [isDragging, setIsDragging] = useState(false)
  const [showSensitive, setShowSensitive] = useState(false)
  const dragCounterRef = useRef(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasKickedOffRef = useRef(false)
  const activeUploadsRef = useRef(0)

  // Create-or-resume a case on mount. Mix of localStorage for "remember where
  // I was" + a server fetch to verify the case still exists.
  useEffect(() => {
    setBuildStamp(BUILD_STAMP_VALUE)
    ;(async () => {
      const cached = typeof window !== 'undefined'
        ? localStorage.getItem(LOCAL_CASE_KEY)
        : null

      // If a specific form is requested via ?formId and a cached case exists
      // for a DIFFERENT form, drop the cache and start fresh for that form.
      const formRequested =
        requestedFormId && FORM_REGISTRY[requestedFormId] ? requestedFormId : null

      if (cached && !formRequested) {
        const r = await fetch(`/api/case/${cached}`)
        if (r.ok) {
          const data = await r.json()
          setCaseId(data.case.id)
          setCaseStatus(data.case.status)
          setFormId((data.case.formType as FormId) ?? 'i-864')
          setState(data.case.state ?? {})
          setMessages(data.case.messages ?? [])
          return
        }
      }

      const targetForm: FormId = formRequested ?? 'i-864'
      const r = await fetch('/api/case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formType: targetForm }),
      })
      const data = await r.json()
      if (r.ok) {
        setCaseId(data.case.id)
        setCaseStatus(data.case.status)
        setFormId(targetForm)
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_CASE_KEY, data.case.id)
        }
        setMessages([
          makeMsg('assistant', t('chat.greeting')),
        ])
      }
    })()
  }, [])

  // Poll for case status so the immigrant UI reacts when the rep approves.
  useEffect(() => {
    if (!caseId) return
    if (caseStatus !== 'pending_review') return
    const t = setInterval(async () => {
      const r = await fetch(`/api/case/${caseId}`)
      if (!r.ok) return
      const data = await r.json()
      if (data.case?.status && data.case.status !== caseStatus) {
        setCaseStatus(data.case.status)
      }
    }, 2500)
    return () => clearInterval(t)
  }, [caseId, caseStatus])

  // Autosave state + messages to the case.
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!caseId || caseStatus !== 'drafting') return
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(async () => {
      await fetch(`/api/case/${caseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state,
          messages,
          displayName: deriveDisplayName(state),
        }),
      })
    }, 400)
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    }
    // intentionally omit deps we don't want to trigger on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, messages, caseId, caseStatus])

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
          language: lang,
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
        setMessages((m) => [
          ...m,
          makeMsg('assistant', data.message, { options: data.options }),
        ])
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
    // Single chat bubble whose attachment status updates in place.
    const msgId = crypto.randomUUID()
    setMessages((m) => [
      ...m,
      makeMsg('user', '', {
        id: msgId,
        attachment: { fileName: file.name, status: 'uploading' },
      }),
    ])

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

      // Track the uploaded doc against our evidence requirements.
      setDocs((prev) => [
        ...prev,
        {
          id,
          fileName: file.name,
          claimedType: docHint as DocType,
          detectedType: (extraction.docType as DocType) ?? 'other',
          warnings: extraction.warnings ?? [],
          docDate: extraction.docDate ? new Date(extraction.docDate) : undefined,
          uploadedAt: new Date(),
        },
      ])

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
      // Flip the attachment bubble from uploading → done in place.
      setMessages((m) =>
        m.map((x) =>
          x.id === msgId
            ? {
                ...x,
                attachment: {
                  fileName: file.name,
                  docType: extraction.docType,
                  status: 'done',
                },
              }
            : x
        )
      )
      // Let state settle, then try kickoff.
      setTimeout(() => maybeKickoffChat(merged), 300)
    } catch (err) {
      activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1)
      setUploads((u) =>
        u.map((x) => (x.id === id ? { ...x, status: 'error', error: String(err) } : x))
      )
      setMessages((m) =>
        m.map((x) =>
          x.id === msgId
            ? { ...x, attachment: { fileName: file.name, status: 'error' } }
            : x
        )
      )
    }
  }

  async function sendText(text: string) {
    if (!text || sending) return

    const userMsg = makeMsg('user', text)
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setSending(true)

    // Flatten to a wire format the API expects (role + content only).
    const wireMessages = nextMessages
      .filter((m) => m.content || !m.attachment) // skip pure-attachment bubbles
      .map((m) => ({
        role: m.role,
        content: m.content || (m.attachment ? `[uploaded ${m.attachment.fileName}]` : ''),
      }))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, messages: wireMessages, language: lang }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessages((m) => [
          ...m,
          makeMsg('assistant', `(error: ${data.error ?? 'unknown'})`),
        ])
        return
      }

      setState(data.state ?? state)
      setMessages((m) => [
        ...m,
        makeMsg('assistant', data.message, { options: data.options }),
      ])

      if (data.needsRepReview) {
        setMessages((m) => [
          ...m,
          makeMsg(
            'assistant',
            `⚑ Flagged for reviewer: ${data.reviewReason ?? 'legal-strategy question'}`
          ),
        ])
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        makeMsg('assistant', `(network error: ${String(err)})`),
      ])
    } finally {
      setSending(false)
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    setInput('')
    await sendText(text)
  }

  async function simplifyMessage(messageId: string) {
    const target = messages.find((m) => m.id === messageId)
    if (!target) return
    // If already simplified, just toggle visibility.
    if (target.simplified) {
      setMessages((m) =>
        m.map((x) => (x.id === messageId ? { ...x, showSimplified: !x.showSimplified } : x))
      )
      return
    }
    try {
      const r = await fetch('/api/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: target.content, language: lang }),
      })
      if (!r.ok) return
      const data = await r.json()
      setMessages((m) =>
        m.map((x) =>
          x.id === messageId ? { ...x, simplified: data.simplified, showSimplified: true } : x
        )
      )
    } catch {
      // silent fail — button just does nothing
    }
  }

  const filledCount = countFilledPaths(state)
  const evidence = evaluateEvidence({
    requirements: I864_EVIDENCE,
    docs,
    state,
  })

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold tracking-tight">{t('header.brand')}</span>
            <span className="text-xs text-neutral-500">
              {FORM_REGISTRY[formId]?.name.replace(`${formId.toUpperCase()} `, '') ?? t('header.subtitle')}
            </span>
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-600">
              {formId}
            </span>
            <StatusBadge status={caseStatus} />
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <span>{t('header.disclaimer')}</span>
            <a
              href="/start"
              className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:border-neutral-900 hover:bg-neutral-100"
            >
              Not sure which form you need?
            </a>
            <LanguagePicker />
            {buildStamp && (
              <span className="font-mono text-[10px] text-neutral-400" suppressHydrationWarning>
                build {buildStamp}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[380px_1fr]">
        <section className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold">{t('upload.heading')}</h2>
            <label className="mb-2 block text-xs text-neutral-600">
              {t('upload.docType.label')}
              <select
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
                value={docHint}
                onChange={(e) => setDocHint(e.target.value as typeof docHint)}
              >
                {DOC_HINTS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {t(h.i18nKey as Parameters<typeof t>[0])}
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
              {isDragging ? t('upload.dropzone.dragging') : t('upload.dropzone.idle')}
              <br />
              <span className="text-xs text-neutral-400">{t('upload.dropzone.hint')}</span>
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

          <EvidenceChecklist items={evidence} />

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="mb-2 flex items-center justify-between text-sm font-semibold">
              <span>{t('state.heading')}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSensitive((s) => !s)}
                  className="rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 hover:bg-neutral-100"
                >
                  {showSensitive ? t('state.hideSensitive') : t('state.showSensitive')}
                </button>
                <span className="text-xs font-normal text-neutral-500">
                  {t('state.filledCount', { count: filledCount })}
                </span>
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

          {/* Status banner — changes with case lifecycle. */}
          {caseStatus === 'pending_review' && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs">
              <div className="font-semibold text-amber-900">{t('banner.pendingReview.title')}</div>
              <p className="mt-1 text-amber-800">{t('banner.pendingReview.body')}</p>
            </div>
          )}

          {caseStatus === 'approved' && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs">
              <div className="font-semibold text-emerald-900">{t('banner.approved.title')}</div>
              <p className="mt-1 text-emerald-800">{t('banner.approved.body')}</p>
            </div>
          )}

          {caseStatus === 'drafting' ? (
            <button
              type="button"
              disabled={submitting || filledCount < 3 || !caseId}
              onClick={async () => {
                if (!caseId) return
                setSubmitting(true)
                try {
                  const r = await fetch(`/api/case/${caseId}/submit`, { method: 'POST' })
                  if (r.ok) {
                    setCaseStatus('pending_review')
                  } else {
                    alert('Submit failed. Check server logs.')
                  }
                } finally {
                  setSubmitting(false)
                }
              }}
              className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {submitting ? t('action.submitting') : t('action.submit')}
            </button>
          ) : (
            <button
              type="button"
              disabled={caseStatus !== 'approved' || !caseId}
              onClick={async () => {
                const res = await fetch('/api/pdf', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ state, formId }),
                })
                if (!res.ok) return
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${formId}-filled.pdf`
                a.click()
                URL.revokeObjectURL(url)
              }}
              className={`w-full rounded-lg px-4 py-2 text-sm font-medium text-white ${
                caseStatus === 'approved'
                  ? 'bg-emerald-700 hover:bg-emerald-800'
                  : 'cursor-not-allowed bg-neutral-300'
              }`}
            >
              {caseStatus === 'approved' ? t('action.download') : t('action.downloadLocked')}
            </button>
          )}

          {/* Reset case — useful for demo resets without losing dev-server state. */}
          <button
            type="button"
            onClick={async () => {
              if (typeof window !== 'undefined') {
                localStorage.removeItem(LOCAL_CASE_KEY)
              }
              window.location.reload()
            }}
            className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-1.5 text-[11px] font-medium text-neutral-500 hover:bg-neutral-50"
          >
            {t('action.newCase')}
          </button>
        </section>

        <section className="flex min-h-[600px] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="flex-1 space-y-2 overflow-auto p-4">
            {messages.map((m, i) => {
              const prev = messages[i - 1]
              const showDateHeader =
                !prev ||
                new Date(prev.createdAt).toDateString() !==
                  new Date(m.createdAt).toDateString()
              const showSpeakerHeader =
                m.role === 'assistant' &&
                (!prev || prev.role !== 'assistant' || (prev.createdAt && m.createdAt - prev.createdAt > 60_000))

              return (
                <div key={m.id}>
                  {showDateHeader && (
                    <div className="my-3 flex items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-400">
                      <div className="h-px flex-1 bg-neutral-200" />
                      <span>{formatDateHeader(m.createdAt)}</span>
                      <div className="h-px flex-1 bg-neutral-200" />
                    </div>
                  )}

                  {/* Attachment bubble (user-side upload marker) */}
                  {m.attachment && (
                    <div className="flex justify-end">
                      <div
                        className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${
                          m.attachment.status === 'uploading'
                            ? 'border-neutral-200 bg-neutral-50 text-neutral-500'
                            : m.attachment.status === 'error'
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : 'border-neutral-200 bg-white text-neutral-700'
                        }`}
                      >
                        <span className="text-base">📎</span>
                        <span className="font-medium">{m.attachment.fileName}</span>
                        <span className="text-neutral-400">
                          ·{' '}
                          {m.attachment.status === 'uploading'
                            ? 'extracting...'
                            : m.attachment.status === 'error'
                              ? 'failed'
                              : m.attachment.docType?.replace('-', ' ') ?? 'done'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Text bubble (skip if this is a pure-attachment message) */}
                  {m.content && (
                    <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className="flex max-w-[85%] flex-col">
                        {showSpeakerHeader && (
                          <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-medium text-neutral-600">
                            <span className="inline-block h-4 w-4 rounded-full bg-neutral-900" />
                            {t('chat.formcutterAi')}
                          </div>
                        )}
                        <div
                          className={`rounded-2xl px-3 py-2 text-sm leading-snug ${
                            m.role === 'user'
                              ? 'bg-neutral-900 text-white'
                              : 'bg-neutral-100 text-neutral-800'
                          }`}
                        >
                          {m.role === 'assistant' ? (
                            <div className="prose-chat">
                              <ReactMarkdown
                                key={m.showSimplified ? 'simple' : 'original'}
                                components={{
                                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                  ul: ({ children }) => (
                                    <ul className="mb-2 list-disc pl-4 last:mb-0">{children}</ul>
                                  ),
                                  ol: ({ children }) => (
                                    <ol className="mb-2 list-decimal pl-4 last:mb-0">{children}</ol>
                                  ),
                                  li: ({ children }) => <li className="mb-0.5">{children}</li>,
                                  strong: ({ children }) => (
                                    <strong className="font-semibold text-neutral-900">
                                      {children}
                                    </strong>
                                  ),
                                  em: ({ children }) => <em className="italic">{children}</em>,
                                  code: ({ children }) => (
                                    <code className="rounded bg-neutral-200 px-1 py-0.5 font-mono text-[11px]">
                                      {children}
                                    </code>
                                  ),
                                  a: ({ children, href }) => (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="underline"
                                    >
                                      {children}
                                    </a>
                                  ),
                                }}
                              >
                                {m.showSimplified && m.simplified ? m.simplified : m.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            m.content
                          )}
                        </div>
                        <div
                          className={`mt-0.5 flex items-center gap-2 px-1 text-[10px] text-neutral-400 ${
                            m.role === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <span>{formatTime(m.createdAt)}</span>
                          {m.role === 'assistant' && (
                            <button
                              type="button"
                              onClick={() => simplifyMessage(m.id)}
                              className="underline-offset-2 hover:text-neutral-700 hover:underline"
                            >
                              {m.showSimplified ? 'Original' : t('chat.simplify')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tappable option chips under the assistant's message */}
                  {m.role === 'assistant' && m.options && m.options.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2 pl-1">
                      {m.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          disabled={sending}
                          onClick={() => sendText(opt)}
                          className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:border-neutral-900 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSend} className="border-t border-neutral-200 bg-neutral-50 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  caseStatus !== 'drafting'
                    ? t('chat.locked')
                    : sending
                      ? t('chat.thinking')
                      : t('chat.inputPlaceholder')
                }
                disabled={sending || caseStatus !== 'drafting'}
                className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none disabled:bg-neutral-100"
              />
              <MicButton
                disabled={sending || caseStatus !== 'drafting'}
                onTranscript={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))}
              />
              <button
                type="submit"
                disabled={sending || !input.trim() || caseStatus !== 'drafting'}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {t('chat.send')}
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-tight text-neutral-500">
              {t('chat.footer.disclaimer')}
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

function StatusBadge({ status }: { status: CaseStatus }) {
  const { t } = useI18n()
  const meta = {
    drafting: { key: 'status.drafting' as const, cls: 'bg-neutral-100 text-neutral-700' },
    pending_review: { key: 'status.pendingReview' as const, cls: 'bg-amber-100 text-amber-800' },
    approved: { key: 'status.approved' as const, cls: 'bg-emerald-100 text-emerald-800' },
    released: { key: 'status.released' as const, cls: 'bg-emerald-100 text-emerald-800' },
  }[status]
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${meta.cls}`}
    >
      {t(meta.key)}
    </span>
  )
}

function deriveDisplayName(state: Record<string, unknown>): string | null {
  const family = ((state as Record<string, Record<string, Record<string, unknown>>>)
    .part4?.name?.familyName as string | undefined)
  const given = ((state as Record<string, Record<string, Record<string, unknown>>>)
    .part4?.name?.givenName as string | undefined)
  if (!family && !given) return null
  return [given, family].filter(Boolean).join(' ')
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
