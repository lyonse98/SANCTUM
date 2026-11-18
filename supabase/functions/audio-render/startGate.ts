/*
  The render-start gate (P-1, Nov 18, 2026) — the pure decision for who
  may start a fresh daily render. index.ts wires it to the request; the
  discipline is pinned here.

  A fresh start is this function's only unauthenticated spend: one plain
  POST { date, audience } used to build the day's bundle (generating the
  day's reflection if it was missing) and chain a complete TTS render,
  for ANY date the caller named — a year of dates times two tracks, on
  repeat. Two credentials now authorize a start:

  - the render key (x-render-key) — the owner's manual door, the same
    secret that already gates force / step / audition;
  - the cron token (x-render-cron) — a random token generated inside
    the database by the hardening migration and held in a deny-all
    table (audio_render_cron_token). The four schedule jobs read it at
    call time, so the token is written down nowhere: not in this repo,
    not in the job definitions, not in any file a person holds.

  DEPLOY-ORDER GUARD: if no stored token can be read — the migration
  has not landed yet, or the read failed — the gate reports
  "unconfigured" and index.ts lets the start through with an error
  log, this function's standing posture (a deploy must never silence a
  morning; see readReflection's guard). The moment the store answers,
  a missing or wrong token is a hard refusal. Nothing a caller sends
  can open the unconfigured path: it depends only on the database side
  being absent, never on the request.
*/

export type StartGateVia = "key" | "cron" | "unconfigured";

export interface StartGateDecision {
  allowed: boolean;
  /** How the start was authorized — null when refused. */
  via: StartGateVia | null;
}

/** Constant-time string equality — credential comparison must not leak by timing. */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function evaluateStartGate(input: {
  /** The x-render-key header matched the AUDIO_RENDER_KEY secret. */
  keyMatches: boolean;
  /** The x-render-cron header as presented (null when absent). */
  presentedCronToken: string | null;
  /**
   * The token read from the database, or null when none could be read
   * (table absent, row absent, or the read failed) — the unconfigured
   * case, handled per the deploy-order guard in the header.
   */
  storedCronToken: string | null;
}): StartGateDecision {
  if (input.keyMatches) {
    return { allowed: true, via: "key" };
  }
  if (input.storedCronToken) {
    const matches =
      input.presentedCronToken !== null &&
      input.presentedCronToken.length > 0 &&
      timingSafeEqualString(input.presentedCronToken, input.storedCronToken);
    return matches ? { allowed: true, via: "cron" } : { allowed: false, via: null };
  }
  return { allowed: true, via: "unconfigured" };
}
