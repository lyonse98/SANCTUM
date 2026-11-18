import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRIVACY_PARAGRAPH, PRIVACY_SERVER_INTRO, PRIVACY_SERVER_LIST } from './privacyCopy';

/**
 * The before-Wednesday batch (multi-lens audit, Nov 16, 2026; Erik's slate
 * rulings the same day). Each pin guards one behaviour or sentence the
 * batch changed, so a later edit cannot quietly undo the fix: crisis help
 * one tap away, the gate speaking plainly, the first Listen tap playing,
 * the panic wipe turning the pokes off, zoom restored, and privacy copy
 * that is literally true everywhere it stands.
 */

const ROOT = join(__dirname, '..', '..');
const readSrc = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf8');
const readRoot = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const gate = readSrc('components/TermsModal.tsx');
const home = readSrc('components/HomeScreen.tsx');
const crisisLine = readSrc('components/CrisisLine.tsx');
const about = readSrc('components/AboutSanctumPage.tsx');
const listenBar = readSrc('components/ListenBar.tsx');
const app = readSrc('App.tsx');
const push = readSrc('lib/push.ts');
const reminderForm = readSrc('components/ReminderForm.tsx');
const tailor = readSrc('components/TailorToday.tsx');

describe('W-1 — crisis help is a tap, not a treasure hunt', () => {
  it('988 on the welcome gate is a tel: link', () => {
    expect(gate).toContain('href="tel:988"');
  });

  // Deliberate change (Erik, Nov 18, 2026): the canonical line became one
  // shared component, and Today carries it at its foot ONLY — the
  // under-masthead line this pin once required was retired at his word
  // ("only bottom; not needed for a devotional"). The gate's 988 above is
  // untouched, and the other rooms carry the line at their heads.
  it('the canonical line lives in one shared component, a tel: link', () => {
    expect(crisisLine).toContain('In crisis? Call or text');
    expect(crisisLine).toContain('href="tel:988"');
    expect(crisisLine).toContain('— free, day or night.');
  });

  it('Today carries the line once, at its foot — not under the masthead', () => {
    const mounts = home.match(/<CrisisLine/g) ?? [];
    expect(mounts).toHaveLength(1);
    expect(home.indexOf('<CrisisLine')).toBeGreaterThan(home.indexOf('<MoreOfSanctum'));
    expect(home).not.toContain('href="tel:988"');
  });
});

describe('W-5 — the gate says what the app does, and why it asks', () => {
  it('one plain line leads: the day, in a sentence, no account', () => {
    expect(gate).toContain('Each day: today');
    expect(gate).toContain('prayers and the Rosary. No account.');
  });

  it('the track choice carries its reason — and the choice itself stays', () => {
    expect(gate).toContain('so the reflections and companions are written for your');
    expect(gate).toContain('disabled={checking || !choice}');
  });

  it('the legal block stands below the Enter button', () => {
    expect(gate.indexOf('Enter Sanctum')).toBeLessThan(
      gate.indexOf('automated AI spiritual companion and habit tool'),
    );
  });

  it('the Bloy thesis still stands at the door', () => {
    expect(gate).toContain('{MISSION_LINE}');
    expect(gate).toContain('{MISSION_ATTRIBUTION}');
  });
});

