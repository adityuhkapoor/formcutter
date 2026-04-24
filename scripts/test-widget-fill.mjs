/**
 * Test: can we programmatically set /V on a widget and have the value render
 * in a standard PDF viewer? This is the make-or-break question for skipping
 * coordinate overlay in favor of native form fill.
 *
 * Strategy:
 *  1. Find a specific Part 4 text widget (sponsor family name)
 *  2. Set its /V to "TESTVALUE"
 *  3. Set /NeedAppearances true on the AcroForm dict so viewers regenerate /AP
 *  4. Save → render to PNG with pdftoppm → grep the rendered image for text
 */

import { PDFDocument, PDFName, PDFArray, PDFDict, PDFString, PDFBool, PDFHexString } from 'pdf-lib'
import fs from 'node:fs/promises'
import { execSync } from 'node:child_process'

const bytes = await fs.readFile('public/forms/i-864.pdf')
const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })

// Decode a UTF-16 hex-string field name into ASCII
function decodeName(node) {
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
  return s.replace(/^\(|\)$/g, '')
}

const pages = doc.getPages()

// Find a Part 4 text field (sponsor info) — we expect names containing "Pt4" or "Part4"
let target = null
for (let i = 0; i < pages.length && !target; i++) {
  const annots = pages[i].node.lookup(PDFName.of('Annots'))
  if (!(annots instanceof PDFArray)) continue
  for (let j = 0; j < annots.size(); j++) {
    const a = annots.lookup(j)
    if (!(a instanceof PDFDict)) continue
    const ft = a.get(PDFName.of('FT'))
    if (ft?.toString() !== '/Tx') continue
    const t = a.get(PDFName.of('T'))
    if (!t) continue
    const name = decodeName(t)
    const tu = a.get(PDFName.of('TU'))?.toString() ?? ''
    // Sponsor family name = Part 4 Line 1a
    if (/Pt4Line1a|Part\s*4.*Family/i.test(name + tu)) {
      target = { page: i, annot: a, name, tu, rect: a.get(PDFName.of('Rect'))?.toString() }
      break
    }
  }
}

if (!target) {
  // Fallback: pick the first text field on page 2 (likely Part 2 or 4)
  for (let j = 0; j < 100; j++) {
    const annots = pages[2].node.lookup(PDFName.of('Annots'))
    const a = annots.lookup(j)
    if (a?.get(PDFName.of('FT'))?.toString() === '/Tx') {
      const t = a.get(PDFName.of('T'))
      const tu = a.get(PDFName.of('TU'))?.toString() ?? ''
      target = { page: 2, annot: a, name: decodeName(t), tu, rect: a.get(PDFName.of('Rect'))?.toString() }
      break
    }
  }
}

console.log('target widget:', target?.name)
console.log('tooltip:', target?.tu)
console.log('rect:', target?.rect)
console.log('page:', target?.page)

if (!target) {
  console.log('no target found')
  process.exit(1)
}

// Set /V to our test value as a UTF-16 BE string for safety
const testValue = 'TESTFILL_ALVAREZ'
const hex = Buffer.from('﻿' + testValue, 'utf16le').swap16().toString('hex')
target.annot.set(PDFName.of('V'), PDFHexString.of(hex))
// Also set /DV (default value) and remove /AP so viewer regenerates appearance
target.annot.set(PDFName.of('DV'), PDFHexString.of(hex))
target.annot.delete(PDFName.of('AP'))

// Set /NeedAppearances on AcroForm
const catalog = doc.catalog
const acroForm = catalog.lookup(PDFName.of('AcroForm'))
if (acroForm instanceof PDFDict) {
  acroForm.set(PDFName.of('NeedAppearances'), PDFBool.True)
  console.log('set NeedAppearances on AcroForm')
}

const outBytes = await doc.save()
await fs.writeFile('/tmp/i864-widget-test.pdf', outBytes)
console.log('saved to /tmp/i864-widget-test.pdf')

// Render page 3 (index 2, the one we targeted) to PNG and see if the text appears
try {
  execSync(`pdftoppm -f 3 -l 3 -r 150 /tmp/i864-widget-test.pdf /tmp/i864-widget-test 2>&1`)
  console.log('rendered to /tmp/i864-widget-test-3.png')
  // Run tesseract or pdftotext to see if the value appears in the rendered output
  const pageText = execSync(`pdftotext -f ${target.page + 1} -l ${target.page + 1} -layout /tmp/i864-widget-test.pdf -`).toString()
  const found = pageText.includes(testValue)
  console.log(found ? '✅ VALUE FOUND in rendered text' : '❌ VALUE NOT in pdftotext output')
  if (!found) {
    console.log('(pdftotext only extracts text from content stream, not form values — normal for viewers that need NeedAppearances)')
  }
} catch (e) {
  console.log('render error:', e.message)
}
