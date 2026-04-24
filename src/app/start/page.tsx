import { redirect } from 'next/navigation'

/**
 * `/start` is retired — triage now lives on `/` as a chat-first experience.
 * Any inbound links (old bookmarks, external references) bounce to the new
 * front door. The original 6-step wizard lives in git history
 * (pre-refactor commit) if we ever need to restore it.
 */
export default function StartRedirect(): never {
  redirect('/')
}
