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
  'sanctum_tonight_resolve',
  'sanctum_rule_of_life',
  'sanctum_rule_checks',
  'sanctum_confession_notes',
  'sanctum_confession_lens',
  'sanctum_last_confession',
  'sanctum_novena_st-joseph',
  'sanctum_novena_st-joseph_intention',
  'sanctum_readings_2026-10-24',
  'sanctum_reflection_2026-10-24',
  'sanctum_audience',
  'sanctum_reflection_women_2026-10-24',
  'sanctum_passage_john-1',
  'sanctum_tailor_profile_men',
  'sanctum_tailor_profile_women',
  'sanctum_tailor_share_2026-11-13_men',
  'sanctum_reminder_prompt_dismissed_at',
  'sanctum_listen_reminder_prompted',
  'sanctum_days_prayed',
  'sanctum_keepsakes',
  'sanctum_kept_days',
  'sanctum_month_examen_seen',
  'sanctum_gift_slot',
  'sanctum_companion_chat_days',
  'sanctum_letters',
  'sanctum_letter_threads',
  'sanctum_challenges_lived',
  'sanctum_favorite_companion_men',
  'sanctum_favorite_companion_women',
  'sanctum_listen_speed',
  'sanctum_reading_size',
  'sanctum_patron_saint',
  'sanctum_reader_name',
  'sanctum_usual_mass',
  'sanctum_parish_patron',
  'sanctum_come_home',
  'sanctum_parish_reminders',
  'sanctum_tailor_ready_ping',
  'sanctum_profile_tally_token',
  'sanctum_profile_tally_sent',
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

  it('deletes the tailor cache — the devotional and its banked narration pieces alike', async () => {
    // The tailor store (lib/tailor) keeps the cached devotional AND the
    // stitch's piece bank (the devotional's key + ':pieces') in the one
    // Cache Storage cache, 'sanctum-tailor-v1'. The wipe deletes every
    // cache wholesale, so both go together — this pins that the bank can
    // never outlive a panic wipe.
    const deleted: string[] = [];
    Object.defineProperty(globalThis, 'caches', {
      value: {
        keys: async () => ['sanctum-tailor-v1'],
        delete: async (k: string) => {
          deleted.push(k);
          return true;
        },
      },
      configurable: true,
    });
    try {
      wipeAllSanctumData();
      // The wipe fires the cache deletion without awaiting it; let it land.
      await new Promise((r) => setTimeout(r, 0));
      expect(deleted).toContain('sanctum-tailor-v1');
    } finally {
      Object.defineProperty(globalThis, 'caches', { value: undefined, configurable: true });
    }
  });
});
