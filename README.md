# Formcutter

> **⚠️ Not in active operation.** Formcutter was a 48-hour project built for the Anthropic Opus 4.7 hackathon in April 2026. It does not accept submissions, does not collect any user data, is **not a law firm**, does not provide legal advice, and is not affiliated with USCIS, EOIR, or any government agency. The live site at formcutter.ai serves a static disclaimer only; all API routes return `410 Gone`. Anyone needing immigration help should contact a licensed attorney or a [DOJ-recognized organization](https://www.justice.gov/eoir/page/file/942301/dl).

This repository is preserved as a portfolio artifact. The code below describes what the project *was* during the hackathon — it is not a description of a running service.

---

## What it was

An AI-assisted USCIS form-filler. Users could photograph their documents (driver's license, passport, tax transcript, etc.), chat through eligibility gaps, and receive a filled PDF — with a DOJ-accredited representative review step before any filing.

Forms supported during the hackathon: I-864, I-130, N-400, I-485, I-90, I-765, I-131, I-589.

## Stack

Next.js 16 · TypeScript · Tailwind · shadcn/ui · Claude Opus 4.7 (multimodal extraction + reasoning) · pdf-lib · Drizzle ORM + SQLite.

## Demo

- Video: https://youtu.be/K7qGsYDr61U
- Live (static disclaimer only): https://formcutter.ai

## License

MIT.
