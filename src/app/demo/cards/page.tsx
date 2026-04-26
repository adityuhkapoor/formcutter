'use client'

import { useEffect, useState } from 'react'

/**
 * /demo/cards — full-screen cold-open card sequence for the demo video.
 *
 * Plays 3 stat cards on a timer with the same cream + drifting-blob aesthetic
 * as the home page so the cold-open and product walk read as one piece.
 * Designed to be screen-recorded in a single pass:
 *
 *   1. Press R to record. 1.5s of blank cream.
 *   2. Card 1 fades in, holds, fades out (3s default).
 *   3. Card 2 same.
 *   4. Card 3 same.
 *   5. Hold on the last card 1s extra so you have a clean cut point.
 *
 * Override pacing via URL query: `?seconds=4` slows each card to 4s.
 * Auto-restart loop with `?loop=1` for testing without a hard refresh.
 *
 * Not linked from the app shell — accessed only by typing the URL when
 * recording. Hide from production builds if formcutter ships beyond the demo.
 */

type Card = {
  number: string
  caption: string
  /** Optional small footnote / source line beneath the caption. */
  source?: string
  /** Tailwind size class override for long numbers that would wrap at 9xl. */
  numberSizeClass?: string
}

const CARDS: Card[] = [
  {
    number: '13,400',
    caption: 'foreign-born residents in Broome County, NY.',
    source: 'U.S. Census Bureau, ACS 2024',
  },
  {
    number: '2',
    caption: 'DOJ-accredited representatives at the only nonprofit serving them.',
    source: 'DOJ EOIR Recognition & Accreditation Roster',
  },
  {
    number: '$2,000–$10,000+',
    caption: 'to hire a lawyer instead.',
    source: 'Avg. attorney fees for a family-based green card, 2025',
    numberSizeClass: 'text-5xl md:text-6xl lg:text-7xl',
  },
]

const LEAD_BLANK_MS = 1500
const TAIL_HOLD_MS = 1000

export default function DemoCardsPage() {
  const [active, setActive] = useState<number>(-1) // -1 = lead blank
  const [secondsPerCard, setSecondsPerCard] = useState(3)
  const [loop, setLoop] = useState(false)

  // Read URL params client-side so the page works in the browser without a
  // server roundtrip. searchParams in App Router would also work but adds
  // a Suspense boundary for one-line ergonomics — overkill here.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    const sec = Number(sp.get('seconds'))
    if (Number.isFinite(sec) && sec > 0 && sec <= 30) setSecondsPerCard(sec)
    if (sp.get('loop') === '1') setLoop(true)
  }, [])

  // Sequence runner — chains setTimeouts so each card transition is its
  // own discrete tick. Cleanup cancels the chain on unmount or restart so
  // hot-reload doesn't double-fire.
  useEffect(() => {
    const handles: ReturnType<typeof setTimeout>[] = []

    handles.push(
      setTimeout(() => setActive(0), LEAD_BLANK_MS)
    )
    for (let i = 1; i < CARDS.length; i++) {
      handles.push(
        setTimeout(
          () => setActive(i),
          LEAD_BLANK_MS + i * secondsPerCard * 1000
        )
      )
    }
    if (loop) {
      const total =
        LEAD_BLANK_MS + CARDS.length * secondsPerCard * 1000 + TAIL_HOLD_MS
      handles.push(setTimeout(() => setActive(-1), total))
    }

    return () => handles.forEach(clearTimeout)
  }, [secondsPerCard, loop])

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#faf7ee] text-neutral-900">
      {/* Same drifting blob wash as the home page — keeps the cold open and
       * landing visually continuous when cut together in the edit. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="fc-motion-blob absolute left-[-8%] top-[-12%] h-[36rem] w-[36rem] rounded-full bg-amber-200/80 blur-2xl"
          style={{ animation: 'fc-blob-1 22s ease-in-out infinite' }}
        />
        <div
          className="fc-motion-blob absolute right-[-10%] top-[8%] h-[42rem] w-[42rem] rounded-full bg-sky-200/75 blur-2xl"
          style={{ animation: 'fc-blob-2 26s ease-in-out infinite' }}
        />
        <div
          className="fc-motion-blob absolute bottom-[-18%] left-[18%] h-[38rem] w-[38rem] rounded-full bg-emerald-200/65 blur-2xl"
          style={{ animation: 'fc-blob-3 30s ease-in-out infinite' }}
        />
      </div>

      {/* Each card is absolutely-positioned in the same slot; opacity +
       * translate transition cross-fades them without layout shift. */}
      <div className="relative w-full max-w-3xl px-6 text-center">
        {CARDS.map((card, i) => (
          <div
            key={i}
            aria-hidden={active !== i}
            className={`absolute inset-x-0 top-1/2 -translate-y-1/2 transition-all duration-700 ease-out ${
              active === i
                ? 'opacity-100 translate-y-[-50%]'
                : 'pointer-events-none opacity-0 translate-y-[calc(-50%+12px)]'
            }`}
          >
            <div
              className={`font-display tracking-tight ${
                card.numberSizeClass ?? 'text-7xl md:text-8xl lg:text-9xl'
              }`}
            >
              {card.number}
            </div>
            <p className="mt-4 mx-auto max-w-xl text-lg text-neutral-700 md:text-xl">
              {card.caption}
            </p>
            {card.source && (
              <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                {card.source}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
