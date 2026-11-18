/**
 * The reader's name (Erik, Nov 18, 2026): what Sanctum may call the
 * reader, given by the reader and kept on this device only, under the
 * sanctum_ prefix (the panic wipe takes it with everything else). It is
 * a dedicated store on purpose: the chat client reads this module for
 * the name and nothing else, the way it reads the profile store for the
 * North Star and nothing else. Where the name travels, it travels as
 * the name itself — one optional field in a chat request, one
 * allowlisted field in a companion's letter packet — and nowhere else.
 */

export const READER_NAME_KEY = 'sanctum_reader_name';

/** The name's own cap, matched on the server: forty characters. */
export const READER_NAME_MAX = 40;

/** The stored name — whitespace-normalized and capped — or null when unset. */
export function loadReaderName(): string | null {
  try {
    const raw = localStorage.getItem(READER_NAME_KEY);
    if (!raw) return null;
    const name = raw.replace(/\s+/g, ' ').trim().slice(0, READER_NAME_MAX);
    return name ? name : null;
  } catch {
    return null;
  }
}

/** Keeps the name on this device; an empty value clears it. */
export function saveReaderName(value: string): void {
  try {
    const name = value.replace(/\s+/g, ' ').trim().slice(0, READER_NAME_MAX);
    if (!name) localStorage.removeItem(READER_NAME_KEY);
    else localStorage.setItem(READER_NAME_KEY, name);
  } catch {
    // storage unavailable — Sanctum simply goes on without a name to use
  }
}
