import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACCESS_CONTACT_MAX,
  ACCESS_NAME_MAX,
  ACCESS_NOTE_MAX,
  ACCESS_URL,
  buildAccessRequestPayload,
  isAccessArrival,
  submitAccessRequest,
  validateAccessRequest,
} from './accessRequest';
import { PRIVACY_SERVER_LIST } from './privacyCopy';

const ROOT = join(__dirname, '..', '..');
const readSrc = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf8');

/**
 * The access-request door (Erik, Nov 20, 2026): while the app is in a
 * small testing season, the public link (?access=1 — the Instagram
 * bio) opens a request surface before the welcome gate. A name, a way
 * to reach the person, one optional line; the request rides the
 * feedback door to where Erik already reads, and he sends the app
 * link personally. These pins hold the shape: the route, the bounds,
 * the exact wire payload (kind + three fields, nothing else), the
 * page's refusal to link into the app, and the privacy copy's honesty
 * about the one thing this surface keeps on a server.
 */

describe('the arrival', () => {
  it('only the access link opens the door', () => {
    expect(isAccessArrival('?access=1')).toBe(true);
    expect(isAccessArrival('?access=1&focus=gospel')).toBe(true);
    expect(isAccessArrival('?comehome=1')).toBe(false);
    expect(isAccessArrival('?access=2')).toBe(false);
    expect(isAccessArrival('')).toBe(false);
    expect(ACCESS_URL).toBe('https://sanctumdaily.app/?access=1');
  });
});

describe('the form bounds', () => {
  it('a name and a way back are required; the third line is not', () => {
    const errors = validateAccessRequest({ name: '', contact: '', note: '' });
    expect(errors.name).toBeTruthy();
    expect(errors.contact).toBeTruthy();
    expect(errors.note).toBeUndefined();
    expect(validateAccessRequest({ name: 'Jane', contact: 'jane@example.com', note: '' })).toEqual({});
    expect(validateAccessRequest({ name: '  Jane  ', contact: '  @jane  ', note: '  ' })).toEqual({});
  });

  it('whitespace alone is not a name or a contact', () => {
    const errors = validateAccessRequest({ name: '   ', contact: ' ', note: '' });
    expect(errors.name).toBeTruthy();
    expect(errors.contact).toBeTruthy();
  });

  it('the caps hold at the field limits', () => {
    const atCaps = validateAccessRequest({
      name: 'n'.repeat(ACCESS_NAME_MAX),
      contact: 'c'.repeat(ACCESS_CONTACT_MAX),
      note: 'x'.repeat(ACCESS_NOTE_MAX),
    });
    expect(atCaps).toEqual({});
    const over = validateAccessRequest({
      name: 'n'.repeat(ACCESS_NAME_MAX + 1),
      contact: 'c'.repeat(ACCESS_CONTACT_MAX + 1),
      note: 'x'.repeat(ACCESS_NOTE_MAX + 1),
    });
    expect(over.name).toBeTruthy();
    expect(over.contact).toBeTruthy();
    expect(over.note).toBeTruthy();
  });
});

describe('the payload — kind and three fields, nothing else', () => {
  it('rides the feedback door as an access request on the access page', () => {
    const payload = buildAccessRequestPayload({ name: 'Jane Smith', contact: '555-0134', note: '' });
    expect(payload.category).toBe('other');
    expect(payload.page).toBe('access');
    expect(Object.keys(payload).sort()).toEqual(['category', 'message', 'page']);
  });

  it('the message carries the kind first, then the labeled fields', () => {
    const payload = buildAccessRequestPayload({
      name: ' Jane Smith ',
      contact: ' 555-0134 ',
      note: 'Sent by my sister.',
    });
    const lines = payload.message.split('\n');
    expect(lines[0]).toBe('ACCESS REQUEST');
    expect(lines).toContain('Name: Jane Smith');
    expect(lines).toContain('Contact: 555-0134');
    expect(lines).toContain('Note: Sent by my sister.');
  });

  it('an empty note leaves no dangling line', () => {
    const payload = buildAccessRequestPayload({ name: 'Jane', contact: '555-0134', note: '   ' });
    expect(payload.message).not.toContain('Note:');
  });

  it('an email contact also lands in the email column, normalized', () => {
    const payload = buildAccessRequestPayload({ name: 'Jane', contact: 'Jane@Example.COM', note: '' });
    expect(payload.contactEmail).toBe('jane@example.com');
    expect(Object.keys(payload).sort()).toEqual(['category', 'contactEmail', 'message', 'page']);
  });

  it('a phone or a handle never enters the email column', () => {
    for (const contact of ['555-0134', '@jane_on_ig', 'jane at example dot com']) {
      const payload = buildAccessRequestPayload({ name: 'Jane', contact, note: '' });
      expect('contactEmail' in payload).toBe(false);
      expect(payload.message).toContain(`Contact: ${contact}`);
    }
  });

  it('the three fields never travel as their own keys', () => {
    const payload = buildAccessRequestPayload({ name: 'Jane', contact: 'jane@example.com', note: 'hi' });
    expect(Object.keys(payload)).not.toContain('name');
    expect(Object.keys(payload)).not.toContain('contact');
    expect(Object.keys(payload)).not.toContain('note');
  });
});

