import { PDFDocument, PDFName, PDFArray, PDFDict, PDFString, PDFRef } from 'pdf-lib'
import fs from 'node:fs/promises'

const bytes = await fs.readFile('public/forms/i-864.pdf')
const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
const pages = doc.getPages()

// Walk every widget on every page, extract what we can.
const widgets = []
for (let i = 0; i < pages.length; i++) {
  const annots = pages[i].node.lookup(PDFName.of('Annots'))
  if (!(annots instanceof PDFArray)) continue
  for (let j = 0; j < annots.size(); j++) {
    const a = annots.lookup(j)
    if (!(a instanceof PDFDict)) continue
    const st = a.get(PDFName.of('Subtype'))
    if (st?.toString() !== '/Widget') continue
    const rect = a.get(PDFName.of('Rect'))
    const t = a.get(PDFName.of('T')) // field name (partial)
    const ft = a.get(PDFName.of('FT'))
    const tu = a.get(PDFName.of('TU')) // tooltip (often more descriptive)
    const parent = a.get(PDFName.of('Parent'))
    widgets.push({
      page: i,
      rect: rect?.toString() ?? null,
      t: t?.toString() ?? null,
      ft: ft?.toString() ?? null,
      tu: tu?.toString() ?? null,
      hasParent: Boolean(parent),
    })
  }
}

console.log(`total widgets: ${widgets.length}`)
console.log('first 12 across pages 0-2:')
for (const w of widgets.slice(0, 12)) console.log(JSON.stringify(w))
console.log('...')
console.log('named widgets only (first 15):')
for (const w of widgets.filter((w) => w.t).slice(0, 15)) console.log(JSON.stringify(w))
console.log(`named: ${widgets.filter((w) => w.t).length} / ${widgets.length}`)
console.log(`with tooltips: ${widgets.filter((w) => w.tu).length}`)
