import { DEFAULT_FOCUS, isReminderFocus } from '@/lib/reminderFocus';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const EMAIL_KEY = 'sanctum_email_reminder';

export interface EmailReminderState {
  enabled: boolean;
  email: string;
  /**
   * Which part of Sanctum the morning email points at. Kept here as well as on the server so the
   * form can show the current choice without asking the database for it.
   */
  focus: string;
  /**
   * Secret handed out by the database when the address was saved. It is the only thing that
   * can stop the emails later, since there is no account to sign in to. It lives on this
   * device and is never readable from the server.
   */
  token: string;
}

const DEFAULT_STATE: EmailReminderState = { enabled: false, email: '', focus: DEFAULT_FOCUS, token: '' };

export function loadEmailReminder(): EmailReminderState {
  try {
    const raw = localStorage.getItem(EMAIL_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<EmailReminderState>;
    const focus = typeof parsed.focus === 'string' && isReminderFocus(parsed.focus) ? parsed.focus : DEFAULT_FOCUS;
    return {
      enabled: Boolean(parsed.enabled),
      email: typeof parsed.email === 'string' ? parsed.email : '',
      focus,
      token: typeof parsed.token === 'string' ? parsed.token : '',
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveEmailReminder(state: EmailReminderState): void {
  try {
    localStorage.setItem(EMAIL_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode, quota) — the server still has the subscription.
  }
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export interface EmailReminderResult {
  ok: boolean;
  message: string;
}

function rpcHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function callRpc(fn: string, body: Record<string, unknown>): Promise<{ ok: boolean; data: unknown }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: rpcHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`rpc ${fn} failed with status ${res.status}`);
    return { ok: false, data: null };
  }

  return { ok: true, data: await res.json().catch(() => null) };
}

/**
 * Opt in to the daily reminder email, and say what it should point at. The address is the only
 * thing kept on a server: no name, no account, and nothing linking it to any conversation. The
 * database returns a token that this device keeps so the subscription can be stopped later
 * without signing in.
 *
 * Saving again with the same address is how the focus is changed — there is no separate update
 * path, so the two can never drift apart.
 */
export async function subscribeEmailReminder(email: string, focus: string): Promise<EmailReminderResult> {
  const normalized = email.trim().toLowerCase();
  if (!isValidEmail(normalized)) {
    return { ok: false, message: 'That email address does not look right. Check it and try again.' };
  }

  const safeFocus = isReminderFocus(focus) ? focus : DEFAULT_FOCUS;

  try {
    const { ok, data } = await callRpc('subscribe_email_reminder', {
      p_email: normalized,
      p_focus: safeFocus,
    });

    if (!ok) {
      return { ok: false, message: "We couldn't save that just now. Try again in a moment." };
    }

    if (typeof data !== 'string' || data.length === 0) {
      return { ok: false, message: "We couldn't save that just now. Try again in a moment." };
    }

    saveEmailReminder({ enabled: true, email: normalized, focus: safeFocus, token: data });
    return { ok: true, message: 'Saved. Your address is on the list.' };
  } catch (err) {
    console.error('subscribeEmailReminder failed:', err);
    return { ok: false, message: 'No connection. Try again when you are back online.' };
  }
}

/** Stop the emails. The row is kept but marked inactive, so it never gets mailed again. */
export async function unsubscribeEmailReminder(token: string): Promise<EmailReminderResult> {
  if (!token) {
    return { ok: false, message: 'This device no longer holds the key to that subscription.' };
  }

  try {
    const { ok, data } = await callRpc('unsubscribe_email_reminder', { p_token: token });

    if (!ok) {
      return { ok: false, message: "We couldn't stop that just now. Try again in a moment." };
    }

    if (data !== true) {
      return { ok: false, message: 'That subscription is no longer on the list.' };
    }

    const current = loadEmailReminder();
    saveEmailReminder({ ...current, enabled: false });
    return { ok: true, message: 'Emails stopped.' };
  } catch (err) {
    console.error('unsubscribeEmailReminder failed:', err);
    return { ok: false, message: 'No connection. Try again when you are back online.' };
  }
}
