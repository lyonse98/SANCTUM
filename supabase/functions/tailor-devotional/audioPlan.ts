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
  token: HMAC-SHA256 over `date|audience|index|sha256hex(text)`, keyed with
  the AUDIO_RENDER_KEY secret. The endpoint recomputes it before rendering
  a single sample, so a caller can only ever render the exact pieces a real
  build issued, for that date and that track — never arbitrary text, never
  another day. If the key is unset, the build omits the plan entirely and
  the text package stands alone, exactly as the interim builds did.

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
  /** HMAC-SHA256 over date|audience|index|sha256hex(text) — see the header. */
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

/** The token a plan entry carries: the build's signature over its own piece. */
export async function signPieceToken(
  secret: string,
  dateISO: string,
  audience: NarratorAudience,
  index: number,
  text: string,
): Promise<string> {
  const payload = `${dateISO}|${audience}|${index}|${await sha256Hex(text)}`;
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload));
  return bytesToHex(new Uint8Array(signature));
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

/**
 * The piece endpoint's gate: the token presented must be the signature over
 * EXACTLY the (date, audience, index, text) presented. Any tampering — other
 * words, another index, another day, another track — fails, and so does a
 * token minted under a different key.
 */
export async function verifyPieceToken(
  secret: string,
  dateISO: string,
  audience: NarratorAudience,
  index: number,
  text: string,
  token: string,
): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  const expected = await signPieceToken(secret, dateISO, audience, index, text);
  return timingSafeEqual(expected, token);
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