describe('the submit', () => {
  const fields = { name: 'Jane Smith', contact: 'jane@example.com', note: '' };

  function fakeFetch(response: { ok: boolean; body?: unknown } | Error) {
    const calls: { url: string; init?: RequestInit }[] = [];
    const impl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (response instanceof Error) throw response;
      return { ok: response.ok, json: async () => response.body ?? {} } as Response;
    }) as unknown as typeof fetch;
    return { impl, calls };
  }

  it('posts the payload to the feedback function and resolves ok', async () => {
    const { impl, calls } = fakeFetch({ ok: true, body: { ok: true } });
    const result = await submitAccessRequest(fields, { fetchImpl: impl, url: 'https://x/functions/v1/feedback-submit', anonKey: 'k' });
    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://x/functions/v1/feedback-submit');
    const sent = JSON.parse(String(calls[0].init?.body)) as unknown;
    expect(sent).toEqual(buildAccessRequestPayload(fields));
  });

  it("surfaces the function's own error line when it refuses", async () => {
    const { impl } = fakeFetch({ ok: false, body: { error: 'That is a lot of feedback at once.' } });
    const result = await submitAccessRequest(fields, { fetchImpl: impl, url: 'https://x/f', anonKey: 'k' });
    expect(result).toEqual({ ok: false, error: 'That is a lot of feedback at once.' });
  });

  it('a dead connection becomes one quiet line, never a throw', async () => {
    const { impl } = fakeFetch(new Error('offline'));
    const result = await submitAccessRequest(fields, { fetchImpl: impl, url: 'https://x/f', anonKey: 'k' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('No connection');
  });
});

describe('the route — before the gate, like the come-home door', () => {
  it('App renders the request surface ahead of the welcome gate', () => {
    const app = readSrc('App.tsx');
    expect(app).toContain('isAccessArrival(window.location.search)');
    expect(app.indexOf('if (accessActive)')).toBeGreaterThan(-1);
    expect(app.indexOf('if (accessActive)')).toBeLessThan(app.indexOf('if (!termsAccepted)'));
    expect(app).toContain('<AccessRequestPage');
  });
});

describe('the page — it asks, and it does not admit', () => {
  const page = readSrc('components/AccessRequestPage.tsx');

  it('carries the house furniture: the season head, the ask, the crisis line', () => {
    expect(page).toContain('Sanctum is in a small testing season');
    expect(page).toContain('Email, phone, or Instagram — however he should reach you');
    expect(page).toContain('Who sent you, or anything he should know?');
    expect(page).toContain('<CrisisLine');
    expect(page).toContain('data-access-request-page');
  });

  it('states the one kept thing plainly, beside the form', () => {
    expect(page).toContain('This request is the one thing kept on a server');
    expect(page).toContain('Nothing in the app itself is stored.');
  });

  it('the confirmation promises no timing and opens no door', () => {
    expect(page).toContain('Your request is in.');
    expect(page).toContain('hear from Erik personally');
    expect(page).toContain('data-access-success');
  });

  it('never links into the app — the domain appears nowhere on the page', () => {
    expect(page).not.toContain('sanctumdaily.app');
    expect(page).not.toContain('href=');
  });

  it('collects nothing else: no analytics, no tally, no core act, no device storage', () => {
    expect(page).not.toContain('lib/analytics');
    expect(page).not.toContain('profileTally');
    expect(page).not.toContain('recordCoreAct');
    expect(page).not.toContain('localStorage');
    expect(page).not.toContain('sessionStorage');
    const lib = readSrc('lib/accessRequest.ts');
    expect(lib).not.toContain('lib/analytics');
    expect(lib).not.toContain('recordCoreAct');
    expect(lib).not.toContain('localStorage');
  });
});

describe('the copy — the promise names the request', () => {
  it('the Terms list carries the access request as its own item', () => {
    const row = PRIVACY_SERVER_LIST.find((item) => item.includes('access request'));
    expect(row).toBeTruthy();
    expect(row).toContain('the name you give');
    expect(row).toContain('kept only so you can be answered');
  });

  it("About's held-remotely sentence names it on both tracks", () => {
    const about = readSrc('components/AboutSanctumPage.tsx');
    expect(about).toContain('an access request if she sends one');
    expect(about).toContain('an access request if he sends one');
  });
});
