/*
  Audition mode for the audio renderer (Nov 13, 2026): hear a voice recipe
  before it ships. Erik hears the production narrators as robotic, and the
  suspects are the TTS model tier, the WSOLA tempo stretch most personas
  carry, and the encode — in that order. Rather than change production on a
  guess, an audition renders ONE short passage several ways (the production
  model as-is, the same voice with the stretch bypassed, a Pro-tier model)
  and Erik's ear decides.

  An audition is a pure render: lexicon → one TTS call → decode → optional
  stretch → the production MP3 encode, returned as base64 in the response.
  No storage writes, no daily_audio rows, no chaining. It exists only for a
  caller carrying the render key — the handler's guard is isAuditionRequest
  below, the same arrangement as the force and step flags: without the key
  the flag is inert and the request follows the normal paths.

  This file holds everything testable (guard, validation, the tempo seam,
  the pipeline over injected speech/encode) so vitest can pin it without
  the edge runtime; index.ts supplies the real TTS call and encoder.
  Logs and errors carry stage/model/voice/tempo metadata only — never text.
*/

import { decodeSpeechAudio, secondsOf, stretchPcm } from "./audioEngine.ts";
import { applyLexicon } from "./narratorCore.ts";

/**
 * The only models an audition may name. The production model leads (the
 * audition's first job is to reproduce the current recipe exactly); the two
 * preview-tier ids are the challengers Erik asked to hear. Anything else is
 * rejected — the endpoint is a comparison tool, not a general TTS proxy.
 */
export const AUDITION_MODELS: readonly string[] = [
  "gemini-3.8-flash-tts",
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts",
];

/** ~350 chars ≈ 25 s of speech ≈ 1.4 s CPU worst case: one call fits the cap. */
export const AUDITION_MAX_TEXT_CHARS = 600;

/** The persona bank's own span is 0.88–1.08; the audition range hugs it. */
export const AUDITION_MIN_TEMPO = 0.8;
export const AUDITION_MAX_TEMPO = 1.1;

export interface AuditionRequest {
  text: string;
  voiceName: string;
  model: string;
  tempo: number;
}

export type AuditionParse =
  | { ok: true; request: AuditionRequest }
  | { ok: false; error: string };

/**
 * The key guard, exactly as the handler applies it: the audition mode is
 * honored only when the call carries the valid render key. Without it,
 * `audition: true` in a body changes nothing at all.
 */
export function isAuditionRequest(
  body: Record<string, unknown> | null | undefined,
  keyMatches: boolean,
): boolean {
  return keyMatches && body != null && body.audition === true;
}

/**
 * Validate an audition body. `defaultModel` (the production TTS model) is
 * used when the body omits `model`; a named model must be on AUDITION_MODELS.
 * Tempo defaults to 1.0 — the bypass point — when omitted.
 */
export function parseAuditionRequest(
  body: Record<string, unknown>,
  defaultModel: string,
): AuditionParse {
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return { ok: false, error: "text required" };
  if (text.length > AUDITION_MAX_TEXT_CHARS) {
    return { ok: false, error: `text exceeds ${AUDITION_MAX_TEXT_CHARS} characters` };
  }

  const voiceName = typeof body.voiceName === "string" ? body.voiceName.trim() : "";
  if (!voiceName) return { ok: false, error: "voiceName required" };

  const named = body.model;
  const model =
    named === undefined || named === null || named === "" ? defaultModel : named;
  if (typeof model !== "string" || !AUDITION_MODELS.includes(model)) {
    return { ok: false, error: "unknown model" };
  }

  const tempo = body.tempo === undefined || body.tempo === null ? 1.0 : body.tempo;
  if (
    typeof tempo !== "number" ||
    !Number.isFinite(tempo) ||
    tempo < AUDITION_MIN_TEMPO ||
    tempo > AUDITION_MAX_TEMPO
  ) {
    return { ok: false, error: "tempo out of range" };
  }

  return { ok: true, request: { text, voiceName, model, tempo } };
}

/**
 * The one controlled difference from the production piece path: tempo 1.0
 * is a TRUE bypass — the decoded samples pass through untouched, not a
 * unity-ratio WSOLA pass — so an audition at 1.0 isolates the stretch's
 * contribution to the robotic quality. Any other tempo goes through
 * stretchPcm exactly as a production piece render does.
 */
export function applyAuditionTempo(samples: Int16Array, tempo: number): Int16Array {
  if (tempo === 1.0) return samples;
  return stretchPcm(samples, tempo);
}

/** The two production stages an audition borrows, injected for tests. */
export interface AuditionSpeech {
  /** One TTS call with the given model + voice; returns the raw speech bytes. */
  speak: (text: string, voiceName: string, model: string) => Promise<Uint8Array>;
  /** The production MP3 encode (24 kHz mono CBR 64 kbps). */
  encode: (samples: Int16Array) => Uint8Array;
}

/**
 * The audition pipeline: lexicon, one TTS call, decode, the tempo seam, the
 * production encode. Returns the encoded bytes and the PCM duration in
 * seconds (one decimal, as the daily_audio row reports durations).
 */
export async function renderAudition(
  request: AuditionRequest,
  speech: AuditionSpeech,
): Promise<{ mp3: Uint8Array; seconds: number }> {
  const bytes = await speech.speak(
    applyLexicon(request.text),
    request.voiceName,
    request.model,
  );
  const pcm = applyAuditionTempo(decodeSpeechAudio(bytes), request.tempo);
  const mp3 = speech.encode(pcm);
  return { mp3, seconds: Math.round(secondsOf(pcm) * 10) / 10 };
}

/** Bytes → base64 in chunks (a single fromCharCode spread would overflow). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
