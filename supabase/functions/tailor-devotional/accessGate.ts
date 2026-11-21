// The access gate (Erik's design, Nov 20, 2026): gate the spend, not
// the page. Sanctum is in a small testing season; the app itself stays
// open, but the functions that spend Gemini money on a caller's behalf
// ask for a personal access token first — one token per approved
// person, issued out of band (see the access_tokens migration). This
// module is the whole check: shape, hash, one indexed lookup, verdict.
//
// The discipline, in order:
// - A missing or malformed token is refused WITHOUT a lookup — there
//   is nothing to look up, and the refusal costs no database call.
// - The raw token never leaves this module's caller frame: what is
//   looked up is its SHA-256 hash, and the hash is all the database
//   ever holds (the migration stores nothing else).
// - The check FAILS CLOSED. A lookup that errors, a table that cannot
//   be reached, a misconfigured function — every one reads as no
//   access. An outage closes the costly doors; it never opens them.
// - The token is never logged. Log lines in this function are stage
//   codes and counts; a credential is neither.

/** The stable machine code a refused caller receives, at HTTP 403. */
export const ACCESS_REQUIRED_ERROR = "access_required";

/** Bounds for a token worth hashing: issued tokens are long random
 *  strings; anything outside this shape is not one of ours. */
export const ACCESS_TOKEN_MIN_CHARS = 16;
export const ACCESS_TOKEN_MAX_CHARS = 200;

export function isWellFormedAccessToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= ACCESS_TOKEN_MIN_CHARS &&
    value.length <= ACCESS_TOKEN_MAX_CHARS &&
    !/\s/.test(value)
  );
}

export async function hashAccessToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface AccessGateDeps {
  fetchImpl?: typeof fetch;
  supabaseUrl?: string;
  apiKey?: string;
}

/**
 * True only when the presented token hashes to a row whose status is
 * 'active'. Every other outcome — malformed, unknown, revoked, lookup
 * failed — is false. The caller refuses with ACCESS_REQUIRED_ERROR
 * before consuming quota and before any model work.
 */
export async function checkAccessToken(rawToken: unknown, deps: AccessGateDeps = {}): Promise<boolean> {
  if (!isWellFormedAccessToken(rawToken)) return false;

  const fetchImpl = deps.fetchImpl ?? fetch;
  const supabaseUrl = deps.supabaseUrl ?? Deno.env.get("SUPABASE_URL");
  // The verdict door needs no privilege — the hash is the credential —
  // so the call presents the PUBLIC key, the one key style the
  // database API accepts in every generation. (On Nov 20, 2026 the
  // service key injected into the functions became a style the
  // database API rejects outright, and every service-key call failed
  // while public-key calls kept working.)
  const apiKey = deps.apiKey ?? Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !apiKey) {
    console.error("access gate misconfigured: missing SUPABASE_URL or an API key");
    return false;
  }

  try {
    const tokenHash = await hashAccessToken(rawToken);
    // The verdict comes from a security-definer database function, not
    // a direct table read: on Nov 20, 2026 the direct read failed from
    // inside the functions while the identical query succeeded from
    // everywhere else. The function answers true/false for a hash and
    // nothing more; the table itself stays locked down, and the answer
    // no longer depends on which role the caller presents as.
    const res = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/check_access_token`, {
      method: "POST",
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_token_hash: tokenHash }),
    });
    if (!res.ok) {
      console.error("access gate lookup failed with status", res.status);
      return false;
    }
    const verdict = (await res.json()) as unknown;
    return verdict === true;
  } catch (err) {
    console.error("access gate lookup error:", err instanceof Error ? err.message : String(err));
    return false;
  }
}
