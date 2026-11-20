/**
 * The access-request door (Erik, Nov 20, 2026): while Sanctum is in a
 * small testing season, the public link — the Instagram bio link —
 * points at a request page, not at the open app:
 * https://sanctumdaily.app/?access=1. A visitor gives a name and a way
 * to reach them; Erik reads the requests where he already reads
 * feedback and sends the app link personally to the people he lets in.
 * The app itself gains no gate from this — the door is only the link.
 *
 * The submission rides the feedback door (feedback-submit →
 * feedback_submissions), because that is where Erik reads, and the
 * deployed function's shape decides the packaging: its category enum
 * is closed (idea / bug / other) and its contact_email column accepts
 * email addresses only. So a request travels as category "other" with
 * page "access", its kind and its three fields composed legibly into
 * the message, and the contact ALSO lands in contact_email whenever
 * the contact happens to be an email address. A first-class "access"
 * category is a one-line function change whenever it is wanted; the
 * page ships on the door that works today.
 *
 * A request is the one thing on this surface that is kept on a server
 * — a name and a contact, so a person can be answered — and the page
 * says so in plain words beside the form. Nothing else is collected:
 * no analytics event, no tally, no core act, nothing stored on the
 * device either.
 */

export const ACCESS_PARAM = 'access';

/** The link the bio points to — a request page, never the open app. */
export const ACCESS_URL = 'https://sanctumdaily.app/?access=1';

export const ACCESS_NAME_MAX = 60;
export const ACCESS_CONTACT_MAX = 120;
export const ACCESS_NOTE_MAX = 200;

/** True when this arrival came through the access-request link. */
export function isAccessArrival(search: string): boolean {
  try {
    return new URLSearchParams(search).get(ACCESS_PARAM) === '1';
  } catch {
    return false;
  }
}

export interface AccessRequestFields {
  name: string;
  contact: string;
  note: string;
}

export type AccessRequestErrors = Partial<Record<keyof AccessRequestFields, string>>;

/**
 * The form's bounds, enforced here as well as by the inputs' own
 * maxLength: a name and a way back are required (the link is sent
 * personally, to a person), the third line is optional. Messages are
 * plain sentences meant to stand quietly under a field.
 */
export function validateAccessRequest(fields: AccessRequestFields): AccessRequestErrors {
  const errors: AccessRequestErrors = {};
  const name = fields.name.trim();
  const contact = fields.contact.trim();
  const note = fields.note.trim();
  if (!name) errors.name = 'Please give your name — he answers requests personally.';
  else if (name.length > ACCESS_NAME_MAX) errors.name = `Please keep your name under ${ACCESS_NAME_MAX} characters.`;
  if (!contact) errors.contact = 'Please give a way to reach you — email, phone, or Instagram.';
  else if (contact.length > ACCESS_CONTACT_MAX)
    errors.contact = `Please keep that under ${ACCESS_CONTACT_MAX} characters.`;
  if (note.length > ACCESS_NOTE_MAX) errors.note = `Please keep that line under ${ACCESS_NOTE_MAX} characters.`;
  return errors;
}

/** The same shape the feedback function accepts as an email address. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AccessRequestPayload {
  category: 'other';
  page: 'access';
  message: string;
  contactEmail?: string;
}

/**
 * The wire shape — and nothing else. The kind stands at the head of
 * the message where Erik will see it first, then the three fields,
 * each labeled; the optional line is omitted when it is empty. The
 * contact rides contact_email too when it is an email address, so it
 * sits in the column built for it; a phone number or an Instagram
 * handle lives in the message, where it stays legible.
 */
export function buildAccessRequestPayload(fields: AccessRequestFields): AccessRequestPayload {
  const name = fields.name.trim();
  const contact = fields.contact.trim();
  const note = fields.note.trim();
  const lines = ['ACCESS REQUEST', `Name: ${name}`, `Contact: ${contact}`];
  if (note) lines.push(`Note: ${note}`);
  const payload: AccessRequestPayload = {
    category: 'other',
    page: 'access',
    message: lines.join('\n'),
  };
  if (EMAIL_PATTERN.test(contact) && contact.length <= 254) {
    payload.contactEmail = contact.toLowerCase();
  }
  return payload;
}

export interface AccessRequestDeps {
  fetchImpl?: typeof fetch;
  url?: string;
  anonKey?: string;
}

/**
 * Sends the request through the feedback door. Resolves, never throws:
 * the page turns the result into either the confirmation or one quiet
 * line. The function's own error strings are written for readers, so
 * they are surfaced as they come.
 */
export async function submitAccessRequest(
  fields: AccessRequestFields,
  deps: AccessRequestDeps = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const url = deps.url ?? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/feedback-submit`;
  const anonKey = deps.anonKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(buildAccessRequestPayload(fields)),
    });
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      return { ok: false, error: body?.error ?? 'Could not send that just now. Please try again.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'No connection. Your words are still here — try again when you are back online.' };
  }
}