describe('W-4 — the privacy copy is plain, and literally true', () => {
  it('the gate paragraph speaks of phones, not relays', () => {
    expect(PRIVACY_PARAGRAPH).toContain('What you type stays on this phone');
    expect(PRIVACY_PARAGRAPH).toContain('sent to an AI service once');
    expect(PRIVACY_PARAGRAPH).not.toContain('relay');
    expect(PRIVACY_PARAGRAPH).not.toContain('AI provider');
  });

  it('the server list is still five things — and now all of them are whole', () => {
    expect(PRIVACY_SERVER_INTRO).toBe('Five things can be held on a server, and nothing else:');
    expect(PRIVACY_SERVER_LIST).toHaveLength(5);
    const pushRow = PRIVACY_SERVER_LIST.find((item) => item.includes('notification subscription'));
    expect(pushRow).toContain('encryption keys');
    expect(pushRow).toContain('the track you chose');
    expect(pushRow).toContain('timezone');
    const feedbackRow = PRIVACY_SERVER_LIST.find((item) => item.includes('feedback note'));
    expect(feedbackRow).toContain('email address');
    const tailorRow = PRIVACY_SERVER_LIST.find((item) => item.includes('tailored devotional'));
    expect(tailorRow).toContain('deleted within 90 days');
    expect(tailorRow).toContain('none of your answers');
  });

  it('About names the Tailor store in its own list, with the 90 days', () => {
    expect(about).toContain('the devotional it writes: the text itself');
    expect(about).toContain('deleted within 90 days');
    expect(about).toContain('an email address only if she adds one');
    expect(about).toContain('an email address only if he adds one');
  });

  it('About no longer promises the retired rule of life (W-3)', () => {
    expect(about).not.toContain('rule of life');
  });
});

describe('W-6 — the first Listen tap plays', () => {
  it('there is no blocking disclosure card left in the bar', () => {
    expect(listenBar).not.toContain('handleListenFromCard');
    expect(listenBar).not.toContain('setShowDisclosure(true)');
    expect(listenBar).toContain('void prepareAndPlay();');
  });

  it('the disclosure stands as a note under the playing bar, once per track', () => {
    expect(listenBar).toContain('data-listen-disclosure-note');
    expect(listenBar).toContain('narratorDisclosureLine(audience)');
    expect(listenBar).toContain('showDisclosureNote');
  });
});

describe('W-7 — the reminder form is plain and pre-frames the ask', () => {
  it('the not-installed face no longer speaks of pokes', () => {
    expect(reminderForm).not.toContain('poked');
    expect(reminderForm).toContain('tab cannot receive notifications');
  });

  it('one sentence warns before the phone\u2019s permission ask', () => {
    expect(reminderForm).toContain('your phone will ask whether Sanctum may send notifications');
    expect(reminderForm).toContain('that ask is only for this reminder');
  });
});

describe('W-8 — the panic wipe turns the pokes off at the source', () => {
  it('the panic handler deactivates push BEFORE the local wipe', () => {
    const start = app.indexOf('const handlePanic');
    const slice = app.slice(start, start + 1500);
    expect(slice.indexOf('deactivatePushOnPanic()')).toBeGreaterThanOrEqual(0);
    expect(slice.indexOf('deactivatePushOnPanic()')).toBeLessThan(slice.indexOf('wipeAllSanctumData()'));
  });

  it('the helper drops the browser subscription and deactivates the server row', () => {
    expect(push).toContain('export function deactivatePushOnPanic');
    expect(push).toContain("callRpc('deactivate_push_subscription', buildDeactivateBody(endpoint))");
    expect(push).toContain('subscription.unsubscribe()');
  });

  it('the panic screen says what was cleared: this device', () => {
    expect(app).toContain('All data cleared from this device. You are safe.');
    expect(app).not.toContain('All data cleared. You are safe.');
  });
});

describe('W-10 — pinch-zoom is the reader\u2019s again', () => {
  it('the viewport meta carries no scale lock', () => {
    const html = readRoot('index.html');
    expect(html).not.toContain('user-scalable=no');
    expect(html).not.toContain('maximum-scale');
    expect(html).toContain('width=device-width, initial-scale=1.0, viewport-fit=cover');
  });
});

describe('ruling #4 — one plain privacy sentence above the Tailor\u2019s first question', () => {
  it('the sentence stands, and it stands before the first question', () => {
    expect(tailor).toContain('What you type here stays on this phone.');
    expect(tailor).toContain('never stored on a server');
    expect(tailor.indexOf('What you type here stays on this phone.')).toBeLessThan(
      tailor.indexOf('How are you coming in?'),
    );
  });
});
