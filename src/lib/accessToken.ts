/**
 * The access token (Erik's design, Nov 20, 2026): gate the spend, not
 * the page. While Sanctum is in a small testing season, the costly
 * doors — companion chats and letters (chat-proxy), Tailor builds,
 * closes, and audio pieces (tailor-devotional) — ask for a personal
 * token, one per approved person. Everything else in the app is open
 * exactly as before: the daily devotional is generated once and shared,
 * so the porch stays open to anyone holding the app link.
 *
 * How a token arrives: Erik approves a request from the request page
 * and sends the person their personal link, https://sanctumdaily.app/
 * ?k=<token>. On load, the app keeps the token on this device — under
 * `sanctum_access_token`, inside the panic wipe like everything else —
 * and takes it out of the address bar at once, so it does not linger
 * in screenshots or ride along when the page is shared onward. A new
 * link replaces the stored token: a re-issued link heals a revoked
 * one. The token then rides, as one top-level field, on the gated
 * calls and on nothing else — never in an analytics event, a tally
 * payload, or a feedback note (pinned by source scan).
 *
 * This module is the ONLY place the stored token is read or written;
 * every call site asks here.
 */

export const ACCESS_TOKEN_KEY = 'sanctum_access_token';
export const ACCESS_TOKEN_PARAM = 'k';

/** The stable machine code the gated functions refuse with, at 403. */
export const ACCESS_REQUIRED_CODE = 'access_required';

/**
 * The calm line a blocked surface shows (Erik's register, Nov 20,
 * 2026): one sentence, no error styling, no codes. Surfaces that can
 * render a link pair it with the request page (ACCESS_URL in
 * accessRequest.ts); the chat carries the address as text.
 */
export const ACCESS_BLOCKED_MESSAGE =
  'Sanctum is in a small testing season. Companions and tailored devotionals are for the testing circle right now.';

/** The server's own bounds (accessGate.ts in both gated functions):
 *  issued tokens are long random strings; anything outside this shape
 *  is not one of ours and is neither stored nor sent. */
const ACCESS_TOKEN_MIN_CHARS = 16;
const ACCESS_TOKEN_MAX_CHARS = 200;

export function isWellFormedAccessToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= ACCESS_TOKEN_MIN_CHARS &&
    value.length <= ACCESS_TOKEN_MAX_CHARS &&
    !/\s/.test(value)
  );
}

/** The token this device holds, or null. A stored value that is not
 *  token-shaped (a hand edit, a truncated write) reads as no token. */
export function loadAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(ACCESS_TOKEN_KEY);
    return isWellFormedAccessToken(raw) ? raw : null;
  } catch {
    return null;
  }
}

function storeAccessToken(token: string): void {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {
    // storage unavailable — the token simply does not persist; the
    // gated doors will answer with the calm line, as for any stranger.
  }
}

/** The token a `?k=` arrival carries, validated — or null. */
export function accessTokenFromSearch(search: string): string | null {
  try {
    const raw = new URLSearchParams(search).get(ACCESS_TOKEN_PARAM);
    return isWellFormedAccessToken(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** True when the arrival carries the parameter at all (even malformed),
 *  so the caller knows to take it out of the address bar. */
export function hasAccessTokenParam(search: string): boolean {
  try {
    return new URLSearchParams(search).has(ACCESS_TOKEN_PARAM);
  } catch {
    return false;
  }
}

/** The URL with the token parameter removed — every other parameter
 *  and the hash ride through untouched. */
export function stripAccessTokenParam(href: string): string {
  try {
    const url = new URL(href);
    url.searchParams.delete(ACCESS_TOKEN_PARAM);
    return url.pathname + url.search + url.hash;
  } catch {
    return href;
  }
}

export interface AccessCaptureDeps {
  href?: string;
  search?: string;
  replaceUrl?: (url: string) => void;
}

/**
 * The arrival, whole: if the location carries a token, keep it (a new
 * one replaces the stored one), and take the parameter out of the
 * address bar whether the token was well-formed or not — a credential,
 * or anything shaped like one, does not sit in a URL. Returns true
 * when a token was captured.
 */
export function captureAccessTokenFromLocation(deps: AccessCaptureDeps = {}): boolean {
  const href = deps.href ?? window.location.href;
  const search = deps.search ?? window.location.search;
  if (!hasAccessTokenParam(search)) return false;
  const token = accessTokenFromSearch(search);
  if (token) storeAccessToken(token);
  const replace = deps.replaceUrl ?? ((url: string) => window.history.replaceState(null, '', url));
  replace(stripAccessTokenParam(href));
  return token !== null;
}

/** True when a gated call's refusal is the access refusal — the one
 *  answer every blocked surface turns into the calm line. */
export function isAccessRequired(status: number, body: unknown): boolean {
  if (status !== 403) return false;
  if (!body || typeof body !== 'object') return false;
  return (body as { error?: unknown }).error === ACCESS_REQUIRED_CODE;
}
