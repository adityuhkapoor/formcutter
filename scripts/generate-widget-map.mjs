/**
 * Claude-assisted widget mapper. Given a form's widget manifest (names +
 * tooltips) and a target schema (our semantic field paths), emit a TypeScript
 * map from schema path → widget name.
 *
 * Usage:
 *   node scripts/generate-widget-map.mjs i-130
 *   node scripts/generate-widget-map.mjs i-485
 *   node scripts/generate-widget-map.mjs n-400
 *
 * Writes to src/lib/forms/<formId>-widget-map.generated.ts which the
 * hand-written widget-map module imports. Keeps manual overrides separate
 * from the generated output.
 */

import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'

// Load ANTHROPIC_API_KEY without printing.
const envText = fs.readFileSync('.env.local', 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([^=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1')
}

const MODEL = 'claude-sonnet-4-6'
const OUT_DIR = 'src/lib/forms'

// Target schemas per form. These are the semantic field paths our state tree
// uses. Claude matches each to the best widget by tooltip similarity.
const SCHEMAS = {
  'i-130': {
    description:
      'I-130 Petition for Alien Relative — filed by a U.S. citizen or LPR petitioner to establish a family relationship with an intending immigrant (beneficiary).',
    paths: [
      // Petitioner (the sponsor filing)
      'petitioner.name.familyName',
      'petitioner.name.givenName',
      'petitioner.name.middleName',
      'petitioner.dateOfBirth',
      'petitioner.ssn',
      'petitioner.aNumber',
      'petitioner.mailingAddress.streetNumberAndName',
      'petitioner.mailingAddress.cityOrTown',
      'petitioner.mailingAddress.state',
      'petitioner.mailingAddress.zipCode',
      'petitioner.countryOfBirth',
      'petitioner.daytimePhone',
      'petitioner.mobilePhone',
      'petitioner.emailAddress',
      'petitioner.maritalStatus',
      'petitioner.citizenshipStatus',
      // Beneficiary (the immigrant being petitioned for)
      'beneficiary.name.familyName',
      'beneficiary.name.givenName',
      'beneficiary.name.middleName',
      'beneficiary.dateOfBirth',
      'beneficiary.countryOfBirth',
      'beneficiary.countryOfCitizenship',
      'beneficiary.aNumber',
      'beneficiary.ssn',
      'beneficiary.gender',
      'beneficiary.maritalStatus',
      'beneficiary.mailingAddress.streetNumberAndName',
      'beneficiary.mailingAddress.cityOrTown',
      'beneficiary.mailingAddress.country',
      // Relationship
      'relationship.type', // spouse / parent / child / sibling
      'signature.date',
    ],
  },
  'i-485': {
    description:
      'I-485 Application to Register Permanent Residence or Adjust Status — filed by an applicant already in the U.S. to become a green-card holder.',
    paths: [
      'applicant.name.familyName',
      'applicant.name.givenName',
      'applicant.name.middleName',
      'applicant.dateOfBirth',
      'applicant.ssn',
      'applicant.aNumber',
      'applicant.countryOfBirth',
      'applicant.countryOfCitizenship',
      'applicant.mailingAddress.streetNumberAndName',
      'applicant.mailingAddress.cityOrTown',
      'applicant.mailingAddress.state',
      'applicant.mailingAddress.zipCode',
      'applicant.dateOfArrival',
      'applicant.i94Number',
      'applicant.gender',
      'applicant.maritalStatus',
      'applicant.daytimePhone',
      'applicant.emailAddress',
      'applicant.passportNumber',
      'applicant.passportCountry',
      'applicant.eligibilityCategory',
      'signature.date',
    ],
  },
  'n-400': {
    description:
      'N-400 Application for Naturalization — filed by a lawful permanent resident to become a U.S. citizen.',
    paths: [
      'applicant.name.familyName',
      'applicant.name.givenName',
      'applicant.name.middleName',
      'applicant.dateOfBirth',
      'applicant.ssn',
      'applicant.aNumber',
      'applicant.countryOfBirth',
      'applicant.mailingAddress.streetNumberAndName',
      'applicant.mailingAddress.cityOrTown',
      'applicant.mailingAddress.state',
      'applicant.mailingAddress.zipCode',
      'applicant.dateBecameLPR',
      'applicant.gender',
      'applicant.maritalStatus',
      'applicant.daytimePhone',
      'applicant.emailAddress',
      'applicant.employerName',
      'applicant.heightFeet',
      'applicant.heightInches',
      'applicant.weightPounds',
      'applicant.eyeColor',
      'applicant.hairColor',
      'applicant.ethnicity',
      'signature.date',
    ],
  },
}

const formId = process.argv[2]
if (!formId || !SCHEMAS[formId]) {
  console.error('usage: node scripts/generate-widget-map.mjs <i-130|i-485|n-400>')
  process.exit(1)
}

const widgets = JSON.parse(fs.readFileSync(`${OUT_DIR}/${formId}-widgets.json`, 'utf8'))
const fieldNames = JSON.parse(fs.readFileSync(`${OUT_DIR}/${formId}-field-names.json`, 'utf8'))

// Build candidate list: only /Tx (text), /Btn (buttons/checkboxes), /Ch (dropdowns).
// For each, prefer the FULLY-QUALIFIED name (what pdf-lib's form API accepts).
const textCandidates = []
const dropdownCandidates = []
const checkboxCandidates = []

// Cross-reference: widgets.json has short names + tooltips; field-names.json
// has fully-qualified names + types. Match by short name suffix.
const fieldByShort = new Map()
for (const fn of fieldNames) {
  const short = fn.name.split('.').pop()
  if (!fieldByShort.has(short)) fieldByShort.set(short, { ...fn, duplicates: 0 })
  else fieldByShort.get(short).duplicates += 1
}

for (const w of widgets) {
  if (!w.name || !w.tooltip) continue
  const fn = fieldByShort.get(w.name)
  const qualifiedName = fn?.name ?? w.name
  const type = fn?.type
  const entry = { shortName: w.name, qualifiedName, tooltip: w.tooltip, page: w.page, fieldType: w.fieldType }
  if (type === 'PDFTextField') textCandidates.push(entry)
  else if (type === 'PDFDropdown') dropdownCandidates.push(entry)
  else if (type === 'PDFCheckBox') checkboxCandidates.push(entry)
}

const schema = SCHEMAS[formId]

const systemPrompt = `You are a USCIS form-mapping specialist. Given a target semantic schema and a list of form widgets with their tooltips, you match each schema path to the single best-fitting widget name.

Rules:
- Match on semantic meaning of the tooltip, not just string similarity.
- For address fields: "mailingAddress.streetNumberAndName" matches widgets tooltip'd "street and number" or "street address".
- For names: "familyName" = last name, "givenName" = first name, "middleName" = middle.
- For enum-like schema paths (maritalStatus, gender, relationship.type): the widget is usually a CHECKBOX GROUP — pick the group name prefix OR omit (mark as "MANUAL:enum" in your output).
- For multi-instance fields (e.g. spouse might have multiple entries on N-400), prefer the FIRST instance (index [0]).
- If no widget matches a schema path within reasonable confidence, map it to "SKIP" — don't force a match.
- The form has a "${schema.description}" context. Use that to disambiguate (e.g. on I-130, "applicant" = petitioner, not beneficiary).

Output format: valid JSON object mapping schema path → widget qualified name (or "SKIP"). No prose, no comments, just the JSON.`

const userPrompt = `Form: ${formId.toUpperCase()}
${schema.description}

Target schema paths to map:
${schema.paths.map((p) => `  - ${p}`).join('\n')}

Available TEXT widgets (${textCandidates.length}):
${textCandidates.map((c) => `  ${c.qualifiedName} :: ${c.tooltip.slice(0, 140)}`).join('\n')}

Available DROPDOWN widgets (${dropdownCandidates.length}):
${dropdownCandidates.map((c) => `  ${c.qualifiedName} :: ${c.tooltip.slice(0, 140)}`).join('\n')}

Map each schema path to exactly one qualified widget name, or "SKIP".`

const client = new Anthropic()

console.log(`mapping ${schema.paths.length} schema paths across ${textCandidates.length + dropdownCandidates.length} candidate widgets...`)

const res = await client.messages.create({
  model: MODEL,
  max_tokens: 4096,
  temperature: 0,
  system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
  messages: [{ role: 'user', content: userPrompt }],
})

const text = res.content.find((b) => b.type === 'text')?.text ?? ''
const jsonMatch = text.match(/\{[\s\S]*\}/)
if (!jsonMatch) {
  console.error('no JSON in response:\n', text)
  process.exit(1)
}

const mapping = JSON.parse(jsonMatch[0])

let matched = 0
let skipped = 0
for (const v of Object.values(mapping)) {
  if (v === 'SKIP') skipped += 1
  else matched += 1
}
console.log(`  matched ${matched}, skipped ${skipped}`)

// Emit TypeScript — a SchemaToWidget map compatible with our existing
// i864-widget-map.ts patterns.
const tsLines = [
  `/**`,
  ` * AUTO-GENERATED by scripts/generate-widget-map.mjs from the ${formId} widget manifest.`,
  ` * DO NOT EDIT BY HAND — regenerate instead. Hand-written renderer logic lives`,
  ` * in ${formId}-widget-map.ts which imports from this file.`,
  ` */`,
  ``,
  `export const AUTO_${formId.replace(/-/g, '_').toUpperCase()}_MAP: Record<string, string> = {`,
]
for (const [path, widget] of Object.entries(mapping)) {
  if (widget === 'SKIP') continue
  tsLines.push(`  ${JSON.stringify(path)}: ${JSON.stringify(widget)},`)
}
tsLines.push(`}`)
tsLines.push(``)

const outPath = path.join(OUT_DIR, `${formId}-widget-map.generated.ts`)
fs.writeFileSync(outPath, tsLines.join('\n'))
console.log(`wrote ${outPath}`)
