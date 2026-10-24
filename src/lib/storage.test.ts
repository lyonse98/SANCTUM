import { describe, it, expect, beforeEach } from 'vitest';
import { wipeAllSanctumData } from './storage';

/** Minimal Storage whose keys are own enumerable properties, like the browser's. */
function makeStorage(): Storage {
  const store: Record<string, string> = {};
  Object.defineProperties(store, {
    getItem: { value: (k: string) => (k in store ? store[k] : null) },
    setItem: { value: (k: string, v: string) => { store[k] = String(v); } },
    removeItem: { value: (k: string) => { delete store[k]; } },
    clear: { value: () => { Object.keys(store).forEach((k) => delete store[k]); } },
  });
  return store as unknown as Storage;
}

// Every key prefix the app writes today. The wipe contract: a new persisted feature
// adds its key under sanctum_ (covered automatically) AND to this list, so the test
// fails if a key ships that the wipe's prefix rule would not catch.
const KNOWN_KEYS = [
  'sanctum_chat_history_joseph',
  'sanctum_settings',
  'sanctum_persona',
  'sanctum_terms_accepted',
  'sanctum_daily_msg_count',
  'sanctum_daily_msg_date',
  'sanctum_email_reminder',
  'sanctum_analytics_session',
  'sanctum_analytics_opt_in',
  'sanctum_last_visit',
  'sanctum_visit_count',
  'sanctum_install_prompted',
  'sanctum_examen',
  'sanctum_examen_last_date',
  'sanctum_examen_streak',
  'sanctum_rule_of_life',
  'sanctum_rule_checks',
  'sanctum_confession_notes',
  'sanctum_readings_2026-10-24',
  'sanctum_reflection_2026-10-24',
  'sanctum_passage_john-1',
];

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: makeStorage(), configurable: true });
});

describe('panic wipe', () => {
  it('removes every known sanctum_ key', () => {
    for (const key of KNOWN_KEYS) localStorage.setItem(key, 'x');
    wipeAllSanctumData();
    for (const key of KNOWN_KEYS) {
      expect(localStorage.getItem(key), key).toBeNull();
    }
  });

  it('removes sanctum_ keys from sessionStorage too', () => {
    sessionStorage.setItem('sanctum_chat_history_paul', 'x');
    wipeAllSanctumData();
    expect(sessionStorage.getItem('sanctum_chat_history_paul')).toBeNull();
  });

  it('leaves other origins’ keys untouched', () => {
    localStorage.setItem('some_other_app_key', 'keep');
    wipeAllSanctumData();
    expect(localStorage.getItem('some_other_app_key')).toBe('keep');
  });
});
