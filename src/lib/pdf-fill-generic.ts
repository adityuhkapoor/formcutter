import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'node:fs/promises'
import path from 'node:path'
import { flattenPaths } from './field-paths'
import { getAutoMap, FORM_REGISTRY, type FormId } from './forms'

/**
 * Generic PDF filler for auto-mapped forms (I-130, I-485, N-400). Uses pdf-lib's
 * native form API — same technique as I-864 — but relies on the generated
 * schema→widget map rather than hand-tuned per-field renderers.
 *
 * For fields that need special handling (SSN digit-only, dates, money), we use
 * heuristics: if value is a string matching ^\d{4}-\d{2}-\d{2}$ we assume ISO
 * date and reformat; strip non-digits on clearly-numeric widgets (recognised
 * via maxLength <= 10).
 */
export async function fillForm(formId: FormId, state: Record<string, unknown>): Promise<Uint8Array> {
  const meta = FORM_REGISTRY[formId]
  const pdfPath = path.join(process.cwd(), meta.pdfPath)
  const blankBytes = await fs.readFile(pdfPath)
  const pdf = await PDFDocument.load(blankBytes, { ignoreEncryption: true })

  const form = pdf.getForm()
  const mapping = getAutoMap(formId)
  const flat = flattenPaths(state)

  const applied: Array<{ path: string; widget: string; value: string }> = []
  const skipped: string[] = []

  for (const [schemaPath, widgetName] of Object.entries(mapping)) {
    const raw = flat[schemaPath]
    if (raw === undefined || raw === null || raw === '') {
      continue
    }
    const applied_ = tryApply(form, widgetName, raw)
    if (applied_) {
      applied.push({ path: schemaPath, widget: widgetName, value: applied_ })
    } else {
      skipped.push(`${schemaPath} → ${widgetName}`)
    }
  }

  try {
    form.updateFieldAppearances()
  } catch (err) {
    console.error('updateFieldAppearances partial failure:', err)
  }

  // Cover sheet + copied pages.
  const out = await PDFDocument.create()
  const helv = await out.embedFont(StandardFonts.Helvetica)
  const helvBold = await out.embedFont(StandardFonts.HelveticaBold)

  const cover = out.addPage([612, 792])
  cover.drawText(`FORMCUTTER - ${meta.id.toUpperCase()} DRAFT`, {
    x: 60,
    y: 730,
    size: 18,
    font: helvBold,
  })
  cover.drawText(meta.name, { x: 60, y: 712, size: 12, font: helv, color: rgb(0.3, 0.3, 0.3) })
  cover.drawText('Generated via Formcutter. For reviewer inspection.', {
    x: 60,
    y: 696,
    size: 10,
    font: helv,
    color: rgb(0.3, 0.3, 0.3),
  })
  cover.drawText('Not a law firm. Not legal advice. Sign only after reviewer approval.', {
    x: 60,
    y: 682,
    size: 10,
    font: helv,
    color: rgb(0.6, 0.1, 0.1),
  })
  cover.drawText(new Date().toISOString(), {
    x: 60,
    y: 668,
    size: 9,
    font: helv,
    color: rgb(0.5, 0.5, 0.5),
  })

  let y = 636
  cover.drawText(`Filled fields (${applied.length}):`, {
    x: 60,
    y,
    size: 11,
    font: helvBold,
  })
  y -= 16
  for (const row of applied.slice(0, 42)) {
    if (y < 80) break
    cover.drawText(`${row.path.padEnd(40)} = ${row.value.slice(0, 30)}`, {
      x: 60,
      y,
      size: 8,
      font: helv,
    })
    y -= 10
  }

  const copied = await out.copyPages(pdf, pdf.getPageIndices())
  for (const p of copied) out.addPage(p)
  return await out.save()
}

function tryApply(
  form: ReturnType<PDFDocument['getForm']>,
  widgetName: string,
  raw: unknown
): string | null {
  try {
    // Try as text field first (most common).
    const tf = form.getTextField(widgetName)
    if (tf) {
      const formatted = formatForWidget(tf, raw)
      tf.setText(formatted)
      return formatted
    }
  } catch {
    // Not a text field — try dropdown.
    try {
      const dd = form.getDropdown(widgetName)
      if (dd) {
        const options = dd.getOptions()
        const str = String(raw)
        const match =
          options.find((o) => o === str) ??
          options.find((o) => o.toUpperCase() === str.toUpperCase())
        if (match) {
          dd.select(match)
          return match
        }
      }
    } catch {
      // Try checkbox (boolean or truthy).
      try {
        const cb = form.getCheckBox(widgetName)
        if (cb && raw) {
          cb.check()
          return '[x]'
        }
      } catch {
        // Give up silently.
      }
    }
  }
  return null
}

function formatForWidget(tf: ReturnType<ReturnType<PDFDocument['getForm']>['getTextField']>, raw: unknown): string {
  const str = String(raw)
  const maxLen = tf.getMaxLength?.() ?? null
  // ISO date -> MDY if matches.
  const isoDate = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoDate) return `${isoDate[2]}/${isoDate[3]}/${isoDate[1]}`
  // Per-char widget (maxLen 9 or 10): strip non-digits for SSN/phone/ZIP.
  if (maxLen && maxLen <= 12 && /[-\s\(\)]/.test(str)) {
    const digits = str.replace(/\D/g, '')
    if (digits.length > 0 && digits.length <= maxLen) return digits
  }
  // Money formatted from number.
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw.toLocaleString('en-US')
  }
  return str
}
