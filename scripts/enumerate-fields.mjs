import { PDFDocument } from 'pdf-lib'
import fs from 'node:fs'

const pdfBytes = fs.readFileSync('public/forms/i-864.pdf')
const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
const form = doc.getForm()
const fields = form.getFields()

const out = fields.map(f => ({
  name: f.getName(),
  type: f.constructor.name,
}))

fs.writeFileSync('src/lib/i864-fields.json', JSON.stringify(out, null, 2))
console.log(`wrote ${out.length} fields to src/lib/i864-fields.json`)
console.log('sample:', out.slice(0, 5))
