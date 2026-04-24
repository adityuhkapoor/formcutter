'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/provider'
import { LANGUAGES } from '@/lib/i18n/provider'

/**
 * Push-to-talk mic button using the browser's Web Speech API.
 * - Hold (mousedown/touchstart) to start listening.
 * - Release to stop; transcript is appended to the caller's input state.
 * - Respects the currently-selected language (SpeechRecognition.lang).
 * - Fails gracefully on unsupported browsers (button stays disabled).
 */
export function MicButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void
  disabled?: boolean
}) {
  const { lang, t } = useI18n()
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recRef = useRef<unknown>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR =
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    setSupported(Boolean(SR))
  }, [])

  function start() {
    if (listening || disabled) return
    const SR =
      (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition
    if (!SR) return

    const meta = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new (SR as any)()
    rec.lang = meta.speechLang
    rec.interimResults = true
    rec.continuous = false

    let transcript = ''
    rec.onresult = (e: unknown) => {
      const event = e as { results: Array<{ 0: { transcript: string }; isFinal: boolean }> }
      transcript = ''
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript
      }
    }
    rec.onend = () => {
      setListening(false)
      const text = transcript.trim()
      if (text) onTranscript(text)
    }
    rec.onerror = () => {
      setListening(false)
    }

    try {
      rec.start()
      recRef.current = rec
      setListening(true)
    } catch {
      // already-started or other failure
      setListening(false)
    }
  }

  function stop() {
    const rec = recRef.current as { stop: () => void } | null
    if (rec && listening) {
      try { rec.stop() } catch { /* ignore */ }
    }
  }

  if (!supported) return null

  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      title={listening ? t('chat.mic.listening') : t('chat.mic.start')}
      className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
        listening
          ? 'border-red-400 bg-red-50 text-red-700 animate-pulse'
          : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900 hover:bg-neutral-100'
      } disabled:cursor-not-allowed disabled:opacity-50`}
      aria-label={listening ? t('chat.mic.listening') : t('chat.mic.start')}
    >
      {listening ? '🎙 …' : '🎙'}
    </button>
  )
}
