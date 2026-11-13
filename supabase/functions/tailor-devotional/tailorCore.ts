/*
  Tailor Today's composition core — the pure half of the tailor-devotional
  function (intake validation, prompt assembly, passage/media selection,
  script assembly, response shaping). Everything here is deterministic and
  free of network, storage, and environment access, so the vitest suite can
  pin the whole composition with the model layer mocked. index.ts wires the
  real dependencies (bundle reads, the Gemini call, TTS) into composeTailored.

  NO COMPANION LENS (Erik, Nov 12, 2026): companions are text-only and live
  in their chats. The tailoring is done here, on the narrator side — the
  intake aims the generation directly, under the Scripture-grounding blocks
  and the tailor task, and the day's narrator frames and voices the result.
  No persona sheet enters any prompt this module builds.

  PRIVACY, BY CONSTRUCTION: this module holds no persistence of any kind.
  The intake and the composed devotional pass through it and out with the
  HTTP response; nothing here can write them anywhere.
*/

import {
  isTailorFocus,
  isTailorState,
  mediaSearchUrl,
  pickMedia,
  pickPassage,
  tailorFocusLabel,
  tailorStateLabel,
  type TailorFocus,
  type TailorMedia,
  type TailorPassage,
  type TailorState,
} from "./tailorBank.ts";
import {
  AUDIO_PM_START_HOUR,
  PERSONA_DISPLAY,
  assembleTailoredScript,
  type NarratorAudience,
  type TailoredReadingPart,
  type TailoredScript,
} from "./narratorCore.ts";
import {
  SCRIPTURE_GROUNDING,
  SCRIPTURE_GROUNDING_WOMEN,
  buildTailorTask,
} from "./prompts.ts";

export interface TailorIntake {
  state: TailorState;
  focus: TailorFocus;
  /** The user's own line about the morning — optional, capped, never stored. */
  freeText: string;
}

/**
 * Validates a request payload into an intake, or returns null. Every field
 * is allowlisted: state and focus must be bank keys, and the free text is
 * trimmed to one short line. There is no lens field — a payload carrying
 * one simply has it ignored.
 */
export function validateIntake(payload: Record<string, unknown>): TailorIntake | null {
  if (!isTailorState(payload.state)) return null;
  if (!isTailorFocus(payload.focus)) return null;
  const freeText = typeof payload.freeText === "string"
    ? payload.freeText.replace(/\s+/g, " ").trim().slice(0, 200)
    : "";
  return { state: payload.state, focus: payload.focus, freeText };
}

/** The day's canonical bundle, as read from the day's own rows. */
export interface TailorBundle {
  celebration: string | null;
  gospelCitation: string;
  /** Zone 1 — verbatim. Composed into the script untouched, never regenerated. */
  gospelText: string;
  /** The day's readings entire, in lectionary order — all verbatim. */
  readings: TailoredReadingPart[];
  reflect: string;
  challenge: string;
  facet: string;
}

export interface TailoredParts {
  reflect: string;
  challenge: string;
}

/** The system prompt: the grounding block for the track, then the tailor task. */
export function buildTailorSystemPrompt(audience: NarratorAudience): string {
  const grounding = audience === "women" ? SCRIPTURE_GROUNDING_WOMEN : SCRIPTURE_GROUNDING;
  return `${grounding}\n\n${buildTailorTask(audience)}`;
}

/** The user prompt: the canonical day + the curated passage + this morning. */
export function buildTailorUserPrompt(
  bundle: TailorBundle,
  intake: TailorIntake,
  passage: TailorPassage,
): string {
  const lines: string[] = [];
  lines.push(`Today's Gospel: ${bundle.gospelCitation}`);
  if (bundle.celebration) lines.push(`The Church celebrates: ${bundle.celebration}`);
  lines.push(`\nThe day's canonical reflection (${bundle.facet}):\n${bundle.reflect}`);
  lines.push(`\nThe day's canonical challenge:\n${bundle.challenge}`);
  lines.push(
    `\nThe curated passage for this need — ${passage.citation} (${passage.translation}):\n"${passage.text}"`,
  );
  lines.push(`\nHow this person is coming in: ${tailorStateLabel(intake.state)}.`);
  lines.push(`What today is about: ${tailorFocusLabel(intake.focus)}.`);
  if (intake.freeText) lines.push(`In their own words: "${intake.freeText}"`);
  lines.push(
    `\nRe-aim the reflection and the challenge at this morning, under the rules above. Output only the JSON object.`,
  );
  return lines.join("\n");
}

