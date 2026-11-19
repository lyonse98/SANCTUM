import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clearHistory, loadHistory, saveHistory } from './storage';

/**
 * The companion repairs (Erik's live testing, Nov 19, 2026). Three pins:
 *
 * R1 — the chat must stand on its own surface. In a long conversation
 * the typing box vanished and the page scrolled instead of the chat:
 * the column stood in document flow at h-dvh, and the feed — a flex
 * child that could not shrink — grew past the screen. The fix is
 * structural (fixed root, min-h-0 feed, shrink-0 input) and these pins
 * keep each piece of it from quietly reverting.
 *
 * R2 — clear this conversation is narrow: the open thread and this one
 * companion's stored history, nothing else. The behavioural test below
 * seeds the neighbouring records and proves they stand after the clear.
 *
 * R3 — no erasure fires on a single tap. The panic wipe, the clear,
 * the Tailor profile erase, and the examination wipe each open the
 * shared confirmation sheet first; the destructive call lives only
 * behind the sheet's final tap. These pins read the wiring, the seam
 * the codebase already uses, and hold the ordering.
 */

const ROOT = join(__dirname, '..', '..');
const readSrc = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf8');

const app = readSrc('App.tsx');
const header = readSrc('components/Header.tsx');
const chatFeed = readSrc('components/ChatFeed.tsx');
const chatInput = readSrc('components/ChatInput.tsx');
const settings = readSrc('components/SettingsModal.tsx');
const confession = readSrc('components/ConfessionGuide.tsx');
const sheet = readSrc('components/ConfirmEraseSheet.tsx');

/** The slice of a source file from one marker to the next, for scoped pins. */
const sliceFrom = (src: string, marker: string, length = 1600) => {
  const at = src.indexOf(marker);
  expect(at, `marker not found: ${marker}`).toBeGreaterThanOrEqual(0);
  return src.slice(at, at + length);
};

describe('R1 — the conversation stands on a fixed surface, the feed scrolls within', () => {
  it('the chat root is fixed inset-0, not a document-flow h-dvh column', () => {
    expect(app).toContain('fixed inset-0 flex flex-col max-w-2xl mx-auto overflow-hidden');
    expect(app).not.toContain('h-dvh');
  });

  it('the feed can shrink: min-h-0 on the scroll area and the empty state', () => {
    expect(chatFeed).toContain('flex-1 min-h-0 overflow-y-auto chat-scroll');
    expect(chatFeed).toContain('flex-1 min-h-0 flex flex-col items-center justify-center');
  });

  it('the typing box cannot be pushed: flex-shrink-0 on the input wrapper', () => {
    expect(chatInput).toContain('flex-shrink-0 px-4 pt-2.5 pb-3 border-t');
  });
});

describe('R3 — the shared sheet is one calm shape for every erasure', () => {
  it('names what goes and what stays, and the final tap carries the act', () => {
    expect(sheet).toContain('data-confirm-erase-sheet');
    expect(sheet).toContain('data-confirm-erase-confirm');
    expect(sheet).toContain('What goes');
    expect(sheet).toContain('What stays');
    expect(sheet).toContain('Not yet');
  });

  it('no red-alert styling in the sheet', () => {
    expect(sheet).not.toContain('B91C1C');
    expect(sheet).not.toContain('991B1B');
    expect(sheet).not.toContain('185,28,28');
    expect(sheet).not.toContain('153,27,27');
  });
});

describe('R3 — the panic wipe confirms before anything is erased', () => {
  it('the header shield opens the sheet; it no longer calls the handler directly', () => {
    expect(app).toContain('onPanic={() => setPanicConfirmOpen(true)}');
    expect(app).not.toContain('onPanic={handlePanic}');
  });

  it('the wipe itself is called from exactly one place — the handler the sheet confirms into', () => {
    const calls = app.match(/wipeAllSanctumData\(\)/g) ?? [];
    expect(calls).toHaveLength(1);
    const sheetBlock = sliceFrom(app, 'open={panicConfirmOpen}');
    expect(sheetBlock).toContain('confirmLabel="Erase everything"');
    expect(sheetBlock).toContain('onConfirm={() => { setPanicConfirmOpen(false); handlePanic(); }}');
  });

  it('the sheet names the scope in plain words', () => {
    const sheetBlock = sliceFrom(app, 'open={panicConfirmOpen}');
    expect(sheetBlock).toContain('Your companion conversations');
    expect(sheetBlock).toContain('Your Tailor profile and the choices in it.');
    expect(sheetBlock).toContain('Your days prayed, and the Kept shelf with them.');
    expect(sheetBlock).toContain('letters left for you');
    expect(sheetBlock).toContain('reminders are switched off');
    expect(sheetBlock).toContain('Nothing on a server holds your words');
  });
});

