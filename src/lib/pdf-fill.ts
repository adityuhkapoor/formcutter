import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFBool,
  PDFHexString,
  PDFString,
  StandardFonts,
  rgb,
} from 'pdf-lib'
import fs from 'node:fs/promises'
import path from 'node:path'
import { flattenPaths } from './field-paths'
import { resolveSchemaPath, type WidgetValue } from './i864-widget-map'

/**
 * Fills the blank I-864 by setting /V on native form widgets — the same thing
 * Adobe Reader does when a human types into the blue boxes. Viewers regenerate
 * the widget appearance streams from /V + the AcroForm /DA (default appearance),
 * so text lands in the correct box with the correct font automatically.
 *
 * The output also has a cover sheet prepended summarizing filled fields for
 * reviewer inspection.
 */
export async function fillI864(
  state: Record<string, unknown>
): Promise<Uint8Array> {
  const blankPath = path.join(process.cwd(), 'public', 'forms', 'i-864.pdf')
  const blankBytes = await fs.readFile(blankPath)
  const pdf = await PDFDocument.load(blankBytes, { ignoreEncryption: true })

  // Build widget-name → PDFDict index by walking every page's /Annots.
  const widgetsByName = new Map<string, PDFDict>()
  for (const page of pdf.getPages()) {
    const annots = page.node.lookup(PDFName.of('Annots'))
    if (!(annots instanceof PDFArray)) continue
    for (let j = 0; j < annots.size(); j++) {
      const a = annots.lookup(j)
      if (!(a instanceof PDFDict)) continue
      if (a.get(PDFName.of('Subtype'))?.toString() !== '/Widget') continue
      const name = decodePdfString(a.get(PDFName.of('T')))
      if (name) widgetsByName.set(name, a)
    }
  }

  // Apply every schema path that resolved to a widget.
  const flat = flattenPaths(state)
  const applied: Array<{ path: string; widget: string; display: string }> = []
  const unresolved: string[] = []

  for (const [schemaPath, value] of Object.entries(flat)) {
    const resolves = resolveSchemaPath(schemaPath, value)
    if (resolves.length === 0) {
      unresolved.push(schemaPath)
      continue
    }
    for (const { widget, value: wv } of resolves) {
      const dict = widgetsByName.get(widget)
      if (!dict) {
        unresolved.push(`${schemaPath} → ${widget} (widget not found)`)
        continue
      }
      if (wv.kind === 'text') {
        setTextValue(dict, wv.value)
      } else if (wv.kind === 'checkbox') {
        setCheckboxValue(dict, wv.checked)
      }
      applied.push({ path: schemaPath, widget, display: describe(wv) })
    }
  }

  // Make viewers regenerate widget appearances from the new /V.
  const acroForm = pdf.catalog.lookup(PDFName.of('AcroForm'))
  if (acroForm instanceof PDFDict) {
    acroForm.set(PDFName.of('NeedAppearances'), PDFBool.True)
  }

  // Build a fresh output doc starting with a cover sheet, then copy the
  // mutated blank pages in. (insertPage on the blank crashes because its
  // page tree has dangling refs; copyPages routes around that.)
  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)
  const bold = await out.embedFont(StandardFonts.HelveticaBold)

  const cover = out.addPage([612, 792])
  cover.drawText('FORMCUTTER — I-864 DRAFT', {
    x: 60,
    y: 730,
    size: 18,
    font: bold,
    color: rgb(0, 0, 0),
  })
  cover.drawText('Generated from uploaded documents + user chat. For reviewer inspection.', {
    x: 60,
    y: 708,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  })
  cover.drawText('Not a law firm. Not legal advice. Sign Part 8 only after accredited-rep review.', {
    x: 60,
    y: 694,
    size: 10,
    font,
    color: rgb(0.6, 0.1, 0.1),
  })
  cover.drawText(new Date().toISOString(), {
    x: 60,
    y: 678,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  })

  let y = 640
  cover.drawText(`Filled fields (${applied.length}):`, {
    x: 60,
    y,
    size: 11,
    font: bold,
    color: rgb(0, 0, 0),
  })
  y -= 16
  for (const row of applied.slice(0, 35)) {
    if (y < 80) break
    const line = `${row.path.padEnd(50)} = ${truncate(row.display, 30)}`
    cover.drawText(line, { x: 60, y, size: 8, font, color: rgb(0.1, 0.1, 0.1) })
    y -= 10
  }
  if (unresolved.length) {
    y -= 8
    cover.drawText(`Unresolved (${unresolved.length}): needs rep review`, {
      x: 60,
      y,
      size: 9,
      font: bold,
      color: rgb(0.6, 0.1, 0.1),
    })
    y -= 12
    for (const u of unresolved.slice(0, 10)) {
      if (y < 60) break
      cover.drawText(`  - ${truncate(u, 80)}`, {
        x: 60,
        y,
        size: 7,
        font,
        color: rgb(0.4, 0.1, 0.1),
      })
      y -= 9
    }
  }

  const copied = await out.copyPages(pdf, pdf.getPageIndices())
  for (const p of copied) out.addPage(p)

  return await out.save()
}

// ─── Helpers ────────────────────────────────────────────────────────────

function decodePdfString(node: unknown): string | null {
  if (!node || typeof (node as { toString?: () => string }).toString !== 'function') {
    return null
  }
  const s = (node as { toString: () => string }).toString()
  if (s.startsWith('<feff')) {
    const hex = s.slice(5, -1)
    let out = ''
    for (let i = 0; i < hex.length; i += 4) {
      const code = parseInt(hex.slice(i, i + 4), 16)
      if (code) out += String.fromCharCode(code)
    }
    return out
  }
  if (s.startsWith('(') && s.endsWith(')')) {
    return s
      .slice(1, -1)
      .replace(/\\(\(|\)|\\)/g, '$1')
  }
  return s
}

/** Encode a JS string as PDF UTF-16BE hex (with BOM). */
function encodeUtf16BeHex(value: string): string {
  const withBom = '﻿' + value
  return Buffer.from(withBom, 'utf16le').swap16().toString('hex')
}

function setTextValue(widget: PDFDict, value: string): void {
  const ft = widget.get(PDFName.of('FT'))?.toString()
  // Choice (/Ch) widgets are dropdowns — their /V must match an /Opt export
  // value, which is a plain PDFString. Tx widgets accept HexString safely.
  const valueObj = ft === '/Ch'
    ? PDFString.of(value)
    : PDFHexString.of(encodeUtf16BeHex(value))
  widget.set(PDFName.of('V'), valueObj)
  widget.set(PDFName.of('DV'), valueObj)
  widget.delete(PDFName.of('AP'))
}

function setCheckboxValue(widget: PDFDict, checked: boolean): void {
  // Checkboxes use /Yes or /Off as their /V. Most USCIS widgets use /Yes as the "on" state.
  widget.set(PDFName.of('V'), PDFName.of(checked ? 'Yes' : 'Off'))
  widget.set(PDFName.of('AS'), PDFName.of(checked ? 'Yes' : 'Off'))
  widget.delete(PDFName.of('AP'))
}

function describe(wv: WidgetValue): string {
  if (wv.kind === 'text') return wv.value
  return wv.checked ? '[x]' : '[ ]'
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}