/**
 * Parses the model's JSON into the two tailored parts, or null. Tolerant of a
 * code fence around the object; strict about shape — both parts must be real
 * strings of sane length, clamped to the spoken lengths the task promises.
 */
export function parseTailorResult(text: string): TailoredParts | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    if (typeof parsed.reflect !== "string" || typeof parsed.challenge !== "string") return null;
    const reflect = parsed.reflect.trim().slice(0, 1600);
    const challenge = parsed.challenge.trim().slice(0, 400);
    if (reflect.length < 10 || challenge.length < 3) return null;
    return { reflect, challenge };
  } catch {
    return null;
  }
}

export interface ComposedTailored {
  passage: TailorPassage;
  media: TailorMedia & { searchUrl: string };
  tailored: TailoredParts;
  script: TailoredScript;
  /** The day narrator's name — the only credit the tailored devotional carries. */
  narratorName: string;
}

export interface ComposeDeps {
  dateISO: string;
  audience: NarratorAudience;
  intake: TailorIntake;
  bundle: TailorBundle;
  /** The one model call — injected so tests mock the model layer. */
  generateTailored: (systemPrompt: string, userPrompt: string) => Promise<TailoredParts>;
  /** Device hour at build time — picks the AM or PM head, as the player does. */
  hour: number;
}

/**
 * The whole composition, end to end, minus I/O: select the passage and the
 * media pick from the bank, run the one generation, and assemble the
 * narrator's script around the day's readings ENTIRE — every part asserted
 * byte-for-byte verbatim in the tests.
 */
export async function composeTailored(deps: ComposeDeps): Promise<ComposedTailored> {
  const { dateISO, audience, intake, bundle } = deps;
  const passage = pickPassage(intake.focus, intake.state, dateISO);
  const mediaPick = pickMedia(intake.focus, dateISO);
  const media = { ...mediaPick, searchUrl: mediaSearchUrl(mediaPick) };

  const systemPrompt = buildTailorSystemPrompt(audience);
  const userPrompt = buildTailorUserPrompt(bundle, intake, passage);
  const tailored = await deps.generateTailored(systemPrompt, userPrompt);

  const script = assembleTailoredScript({
    dateISO,
    audience,
    celebration: bundle.celebration,
    gospelCitation: bundle.gospelCitation,
    gospelText: bundle.gospelText,
    readings: bundle.readings,
    reflect: tailored.reflect,
    challenge: tailored.challenge,
    facet: bundle.facet,
    scene: null,
    tomorrowCelebration: null,
    tomorrowGospelCitation: null,
    passageCitation: passage.citation,
    passageText: passage.text,
    head: deps.hour < AUDIO_PM_START_HOUR ? "am" : "pm",
  });

  return {
    passage,
    media,
    tailored,
    script,
    narratorName: PERSONA_DISPLAY[script.persona]?.name ?? "The Lector",
  };
}

/** The response body the client parses — text, media card, credit, and the audio. */
export function buildResponseBody(
  dateISO: string,
  composed: ComposedTailored,
  audioBase64: string,
  audioSeconds: number,
): Record<string, unknown> {
  return {
    ok: true,
    date: dateISO,
    narratorId: composed.script.persona,
    narratorName: composed.narratorName,
    passage: {
      citation: composed.passage.citation,
      text: composed.passage.text,
      translation: composed.passage.translation,
    },
    reflect: composed.tailored.reflect,
    challenge: composed.tailored.challenge,
    media: {
      type: composed.media.type,
      title: composed.media.title,
      creator: composed.media.creator,
      searchUrl: composed.media.searchUrl,
    },
    audioBase64,
    audioSeconds,
  };
}
