import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// ─── Types for JSON columns ────────────────────────────────────────────

export type CaseStatus = 'drafting' | 'pending_review' | 'approved' | 'released'

export type CaseMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  attachment?: { fileName: string; docType?: string; status: 'uploading' | 'done' | 'error' }
  options?: string[]
}

// ─── Tables ────────────────────────────────────────────────────────────

export const cases = sqliteTable('cases', {
  id: text('id').primaryKey(),
  status: text('status').$type<CaseStatus>().notNull().default('drafting'),
  /** Sponsor's flat form state — dotted schema paths → values. */
  state: text('state', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  /** Full chat transcript. */
  messages: text('messages', { mode: 'json' }).$type<CaseMessage[]>().notNull().default([]),
  /** Which form we're filling. Leaves room for i-130, n-400, etc. */
  formType: text('form_type').notNull().default('i-864'),
  /** Display name from docs if available — nice-to-have for rep dashboard list. */
  displayName: text('display_name'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  submittedAt: integer('submitted_at', { mode: 'timestamp_ms' }),
  approvedAt: integer('approved_at', { mode: 'timestamp_ms' }),
})

export type FlagKind =
  | 'income_check'       // income vs 125% poverty line
  | 'legal_strategy'     // user asked a strategic question
  | 'source_discrepancy' // values extracted from two docs don't match
  | 'incomplete_section' // a required section is blank
  | 'data_quality'       // SSN partially masked, warning from extraction, etc.
  | 'other'

export type FlagSeverity = 'info' | 'warn' | 'error'
export type FlagStatus = 'pending' | 'approved' | 'dismissed' | 'edited'

export const flags = sqliteTable('flags', {
  id: text('id').primaryKey(),
  caseId: text('case_id')
    .notNull()
    .references(() => cases.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<FlagKind>().notNull(),
  severity: text('severity').$type<FlagSeverity>().notNull(),
  title: text('title').notNull(),
  /** Longer explanation shown to the rep. */
  detail: text('detail').notNull(),
  /** LLM's reasoning — helpful for rep to understand why it was flagged. */
  llmReasoning: text('llm_reasoning'),
  /** Optional rep-edited field to change. Path in dotted schema notation. */
  suggestedFieldPath: text('suggested_field_path'),
  status: text('status').$type<FlagStatus>().notNull().default('pending'),
  resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),
  resolvedNote: text('resolved_note'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export type CaseRow = typeof cases.$inferSelect
export type NewCase = typeof cases.$inferInsert
export type FlagRow = typeof flags.$inferSelect
export type NewFlag = typeof flags.$inferInsert
