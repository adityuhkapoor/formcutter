/**
 * Walk Widget annotations in a USCIS form PDF, dump (name, page, rect,
 * tooltip, fieldType) to src/lib/forms/<formId>-widgets.json and the fully-
 * qualified field names (post-XFA-strip) to src/lib/forms/<formId>-field-names.json.
 *
 * Usage:
 *   node scripts/extract-widgets.mjs i-864
 *   node scripts/extract-widgets.mjs --all
 */

import { PDFDocument, PDFName, PDFArray, PDFDict } from 'pdf-lib'
import fs from 'node:fs/promises'
import path from 'node:path'

const FORM_IDS = ['i-864', 'i-130', 'i-485', 'n-400', 'i-589', 'i-765', 'i-821']

function decode(node) {
  if (!node) return null
  const s = node.toString()
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
      .replace(/\\n/g, '\n')
  }
  return s
}

function parseRect(node) {
  if (!node) return null
  const s = node.toString().replace(/^\[|\]$/g, '').trim()
  const parts = s.split(/\s+/).map(Number)
  return parts.length === 4 ? parts : null
}

async function extract(formId) {
  const pdfPath = `public/forms/${formId}.pdf`
  const bytes = await fs.readFile(pdfPath)
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })

  const widgets = []
  for (let i = 0; i < doc.getPages().length; i++) {
    const page = doc.getPages()[i]
    const annots = page.node.lookup(PDFName.of('Annots'))
    if (!(annots instanceof PDFArray)) continue
    for (let j = 0; j < annots.size(); j++) {
      const a = annots.lookup(j)
      if (!(a instanceof PDFDict)) continue
      if (a.get(PDFName.of('Subtype'))?.toString() !== '/Widget') continue
      const name = decode(a.get(PDFName.of('T')))
      const tooltip = decode(a.get(PDFName.of('TU')))
      const ft = a.get(PDFName.of('FT'))?.toString() ?? null
      const rect = parseRect(a.get(PDFName.of('Rect')))
      widgets.push({ page: i, name, fieldType: ft, rect, tooltip })
    }
  }

  // Trigger XFA strip and collect fully-qualified names by type.
  const form = doc.getForm()
  const fieldNames = form.getFields().map((f) => ({
    name: f.getName(),
    type: f.constructor.name,
  }))

  const outDir = 'src/lib/forms'
  await fs.mkdir(outDir, { recursive: true })
  await fs.writeFile(
    path.join(outDir, `${formId}-widgets.json`),
    JSON.stringify(widgets, null, 2)
  )
  await fs.writeFile(
    path.join(outDir, `${formId}-field-names.json`),
    JSON.stringify(fieldNames, null, 2)
  )

  const byType = {}
  for (const w of widgets) byType[w.fieldType ?? 'null'] = (byType[w.fieldType ?? 'null'] ?? 0) + 1
  console.log(`${formId}: ${widgets.length} widgets (${JSON.stringify(byType)}) → ${outDir}/${formId}-widgets.json`)
}

const arg = process.argv[2]
if (!arg) {
  console.error('usage: node scripts/extract-widgets.mjs <form-id | --all>')
  process.exit(1)
}

const ids = arg === '--all' ? FORM_IDS : [arg]
for (const id of ids) {
  try {
    await extract(id)
  } catch (err) {
    console.error(`failed ${id}:`, err.message)
  }
}
