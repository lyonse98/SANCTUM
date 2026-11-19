import type { Audience } from '@/types';
import { tailorEndpoint, type TailorMorningRecord } from '@/lib/tailor';

/**
 * Close the day — the Tailor PM twin, client side (Nov 14, 2026).
 *
 * The evening counterpart of Tailor Today. This morning's intake lives
 * only on this device (TailorMeta's morning record); at dusk the user
 * picks one word for how the day actually went, and the device sends the
 * morning and the word to the tailor-devotional function's PM mode —
 * transiently, exactly like the morning call. The server stores none of
 * it; the evening package it returns is cached HERE for the night, under
 * the tailor prefix, so re-opening Tonight re-reads the close instead of
 * rebuilding it (the function's own allowance is one close per day).
 * Text only: the twin has no narration in v1, by deliberate scope.
 */

/** How the day went against the morning — the dusk word, in the bank's voice. */
export type EveningState = 'held' | 'broke' | 'mixed' | 'heavy';

export const EVENING_STATES: { id: EveningState; label: string }[] = [
  { id: 'held', label: 'I held' },
  { id: 'broke', label: 'I broke' },
  { id: 'mixed', label: 'A mixed day' },
  { id: 'heavy', label: 'It was heavy' },
];

export function isEveningState(value: unknown): value is EveningState {
  return value === 'held' || value === 'broke' || value === 'mixed' || value === 'heavy';
}

/** The evening package the close returns — three short pieces, nothing else. */
export interface TailorPmPackage {
  /** The night reflection: the morning's intention reckoned against the day. */
  reflect: string;
  /** One closing prayer — traditional, or composed in the app's voice. */
  prayer: string;
  /** One line to carry into sleep. */
  carry: string;
}

const PM_PREFIX = 'sanctum_tailor_pm_';

/** The night's cache key — same tailor prefix family, so the panic wipe covers it. */
export function tailorPmKey(dateKey: string, audience: Audience): string {
  return audience === 'women' ? `${PM_PREFIX}women_${dateKey}` : `${PM_PREFIX}${dateKey}`;
}

interface StoredPm {
  eveningState: EveningState;
  evening: TailorPmPackage;
}

function parsePmPackage(raw: unknown): TailorPmPackage | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.reflect !== 'string' || typeof p.prayer !== 'string' || typeof p.carry !== 'string') {
    return null;
  }
  if (!p.reflect.trim() || !p.prayer.trim() || !p.carry.trim()) return null;
  return { reflect: p.reflect, prayer: p.prayer, carry: p.carry };
}

/** Tonight's already-written close, read back from the device — or null. */
export function loadTonightsClose(
  dateKey: string,
  audience: Audience,
): { eveningState: EveningState; evening: TailorPmPackage } | null {
  try {
    const raw = localStorage.getItem(tailorPmKey(dateKey, audience));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPm;
    if (!isEveningState(parsed.eveningState)) return null;
    const evening = parsePmPackage(parsed.evening);
    return evening ? { eveningState: parsed.eveningState, evening } : null;
  } catch {
    return null;
  }
}

/** Keeps tonight's close on the device for the night. */
export function saveTonightsClose(
  dateKey: string,
  audience: Audience,
  eveningState: EveningState,
  evening: TailorPmPackage,
): void {
  try {
    const value: StoredPm = { eveningState, evening };
    localStorage.setItem(tailorPmKey(dateKey, audience), JSON.stringify(value));
  } catch {
    // storage unavailable — the close still reads for this sitting
  }
}

export interface TailorPmDeps {
  fetchImpl?: typeof fetch;
}

/**
 * Builds tonight's close through the function's PM mode: the morning
 * record from this device plus the dusk word, one call, the package back
 * and cached on-device for the night. A cached close is returned without
 * a call — the function's allowance is one close per day, and the night
 * page must re-open as written.
 */
export async function buildCloseOfDay(
  dateKey: string,
  audience: Audience,
  morning: TailorMorningRecord,
  eveningState: EveningState,
  deps: TailorPmDeps = {},
): Promise<TailorPmPackage> {
  const cached = loadTonightsClose(dateKey, audience);
  if (cached) return cached.evening;
  const endpoint = tailorEndpoint();
  if (!endpoint) throw new Error('tailor-unconfigured');
  const res = await (deps.fetchImpl ?? fetch)(endpoint.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: endpoint.anonKey,
      Authorization: `Bearer ${endpoint.anonKey}`,
    },
    body: JSON.stringify({
      mode: 'pm',
      date: dateKey,
      audience,
      morning: {
        state: morning.state,
        focus: morning.focus,
        tone: morning.tone,
        freeText: morning.freeText,
      },
      eveningState,
    }),
    // One short generation — nothing like the morning build's minute.
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`tailor-pm-http-${res.status}`);
  const body = (await res.json()) as Record<string, unknown>;
  const evening = parsePmPackage(body.evening);
  if (body.ok !== true || !evening) throw new Error('tailor-pm-unusable');
  saveTonightsClose(dateKey, audience, eveningState, evening);
  return evening;
}
