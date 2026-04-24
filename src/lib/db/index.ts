import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import * as schema from './schema'

/**
 * SQLite DB lives at ./data/formcutter.db (gitignored).
 * Globalized so Next.js hot reload doesn't leak connections.
 */

const DB_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'formcutter.db')

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

declare global {
  // eslint-disable-next-line no-var
  var __formcutterSqlite: Database.Database | undefined
}

const sqlite = globalThis.__formcutterSqlite ?? new Database(DB_PATH)
if (!globalThis.__formcutterSqlite) {
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  // Auto-create schema if missing. We use drizzle-kit push normally but this
  // path covers first-run (and avoids an extra command in the demo setup).
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'drafting',
      state TEXT NOT NULL DEFAULT '{}',
      messages TEXT NOT NULL DEFAULT '[]',
      form_type TEXT NOT NULL DEFAULT 'i-864',
      display_name TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      submitted_at INTEGER,
      approved_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS flags (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      llm_reasoning TEXT,
      suggested_field_path TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      resolved_at INTEGER,
      resolved_note TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
    CREATE INDEX IF NOT EXISTS idx_cases_updated ON cases(updated_at);
    CREATE INDEX IF NOT EXISTS idx_flags_case ON flags(case_id);
  `)
  globalThis.__formcutterSqlite = sqlite
}

export const db = drizzle(sqlite, { schema })
export * from './schema'
