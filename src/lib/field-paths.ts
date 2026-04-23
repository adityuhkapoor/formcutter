/**
 * Utility functions for working with dotted field paths over an I-864 partial
 * data tree. The LLM speaks in dotted paths ("part4.name.familyName") so
 * these helpers merge extraction results into the working case state.
 */

export function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.')
  let cursor: Record<string, unknown> = obj
  for (let i = 0; i < keys.length - 1; i += 1) {
    const k = keys[i]
    const next = cursor[k]
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      const fresh: Record<string, unknown> = {}
      cursor[k] = fresh
      cursor = fresh
    } else {
      cursor = next as Record<string, unknown>
    }
  }
  cursor[keys[keys.length - 1]] = value
}

export function getPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.')
  let cursor: unknown = obj
  for (const k of keys) {
    if (typeof cursor !== 'object' || cursor === null) return undefined
    cursor = (cursor as Record<string, unknown>)[k]
  }
  return cursor
}

export function flattenPaths(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenPaths(v as Record<string, unknown>, key))
    } else {
      out[key] = v
    }
  }
  return out
}

export function mergeExtractionIntoState(
  state: Record<string, unknown>,
  fields: Record<string, unknown>
): Record<string, unknown> {
  const next = structuredClone(state) as Record<string, unknown>
  for (const [path, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === '') continue
    setPath(next, path, value)
  }
  return next
}
