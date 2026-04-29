import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Formcutter — hackathon project (not in operation)',
  description:
    'Formcutter was a 48-hour project built for the Anthropic Opus 4.7 hackathon (April 2026). It is not in active operation.',
  robots: { index: false, follow: false },
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#faf7ee] text-neutral-900 antialiased">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
        <h1 className="font-display text-4xl tracking-tight md:text-5xl">Formcutter</h1>

        <p className="mt-6 text-base leading-relaxed text-neutral-700">
          Formcutter was a 48-hour project built for the Anthropic Opus 4.7 hackathon in April 2026.
        </p>

        <p className="mt-3 text-base leading-relaxed text-neutral-700">
          It is <strong>not in active operation</strong>, does not accept submissions, and is not collecting any user
          data. It is <strong>not a law firm</strong>, does not provide legal advice, and is not affiliated with USCIS,
          EOIR, or any government agency. Anyone needing immigration help should contact a licensed attorney or a{' '}
          <a
            href="https://www.justice.gov/eoir/page/file/942301/dl"
            className="underline decoration-neutral-400 underline-offset-2 hover:decoration-neutral-900"
            rel="noopener noreferrer"
            target="_blank"
          >
            DOJ-recognized organization
          </a>
          .
        </p>

        <div className="mt-10 flex flex-col gap-3 text-sm">
          <a
            href="https://youtu.be/K7qGsYDr61U"
            className="text-neutral-900 underline decoration-neutral-400 underline-offset-4 hover:decoration-neutral-900"
            rel="noopener noreferrer"
            target="_blank"
          >
            Demo video →
          </a>
          <a
            href="https://github.com/adityuhkapoor/formcutter"
            className="text-neutral-900 underline decoration-neutral-400 underline-offset-4 hover:decoration-neutral-900"
            rel="noopener noreferrer"
            target="_blank"
          >
            Source code →
          </a>
        </div>

        <p className="mt-16 text-xs text-neutral-500">© 2026 Aditya Kapoor.</p>
      </div>
    </main>
  )
}