describe('R2 — clear this conversation confirms first, and stays narrow', () => {
  it('the header clear door opens the sheet; it no longer calls the handler directly', () => {
    expect(app).toContain('onClear={() => setClearConfirmOpen(true)}');
    expect(app).not.toContain('onClear={handleClear}');
    expect(header).toContain('aria-label="Clear this conversation"');
  });

  it('the sheet names what stays, in Erik’s words', () => {
    const sheetBlock = sliceFrom(app, 'open={clearConfirmOpen}');
    expect(sheetBlock).toContain('confirmLabel="Clear this conversation"');
    expect(sheetBlock).toContain('Your profile, days prayed, and settings stay.');
    expect(sheetBlock).toContain('onConfirm={() => { setClearConfirmOpen(false); handleClear(); }}');
  });

  it('the handler’s whole reach is this companion’s history — and incognito’s pause is honoured', () => {
    const handler = sliceFrom(app, 'const handleClear', 700);
    expect(handler).toContain('clearHistory(personaId)');
    expect(handler).toContain('!incognito');
    expect(handler).not.toContain('wipeAllSanctumData');
    expect(handler).not.toContain('eraseTailorProfile');
    expect(handler).not.toContain('localStorage');
  });
});

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

describe('R2 — the clear’s blast radius, behaviourally', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
    Object.defineProperty(globalThis, 'sessionStorage', { value: makeStorage(), configurable: true });
  });

  it('removes only the named companion’s history; profile, tallies, letters, cap and the other conversation stand', () => {
    saveHistory('augustine', [{ role: 'user', content: 'for augustine' }]);
    saveHistory('therese', [{ role: 'user', content: 'for therese' }]);
    // The neighbours the clear must never touch:
    localStorage.setItem('sanctum_tailor_profile_men', '{"seasonOfLife":"x"}');
    localStorage.setItem('sanctum_days_prayed', '{"dates":["2026-11-19"]}');
    localStorage.setItem('sanctum_kept_days', '["2026-11-18"]');
    localStorage.setItem('sanctum_letters', '[{"personaId":"therese"}]');
    localStorage.setItem('sanctum_companion_chat_days', '{"therese":["2026-11-18"]}');
    localStorage.setItem('sanctum_daily_msg_count', '7');
    localStorage.setItem('sanctum_daily_msg_date', '2026-11-19');
    localStorage.setItem('sanctum_settings', '{"x":1}');

    clearHistory('augustine');

    expect(loadHistory('augustine')).toEqual([]);
    expect(loadHistory('therese')).toHaveLength(1);
    expect(localStorage.getItem('sanctum_tailor_profile_men')).toContain('seasonOfLife');
    expect(localStorage.getItem('sanctum_days_prayed')).toContain('2026-11-19');
    expect(localStorage.getItem('sanctum_kept_days')).toContain('2026-11-18');
    expect(localStorage.getItem('sanctum_letters')).toContain('therese');
    expect(localStorage.getItem('sanctum_companion_chat_days')).toContain('therese');
    expect(localStorage.getItem('sanctum_daily_msg_count')).toBe('7');
    expect(localStorage.getItem('sanctum_settings')).toContain('"x":1');
  });
});

describe('R3 — the Settings profile erase confirms first', () => {
  it('the button opens the sheet; eraseTailorProfile is called from the sheet alone', () => {
    expect(settings).toContain('onClick={() => setEraseProfileConfirmOpen(true)}');
    const calls = settings.match(/eraseTailorProfile\(audience\)/g) ?? [];
    expect(calls).toHaveLength(1);
    const sheetBlock = sliceFrom(settings, 'open={eraseProfileConfirmOpen}');
    expect(sheetBlock).toContain('confirmLabel="Erase profile"');
    expect(sheetBlock).toContain('eraseTailorProfile(audience)');
    expect(sheetBlock).toContain('Devotionals already built stay');
  });

  it('the button still reads Erase Tailor profile', () => {
    expect(settings).toContain('Erase Tailor profile');
  });
});

describe('R3 — the examination wipe confirms first', () => {
  it('the Wipe Notes button opens the sheet; it no longer wipes directly', () => {
    expect(confession).not.toContain('onClick={wipeNotes}');
    expect(confession).toContain('onClick={() => setWipeConfirmOpen(true)}');
    const sheetBlock = sliceFrom(confession, 'open={wipeConfirmOpen}');
    expect(sheetBlock).toContain('confirmLabel="Wipe notes"');
    expect(sheetBlock).toContain('onConfirm={() => { setWipeConfirmOpen(false); wipeNotes(); }}');
  });
});
