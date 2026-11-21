/*
  The client-orchestrated audio plan (Nov 13, 2026) — how Tailor Today's
  narration survives the platform's 2 s-per-request CPU ceiling.

  A tailored program is ~2.5 minutes of speech ≈ 6 s of cumulative
  stretch+encode CPU: it can NEVER render inside one invocation, at any plan
  tier — the in-function render (TAILOR_AUDIO_ENABLED in index.ts) stays off
  for exactly that reason. So the build returns the text package at once,
  plus this plan: the SAME assembled script the disabled render block used,
  cut into spoken pieces of at most TAILOR_PIECE_MAX_CHARS (the proven
  ~15 s head-piece envelope), the produced silence standing as its own
  piece. The device then fetches each piece from the piece endpoint (index.ts)
  — one TTS + decode + stretch + encode per call, comfortably inside the
  ceiling — and concatenates the MP3 bytes on-device, exactly as the daily
  render's finalize concatenates across invocations. Nothing is stored
  server-side at any point: the plan rides in the build response, the pieces
  ride back one at a time, and the joined audio exists only on the device.

  AUTHORIZATION: pieces are fetched after the build, outside the build's
  quota — the plan entry itself is the capability. Each entry carries a
  token: `<expires>.<signature>`, the signature HMAC-SHA256 over
  `date|audience|index|sha256hex(text)|expires`, keyed with the
  AUDIO_RENDER_KEY secret, and `expires` the unix second the token dies —
  the plan's own date plus seven days (P-3, Nov 18, 2026: tokens used to
  carry no expiry and lived forever, so one captured plan was a permanent
  TTS faucet). The endpoint recomputes the signature before rendering a
  single sample and refuses an expired token, so a caller can only ever
  render the exact pieces a real build issued, for that date and that
  track, inside that week — never arbitrary text, never another day,
  never an old capture. A week is generous on purpose: the device
  stitches a plan within minutes of the build and caches the joined audio
  on-device, so the expiry only ever meets a plan that sat unlistened —
  and the owner's silent renewal is the ordinary one, a fresh build
  minting fresh tokens in the normal flow. Piece fetches also carry rate
  ceilings now (per caller and per token, on the companions' durable
  quota RPC — index.ts), so even a live capture replays at a trickle.
  If the key is unset, the build omits the plan entirely and the text
  package stands alone, exactly as the interim builds did.

  This module is pure (crypto.subtle aside): index.ts wires it to the
  request, and vitest pins the splitting and the token discipline here.
*/

import {
  TAILOR_PIECE_MAX_CHARS,
  splitReadingsParagraphs,
  splitSpokenText,
} from "./renderPieces.ts";
import type { NarratorAudience, TailoredScript } from "./narratorCore.ts";

/** One piece of the program, before signing: speech text, or the silence. */
export interface TailorAudioPieceText {
  kind: "speech" | "silence";
  /** The words to render — always "" for the silence piece. */
  text: string;
}

/** One plan entry as it rides in the build response and returns for its render. */
export interface TailorAudioPlanEntry {
  index: number;
  /** The spoken text ("" for the produced-silence piece). */
  text: string;
  /** `<expires>.<HMAC-SHA256>` over date|audience|index|sha256hex(text)|expires — see the header. */
  token: string;
}

/**
 * The program's pieces in render order — the identical sequence the disabled
 * in-function render produced: head, readings (paragraph split outermost,
 * every paragraph then cut to the cap), the supplement passage, the produced
 * silence as its own piece, and the second movement. Every speech piece is
 * at most TAILOR_PIECE_MAX_CHARS; the silence piece carries empty text.
 */
export function buildPieceTexts(script: TailoredScript): TailorAudioPieceText[] {
  const pieces: TailorAudioPieceText[] = [];
  const addSpeech = (text: string) => {
    for (const chunk of splitSpokenText(text, TAILOR_PIECE_MAX_CHARS)) {
      pieces.push({ kind: "speech", text: chunk });
    }
  };
  addSpeech(script.head);
  for (const paragraph of splitReadingsParagraphs(script.readings)) {
    addSpeech(paragraph);
  }
  addSpeech(script.passage);
  pieces.push({ kind: "silence", text: "" });
  addSpeech(script.mainB);
  return pieces;
}

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return bytesToHex(new Uint8Array(digest));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * How long a plan's tokens live past the plan's own date (P-3). The
 * device stitches within minutes and caches the joined audio, so a week
 * is all headroom for the owner — retries, a later open, a slow week —
 * while a captured plan rots on a schedule instead of living forever.
 */
export const PIECE_TOKEN_TTL_DAYS = 7;

/**
 * The unix second a plan's tokens die: the end of the plan's own date
 * plus PIECE_TOKEN_TTL_DAYS full days, derived from the date alone so
 * signing and verification always agree on it. An unparseable date
 * (never issued by the build, which validates first) falls back to a
 * week from the call — the token is still bounded, never open-ended.
 */
export function pieceTokenExpiry(dateISO: string): number {
  const midnightUtcMs = Date.parse(`${dateISO}T00:00:00.000Z`);
  const baseMs = Number.isFinite(midnightUtcMs) ? midnightUtcMs : Date.now();
  return Math.floor(baseMs / 1000) + (PIECE_TOKEN_TTL_DAYS + 1) * 86400;
}

async function signPayload(secret: string, payload: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload));
  return bytesToHex(new Uint8Array(signature));
}

/** The token a plan entry carries: the build's signature over its own piece, expiry included. */
export async function signPieceToken(
  secret: string,
  dateISO: string,
  audience: NarratorAudience,
  index: number,
  text: string,
): Promise<string> {
  const expires = pieceTokenExpiry(dateISO);
  const payload = `${dateISO}|${audience}|${index}|${await sha256Hex(text)}|${expires}`;
  return `${expires}.${await signPayload(secret, payload)}`;
}

/** Constant-time string equality — token comparison must not leak by timing. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface PieceTokenVerifyOptions {
  /** The clock, unix seconds — injectable so the tests can pin time. */
  nowSeconds?: number;
}

/**
 * The piece endpoint's gate: the token presented must be the signature over
 * EXACTLY the (date, audience, index, text, expiry) presented, and the
 * expiry must still be ahead of the clock. Any tampering — other words,
 * another index, another day, another track, a later expiry scribbled
 * over the real one — fails, and so does a token minted under a different
 * key, and so does a plan whose week has run out.
 */
export async function verifyPieceToken(
  secret: string,
  dateISO: string,
  audience: NarratorAudience,
  index: number,
  text: string,
  token: string,
  options: PieceTokenVerifyOptions = {},
): Promise<boolean> {
  const match = /^(\d{1,12})\.([0-9a-f]{64})$/.exec(token);
  if (match) {
    const expires = Number(match[1]);
    const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (!(expires > nowSeconds)) return false;
    const payload = `${dateISO}|${audience}|${index}|${await sha256Hex(text)}|${expires}`;
    const expected = `${expires}.${await signPayload(secret, payload)}`;
    return timingSafeEqual(expected, token);
  }
  return false;
}

/** The build's audio plan: the script's pieces, each signed for its own render call. */
export async function buildAudioPlan(
  secret: string,
  dateISO: string,
  audience: NarratorAudience,
  script: TailoredScript,
): Promise<TailorAudioPlanEntry[]> {
  const texts = buildPieceTexts(script);
  const entries: TailorAudioPlanEntry[] = [];
  for (let index = 0; index < texts.length; index++) {
    entries.push({
      index,
      text: texts[index].text,
      token: await signPieceToken(secret, dateISO, audience, index, texts[index].text),
    });
  }
  return entries;
}
