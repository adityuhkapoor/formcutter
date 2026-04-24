/**
 * One-shot script: walk every Widget annotation in public/forms/i-864.pdf
 * and dump (name, page, rect, fieldType, tooltip) to src/lib/i864-widgets.json.
 *
 * Run whenever the USCIS form edition changes. The filler reads this JSON
 * at runtime to find widgets by name and set their /V values directly.
 */

import { PDFDocument, PDFName, PDFArray, PDFDict } from 'pdf-lib'
import fs from 'node:fs/promises'

const bytes = await fs.readFile('public/forms/i-864.pdf')
const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })

// Decode a UTF-16BE hex string like <feff0050004400...> into ASCII.
function decodePdfString(node) {
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
  // Parenthesized literal string: strip parens and unescape
  if (s.startsWith('(') && s.endsWith(')')) {
    return s
      .slice(1, -1)
      .replace(/\\(\(|\)|\\)/g, '$1')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
  }
  return s
}

function parseRect(node) {
  if (!node) return null
  const s = node.toString().replace(/^\[|\]$/g, '').trim()
  const parts = s.split(/\s+/).map(Number)
  return parts.length === 4 ? parts : null
}

const widgets = []
const pages = doc.getPages()

for (let i = 0; i < pages.length; i++) {
  const annots = pages[i].node.lookup(PDFName.of('Annots'))
  if (!(annots instanceof PDFArray)) continue

  for (let j = 0; j < annots.size(); j++) {
    const a = annots.lookup(j)
    if (!(a instanceof PDFDict)) continue
    if (a.get(PDFName.of('Subtype'))?.toString() !== '/Widget') continue

    const name = decodePdfString(a.get(PDFName.of('T')))
    const tooltip = decodePdfString(a.get(PDFName.of('TU')))
    const ft = a.get(PDFName.of('FT'))?.toString() ?? null
    const rect = parseRect(a.get(PDFName.of('Rect')))

    // Walk up the parent chain to build a fully-qualified field name,
    // since nested fields only store their last segment in /T.
    const segments = [name]
    let parent = a.get(PDFName.of('Parent'))
    while (parent instanceof PDFDict) {
      const pn = decodePdfString(parent.get(PDFName.of('T')))
      if (pn) segments.unshift(pn)
      parent = parent.get(PDFName.of('Parent'))
    }
    const qualifiedName = segments.filter(Boolean).join('.')

    widgets.push({
      page: i, // 0-indexed
      name: name ?? null,
      qualifiedName: qualifiedName || null,
      fieldType: ft,
      rect,
      tooltip,
    })
  }
}

await fs.writeFile('src/lib/i864-widgets.json', JSON.stringify(widgets, null, 2))
console.log(`wrote ${widgets.length} widgets to src/lib/i864-widgets.json`)

// Summary
const byType = {}
for (const w of widgets) byType[w.fieldType ?? 'null'] = (byType[w.fieldType ?? 'null'] ?? 0) + 1
console.log('by fieldType:', byType)
console.log('sample text widgets (first 5):')
for (const w of widgets.filter((w) => w.fieldType === '/Tx').slice(0, 5)) {
  console.log(' ', w.qualifiedName, '—', w.tooltip?.slice(0, 80))
}
