import { eq, desc, sql, asc } from 'drizzle-orm'
import { db, cases, flags } from './db'
import { flagReplies } from './db/schema'
import type { CaseStatus, CaseMessage, FlagKind, FlagSeverity, FlagStatus } from './db/schema'

export function createCase(opts: {
  formType?: string
  triageTranscript?: CaseMessage[]
} = {}): typeof cases.$inferSelect {
  const id = crypto.randomUUID()
  const now = new Date()
  const row = {
    id,
    status: 'drafting' as const,
    state: {},
    messages: [],
    formType: opts.formType ?? 'i-864',
    displayName: null,
    triageTranscript: opts.triageTranscript ?? null,
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
    approvedAt: null,
  }
  db.insert(cases).values(row).run()
  return row
}

export function getCase(id: string) {
  const rows = db.select().from(cases).where(eq(cases.id, id)).limit(1).all()
  return rows[0] ?? null
}

export function updateCase(
  id: string,
  patch: Partial<{
    state: Record<string, unknown>
    messages: CaseMessage[]
    displayName: string | null
    status: CaseStatus
    submittedAt: Date | null
    approvedAt: Date | null
  }>
) {
  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.state !== undefined) updates.state = patch.state
  if (patch.messages !== undefined) updates.messages = patch.messages
  if (patch.displayName !== undefined) updates.displayName = patch.displayName
  if (patch.status !== undefined) updates.status = patch.status
  if (patch.submittedAt !== undefined) updates.submittedAt = patch.submittedAt
  if (patch.approvedAt !== undefined) updates.approvedAt = patch.approvedAt
  db.update(cases).set(updates).where(eq(cases.id, id)).run()
  return getCase(id)
}

export function listCases(filter?: { status?: CaseStatus }) {
  const q = db
    .select({
      id: cases.id,
      status: cases.status,
      formType: cases.formType,
      displayName: cases.displayName,
      createdAt: cases.createdAt,
      updatedAt: cases.updatedAt,
      submittedAt: cases.submittedAt,
      approvedAt: cases.approvedAt,
      flagCount: sql<number>`(SELECT COUNT(*) FROM flags WHERE flags.case_id = ${cases.id} AND flags.status = 'pending')`,
    })
    .from(cases)
    .orderBy(desc(cases.updatedAt))

  const rows = filter?.status ? q.where(eq(cases.status, filter.status)).all() : q.all()
  return rows
}

// ─── Flags ─────────────────────────────────────────────────────────────

export function createFlag(opts: {
  caseId: string
  kind: FlagKind
  severity: FlagSeverity
  title: string
  detail: string
  llmReasoning?: string
  suggestedFieldPath?: string
}) {
  const id = crypto.randomUUID()
  db.insert(flags).values({
    id,
    caseId: opts.caseId,
    kind: opts.kind,
    severity: opts.severity,
    title: opts.title,
    detail: opts.detail,
    llmReasoning: opts.llmReasoning,
    suggestedFieldPath: opts.suggestedFieldPath,
    status: 'pending',
    createdAt: new Date(),
  }).run()
  return id
}

export function getFlagsForCase(caseId: string) {
  return db.select().from(flags).where(eq(flags.caseId, caseId)).all()
}

export function updateFlag(
  id: string,
  patch: { status?: FlagStatus; resolvedNote?: string }
) {
  const updates: Record<string, unknown> = {}
  if (patch.status !== undefined) {
    updates.status = patch.status
    if (patch.status !== 'pending') updates.resolvedAt = new Date()
  }
  if (patch.resolvedNote !== undefined) updates.resolvedNote = patch.resolvedNote
  db.update(flags).set(updates).where(eq(flags.id, id)).run()
}

export function clearFlagsForCase(caseId: string) {
  db.delete(flags).where(eq(flags.caseId, caseId)).run()
}

// ─── Flag replies (rep-authored responses to question_help flags) ─────

export function createFlagReply(opts: {
  flagId: string
  body: string
  authorLabel?: string
}) {
  const id = crypto.randomUUID()
  db.insert(flagReplies).values({
    id,
    flagId: opts.flagId,
    authorLabel: opts.authorLabel ?? 'Accredited rep',
    body: opts.body,
    createdAt: new Date(),
  }).run()
  return id
}

export function getRepliesForFlag(flagId: string) {
  return db
    .select()
    .from(flagReplies)
    .where(eq(flagReplies.flagId, flagId))
    .orderBy(asc(flagReplies.createdAt))
    .all()
}

export function getRepliesForCase(caseId: string) {
  return db
    .select({
      id: flagReplies.id,
      flagId: flagReplies.flagId,
      authorLabel: flagReplies.authorLabel,
      body: flagReplies.body,
      createdAt: flagReplies.createdAt,
      flagKind: flags.kind,
      flagTitle: flags.title,
    })
    .from(flagReplies)
    .innerJoin(flags, eq(flagReplies.flagId, flags.id))
    .where(eq(flags.caseId, caseId))
    .orderBy(asc(flagReplies.createdAt))
    .all()
}
