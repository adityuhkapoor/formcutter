/**
 * Generate synthetic test documents for demo / dev.
 * Usage: node scripts/gen-test-docs.mjs
 * Outputs to test-docs/ (gitignored).
 *
 * Persona: Jane Doe, US citizen, W-2 software engineer in Austin.
 * Sponsors her husband John Doe. Makes $95k.
 *
 * These are CARTOONISHLY fake. They're for testing the extraction pipeline,
 * not for fooling anyone. Do not submit them to USCIS (duh).
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'node:fs/promises'
import path from 'node:path'

const OUT_DIR = 'test-docs'
await fs.mkdir(OUT_DIR, { recursive: true })

// ─── 1. Fake Texas driver's license (PDF, but rendered like an ID card) ─
{
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  // Standard CR80 card is ~85.6 x 54 mm. In pts: 243 x 153.
  const page = pdf.addPage([500, 320])

  // Header bar
  page.drawRectangle({ x: 0, y: 270, width: 500, height: 50, color: rgb(0.1, 0.25, 0.5) })
  page.drawText('TEXAS', { x: 20, y: 290, size: 24, font: bold, color: rgb(1, 1, 1) })
  page.drawText('DRIVER LICENSE', { x: 110, y: 294, size: 14, font, color: rgb(1, 1, 1) })
  page.drawText('SAMPLE · NOT REAL', { x: 320, y: 294, size: 9, font: bold, color: rgb(1, 0.9, 0.4) })

  // Card body
  page.drawRectangle({ x: 0, y: 0, width: 500, height: 270, color: rgb(0.95, 0.96, 0.98) })

  // Photo placeholder
  page.drawRectangle({ x: 20, y: 60, width: 130, height: 180, color: rgb(0.7, 0.72, 0.78) })
  page.drawText('PHOTO', { x: 55, y: 140, size: 14, font: bold, color: rgb(1, 1, 1) })

  // Fields
  const labelColor = rgb(0.4, 0.4, 0.4)
  const valueColor = rgb(0.05, 0.05, 0.15)
  let y = 230
  const row = (label, value) => {
    page.drawText(label, { x: 175, y, size: 8, font, color: labelColor })
    page.drawText(value, { x: 175, y: y - 14, size: 12, font: bold, color: valueColor })
    y -= 32
  }
  row('4d LIC#', 'DL-12345678')
  row('1 LN', 'DOE')
  row('2 FN', 'JANE')
  row('8 ADDRESS', '4217 SOUTH CONGRESS AVE, AUSTIN TX 78704')
  row('3 DOB', '03/18/1991')
  row('5 DD', '01234567-00000')
  row('4a ISS', '05/14/2022')
  row('4b EXP', '03/18/2030')

  await fs.writeFile(path.join(OUT_DIR, 'sample-license.pdf'), await pdf.save())
}

// ─── 2. Fake IRS Form 1040 page 1 (simplified) ─────────────────────────
{
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([612, 792])

  page.drawText('Form 1040', { x: 50, y: 750, size: 18, font: bold })
  page.drawText('U.S. Individual Income Tax Return', { x: 50, y: 732, size: 11, font })
  page.drawText('Tax Year: 2024', { x: 450, y: 750, size: 11, font: bold })
  page.drawText('OMB No. 1545-0074   (SAMPLE · NOT REAL)', { x: 300, y: 732, size: 8, font, color: rgb(0.4, 0, 0) })

  page.drawLine({ start: { x: 50, y: 725 }, end: { x: 562, y: 725 }, thickness: 1 })

  // Taxpayer info
  let y = 700
  const labelKV = (k, v) => {
    page.drawText(k, { x: 50, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
    page.drawText(v, { x: 220, y, size: 11, font: bold })
    y -= 20
  }
  labelKV('Your first name and middle initial', 'Jane M.')
  labelKV('Last name', 'Doe')
  labelKV('Your social security number', '524-33-7102')
  labelKV('Home address (number and street)', '4217 South Congress Ave')
  labelKV('City, town, state, ZIP', 'Austin, TX 78704')
  labelKV('Filing status', 'Married filing jointly')
  labelKV('Spouse name', 'John Doe')
  labelKV('Spouse SSN', '524-33-7103')

  y -= 10
  page.drawText('Income', { x: 50, y, size: 13, font: bold })
  y -= 20

  const lineItem = (num, label, amount) => {
    page.drawText(num, { x: 50, y, size: 10, font: bold })
    page.drawText(label, { x: 80, y, size: 10, font })
    page.drawText(`$${amount.toLocaleString()}`, { x: 480, y, size: 11, font: bold })
    y -= 18
  }
  lineItem('1a', 'Total amount from Form(s) W-2, box 1', 94800)
  lineItem('2b', 'Taxable interest', 320)
  lineItem('7',  'Capital gain or (loss)', 0)
  lineItem('8',  'Other income', 0)
  lineItem('9',  'Total income (add lines 1a through 8)', 95120)
  lineItem('10', 'Adjustments to income', 0)
  lineItem('11', 'Adjusted gross income (AGI)', 95120)
  lineItem('12', 'Standard deduction', 29200)
  lineItem('15', 'Taxable income', 65920)

  await fs.writeFile(path.join(OUT_DIR, 'sample-tax-return-1040.pdf'), await pdf.save())
}

// ─── 3. Fake paystub (current year, most recent pay period) ─────────────
{
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([612, 400])

  page.drawText('EARNINGS STATEMENT', { x: 50, y: 360, size: 14, font: bold })
  page.drawText('(SAMPLE · NOT REAL)', { x: 320, y: 362, size: 9, font, color: rgb(0.6, 0, 0) })

  page.drawText('Employer:  Lumen Labs, Inc.', { x: 50, y: 335, size: 10, font })
  page.drawText('500 Guadalupe St, Austin TX 78701', { x: 50, y: 322, size: 10, font })
  page.drawText('EIN: 82-1234567', { x: 50, y: 309, size: 10, font })

  page.drawText('Employee:  Jane M. Doe', { x: 350, y: 335, size: 10, font })
  page.drawText('Employee ID: 00482', { x: 350, y: 322, size: 10, font })
  page.drawText('SSN: ***-**-7102', { x: 350, y: 309, size: 10, font })

  page.drawLine({ start: { x: 50, y: 295 }, end: { x: 562, y: 295 }, thickness: 1 })

  page.drawText('Pay Period: 03/24/2026 – 04/06/2026', { x: 50, y: 275, size: 10, font })
  page.drawText('Pay Date: 04/10/2026', { x: 350, y: 275, size: 10, font })

  // Earnings table
  page.drawText('Earnings', { x: 50, y: 245, size: 11, font: bold })
  page.drawText('Rate', { x: 200, y: 245, size: 10, font: bold })
  page.drawText('Hours', { x: 260, y: 245, size: 10, font: bold })
  page.drawText('Current', { x: 330, y: 245, size: 10, font: bold })
  page.drawText('YTD', { x: 450, y: 245, size: 10, font: bold })

  const earning = (label, rate, hours, current, ytd) => {
    page.drawText(label, { x: 50, y: 225, size: 10, font })
    page.drawText(rate, { x: 200, y: 225, size: 10, font })
    page.drawText(hours, { x: 260, y: 225, size: 10, font })
    page.drawText(current, { x: 330, y: 225, size: 10, font })
    page.drawText(ytd, { x: 450, y: 225, size: 10, font })
  }
  earning('Regular Salary', '45.67', '80.00', '$3,653.84', '$23,750.00')

  // Gross and net
  page.drawLine({ start: { x: 50, y: 200 }, end: { x: 562, y: 200 }, thickness: 0.5 })
  page.drawText('Gross Pay', { x: 50, y: 180, size: 11, font: bold })
  page.drawText('$3,653.84', { x: 330, y: 180, size: 11, font: bold })
  page.drawText('$23,750.00', { x: 450, y: 180, size: 11, font: bold })

  page.drawText('Federal Income Tax', { x: 50, y: 155, size: 10, font })
  page.drawText('-$548.08', { x: 330, y: 155, size: 10, font })
  page.drawText('-$3,562.50', { x: 450, y: 155, size: 10, font })

  page.drawText('Social Security', { x: 50, y: 140, size: 10, font })
  page.drawText('-$226.54', { x: 330, y: 140, size: 10, font })
  page.drawText('-$1,472.50', { x: 450, y: 140, size: 10, font })

  page.drawText('Net Pay', { x: 50, y: 110, size: 12, font: bold })
  page.drawText('$2,879.22', { x: 330, y: 110, size: 12, font: bold })
  page.drawText('$18,715.00', { x: 450, y: 110, size: 12, font: bold })

  page.drawText('Annualized pay (gross × 26): $95,000', {
    x: 50,
    y: 70,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  })

  await fs.writeFile(path.join(OUT_DIR, 'sample-paystub.pdf'), await pdf.save())
}

// ─── 4. Fake U.S. passport bio page (proof of citizenship) ──────────────
{
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  // Passport bio page is roughly 125 x 88 mm. Scaled up for legibility.
  const page = pdf.addPage([500, 350])

  // Background
  page.drawRectangle({ x: 0, y: 0, width: 500, height: 350, color: rgb(0.05, 0.1, 0.2) })

  // Top bar — gold "UNITED STATES OF AMERICA"
  page.drawRectangle({ x: 0, y: 305, width: 500, height: 45, color: rgb(0.08, 0.13, 0.25) })
  page.drawText('UNITED STATES OF AMERICA', {
    x: 105, y: 325, size: 14, font: bold, color: rgb(0.95, 0.85, 0.5),
  })
  page.drawText('PASSPORT', {
    x: 200, y: 310, size: 11, font, color: rgb(0.95, 0.85, 0.5),
  })
  page.drawText('SAMPLE · NOT REAL', {
    x: 360, y: 310, size: 8, font: bold, color: rgb(1, 0.6, 0.4),
  })

  // Body — pale background card
  page.drawRectangle({ x: 0, y: 0, width: 500, height: 305, color: rgb(0.96, 0.95, 0.92) })

  // Photo placeholder (left)
  page.drawRectangle({ x: 25, y: 70, width: 130, height: 175, color: rgb(0.75, 0.77, 0.82) })
  page.drawText('PHOTO', { x: 65, y: 155, size: 14, font: bold, color: rgb(1, 1, 1) })

  // Fields (right)
  const labelColor = rgb(0.4, 0.4, 0.4)
  const valueColor = rgb(0.05, 0.05, 0.15)
  let y = 265
  const row = (label, value) => {
    page.drawText(label, { x: 175, y, size: 7, font, color: labelColor })
    page.drawText(value, { x: 175, y: y - 12, size: 11, font: bold, color: valueColor })
    y -= 28
  }
  row('Type / Code / Passport No.', 'P / USA / 123456789')
  row('Surname', 'DOE')
  row('Given Names', 'JANE M.')
  row('Nationality', 'UNITED STATES OF AMERICA')
  row('Date of Birth', '18 MAR 1991')
  row('Place of Birth', 'AUSTIN, TEXAS, U.S.A.')
  row('Sex', 'F')
  row('Date of Issue', '14 MAY 2022')
  row('Date of Expiration', '13 MAY 2032')

  // Bottom MRZ-style line (machine readable zone — fake but recognizable)
  page.drawRectangle({ x: 0, y: 0, width: 500, height: 50, color: rgb(0.92, 0.91, 0.88) })
  const mono = await pdf.embedFont(StandardFonts.Courier)
  page.drawText('P<USADOE<<JANE<M<<<<<<<<<<<<<<<<<<<<<<<<<<', {
    x: 18, y: 30, size: 10, font: mono, color: rgb(0.1, 0.1, 0.15),
  })
  page.drawText('1234567890USA9103184F3205135<<<<<<<<<<<<<<06', {
    x: 18, y: 14, size: 10, font: mono, color: rgb(0.1, 0.1, 0.15),
  })

  await fs.writeFile(path.join(OUT_DIR, 'sample-passport.pdf'), await pdf.save())
}

console.log('generated:')
for (const f of await fs.readdir(OUT_DIR)) {
  console.log(' ', path.join(OUT_DIR, f))
}
