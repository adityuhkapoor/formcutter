import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'node:fs/promises'
import path from 'node:path'
import { I864_MAPPINGS } from './i864-coordinates'

/**
 * Renders a flattened, filled I-864 PDF by overlaying text at hand-mapped
 * coordinates on top of the blank USCIS form.
 *
 * We can't touch the XFA form fields, so we ignore them entirely — the output
 * is a plain PDF that Lockbox scanners will OCR the same way they do a
 * printed+handwritten form.
 *
 * The output also has a prepended COVER SHEET listing every filled value
 * with its schema path — useful for (a) the rep reviewer, (b) debugging,
 * (c) the hackathon demo where the judge wants to see something readable.
 */
export async function fillI864(
  state: Record<string, unknown>
): Promise<Uint8Array> {
  const blankPath = path.join(process.cwd(), 'public', 'forms', 'i-864.pdf')
  const blankBytes = await fs.readFile(blankPath)

  const pdf = await PDFDocument.load(blankBytes, { ignoreEncryption: true })
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const pages = pdf.getPages()

  // ─── Draw each mapped field ───────────────────────────────────────────
  for (const mapping of I864_MAPPINGS) {
    const text = mapping.render(state)
    if (!text) continue
    const page = pages[mapping.page]
    if (!page) continue
    page.drawText(text, {
      x: mapping.x,
      y: mapping.y,
      size: mapping.fontSize ?? 10,
      font,
      color: rgb(0.05, 0.05, 0.4),
    })
  }

  // ─── Cover sheet: separate 1-page PDF merged on top ───────────────────
  // insertPage() fails on the XFA-encoded I-864 due to dangling object refs,
  // so we build a fresh doc for the cover and copy the blank's pages into it.
  const out = await PDFDocument.create()
  const outFont = await out.embedFont(StandardFonts.Helvetica)
  const outBold = await out.embedFont(StandardFonts.HelveticaBold)

  const cover = out.addPage([612, 792])
  cover.drawText('FORMCUTTER — I-864 DRAFT', {
    x: 60,
    y: 730,
    size: 18,
    font: outBold,
    color: rgb(0, 0, 0),
  })
  cover.drawText('Generated from uploaded documents + user chat. For reviewer inspection.', {
    x: 60,
    y: 708,
    size: 10,
    font: outFont,
    color: rgb(0.3, 0.3, 0.3),
  })
  cover.drawText('Not a law firm. Not legal advice. Sign Part 8 only after accredited-rep review.', {
    x: 60,
    y: 694,
    size: 10,
    font: outFont,
    color: rgb(0.6, 0.1, 0.1),
  })
  cover.drawText(new Date().toISOString(), {
    x: 60,
    y: 678,
    size: 9,
    font: outFont,
    color: rgb(0.5, 0.5, 0.5),
  })

  let y = 640
  const flat = flattenLeaves(state)
  cover.drawText(`Filled fields (${flat.length}):`, {
    x: 60,
    y,
    size: 11,
    font: outBold,
    color: rgb(0, 0, 0),
  })
  y -= 20
  for (const { path: p, value } of flat.slice(0, 40)) {
    if (y < 60) break
    const line = `${p.padEnd(55)} ${truncate(String(value), 40)}`
    cover.drawText(line, { x: 60, y, size: 8, font: outFont, color: rgb(0.1, 0.1, 0.1) })
    y -= 11
  }

  // Copy the (already-overlayed) blank pages into the output document.
  const pageIndices = pdf.getPageIndices()
  const copied = await out.copyPages(pdf, pageIndices)
  for (const p of copied) out.addPage(p)

  return await out.save()
}

function flattenLeaves(
  obj: Record<string, unknown>,
  prefix = ''
): Array<{ path: string; value: unknown }> {
  const out: Array<{ path: string; value: unknown }> = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v === null || v === undefined || v === '') continue
    if (Array.isArray(v)) {
      out.push({ path, value: `[${v.length} items]` })
    } else if (typeof v === 'object') {
      out.push(...flattenLeaves(v as Record<string, unknown>, path))
    } else {
      out.push({ path, value: v })
    }
  }
  return out
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}
