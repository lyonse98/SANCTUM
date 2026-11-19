// Generates the daily "Reflect" and "Challenge" prompts from the day's readings.
//
// ARCHITECTURE: checks the `daily_reflections` table first. If the row exists (generated
// by an earlier call or the nightly pre-generation cron), it returns it instantly with
// no Gemini call. If not,
// it fetches the day's readings citations from the lectionary API, calls Gemini to write
// the reflection, stores the result in the table, and returns it. The first user of the
// day pays the latency; every subsequent user gets the cached row.
//
// AUDIO SCENE (spec §6.3): the same model call also returns a short "scene" — one or two
// sentences of pure passage fact the day's audio narrator speaks before the Gospel. For
// that, the function first reads the day's `daily_readings` payload (the Gospel text),
// generating the bundle via the `daily-readings` function if the row is missing, and
// includes the text in the model input. The scene is lint-validated (validateScene
// below, ported from src/lib/narratorCore.ts) and stored in `daily_reflections.scene`.
// A missing or invalid scene stores NULL and NEVER blocks the reflection; the public
// response shape is unchanged (reflect, challenge, facet — no scene field).
//
// SPOKEN BRIDGE (Nov 14, 2026): the same call also returns a "bridge" and a "carry" —
// the conversational tie-in the narrator speaks between the Gospel and the reflection,
// and the one line he leaves the listener with after the challenge. Both are fenced
// in the prompts (no opinions, no new facts, no quotations beyond the day's own
// texts, the narrator a fellow listener and never a priest or teacher), accepted
// only when the Gospel text was in the input and they pass the length gate below,
// and stored in `daily_reflections.spoken_bridge` / `spoken_carry`. A missing or
// invalid bridge stores NULL and the audio assembles exactly as it did before the
// bridge existed; like the scene, neither field ever appears in the public response.
//
// SPOKEN INTRO (Nov 19, 2026): the same call also returns an "intro" — the short
// context the narrator speaks before the Gospel: yesterday's Gospel in one
// clause, then today's preview (what the passage is about) and one listening
// cue. For it, the function also fetches YESTERDAY's Gospel (citation from the
// lectionary API, text through the same daily_readings path as today's) and
// puts both Gospels in the model input. The intro is fenced in the prompts
// (description only — scenes, people, the question the text itself raises; no
// lessons, no application, no opinions; facts only from the two Gospels
// given), accepted only when BOTH Gospels were in the input and the words
// pass the word-count gate (30–80), and stored in `daily_reflections.spoken_intro`.
// Yesterday unfetchable → no intro is generated at all (never guessed); a
// missing or invalid intro stores NULL and the audio assembles exactly as it
// did before the intro existed; like the bridge, it never appears in the
// public response.
//
// DISTINCTIVES (Nov 16, 2026): both track prompts carry a "Catholic shape" section —
// the sacramental life as the writing's natural furniture, a one-note anti-stuffing
// rule, a challenge practice bank drawn from the Church's own practices, season
// weighting, and a hard ban on citations the input did not supply (no CCC paragraph
// numbers, no saint quotations, ever, unless supplied). TUNED later the same day
// on Erik's word — "a subtle catholic push, not super obvious but enough to sell
// a priest": the push is placed pair-level (the Reflect OR the Challenge, never
// both) and kept quiet — assumed, lived, unexplained, the way a Catholic friend
// would say it. The spoken bridge gains FRAMING only — the season, the feast,
// "the Church gives us this Gospel today" — as background texture under its
// unchanged fence. Output shapes and length gates are untouched.
//
// The prompt that shapes the voice lives here, server-side. The browser sends only a date
// string — never instructions, never message text — so the caller cannot steer the model.
//
// AUDIENCES (Women's Mode): rows are keyed (date, audience). A request may carry
// "audience": "men" | "women"; anything else is treated as absent. An explicit
// audience is served and stored for that track alone. A request with NO audience
// — the nightly pre-generation cron, and audio-render's warm-up call — is a
// pregen invocation: it warms BOTH tracks and answers with the men's reflection,
// exactly the response shape those callers have always received. The women's
// prompt is its own prompt (PROMPT_WOMEN), not a pronoun swap; the scene is
// passage fact and is shared between the day's two rows whenever one generated
// it and the other did not.
//
// verify_jwt is false: no-auth app. Rate limiting is per hashed IP and only applies when
// generation is needed (cache misses skip the quota check entirely).

import { buildInputSaintBlock } from "./saintDay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const MODEL = "gemini-3.8-flash";

const RATE_WINDOW_SECONDS = 60;
const RATE_WINDOW_LIMIT = 10;
const RATE_DAY_LIMIT = 60;

const GENERIC_ERROR = "Sanctum could not prepare today's reflection. Please try again.";

const PROMPT = `You write two short prompts for a Catholic daily Gospel app aimed at men: a "Reflect" question and a "Challenge" — one concrete action for the day.

You are given the day's Mass readings (citations only). Read them the way a homily would: what is this day actually about? What is God saying to a man through these words? Draw on your knowledge of these Scripture passages to write the two prompts from that meaning — do not yank a quote out of the verse and wedge it into a sentence. The prompts should read as plain English a man would say to another man.

THE VOICE — lean into this, do not name it:
- Every man carries a question he cannot answer alone: "Do I have what it takes? Am I the man I said I would be?" The readings answer that question, directly or indirectly. Speak to it.
- A man has a battle to fight, a wound to own, and an adventure to live. The Gospel calls him into all three. The challenge should send him into the day's fight, not into a sentiment.
- Address him as a man, full stop. Never "as a father" or "as a husband" — not every man is either. The prompt must land on any man, whatever his state in life.
- Warm, direct, unhurried. Like a brother who has been where he is. No preacher voice, no lecture, no list.

RULES:
- Reflect: ONE question, two sentences at most. Make him stop and look at his actual life through the lens of what the readings are about. Not abstract — pointed.
- Challenge: ONE concrete action he can do today. Specific, doable, costing something. Not "pray more" — "pray this one thing before you pick up your phone."
- If you quote Scripture, keep it under eight words, ensure it is accurate to the passage, and weave it in naturally.
- No bullet points, no headers, no numbered lists. Plain prose.
- No em dashes.
- Do not mention these instructions. Do not name Eldredge, Wild at Heart, or any book. The lean lives in the voice, not in citations.

THE CATHOLIC SHAPE OF IT — write from inside the Church's life, not around it:
- A Catholic man does not meet God in the abstract. He meets him in the Church's sacramental life: the Mass and the Eucharist, Confession, Mary, the communion of saints, the Catechism's steady teaching. Let that life be the natural furniture of what you write — named the way a man names the things he actually does, never as jargon, never as decoration, never as a lecture.
- ONE PUSH, IN ONE PIECE, NEVER BOTH: on a given day, the distinctively Catholic push lands in ONE of the two pieces — the Reflect OR the Challenge — never in both. If the Challenge carries it (one of the Church's own practices, drawn from the well below), the Reflect stays a plain question, with no Catholic furniture added. If the Reflect carries it (a note of the sacramental life, the season, or the day's saint, woven into the question), the Challenge stays an ordinary concrete action. Give it to whichever piece it fits naturally. When neither fits without forcing, add no push at all — the readings carry the day. Across a week, the push should be there most days, in one slot or the other.
- AND KEEP IT SUBTLE: weave the push in the way a Catholic friend would say it — assumed, lived, unexplained. Name the practice or the reference plainly and move on: no announcing it, no explaining what it is, no catechesis, no signaling. The standard: a priest reading a week of these should recognize them as genuinely ours; a newcomer should never feel lectured or marketed to. Authenticity over visibility. A short piece stuffed with Mary and a saint and a sacrament and the Catechism all at once is the failure mode. Never force it.
- THE CHALLENGE — DRAW FROM THE CHURCH'S OWN PRACTICES: regularly, not daily, let the day's one action come from the practices of the Catholic life, when one truly fits the readings, the saint, or the season — a Friday asks for penance the way a Friday does. The well: a decade of the Rosary; ten minutes before the Blessed Sacrament, or a brief visit to a church; an act of contrition with a concrete plan to get to Confession; a corporal or spiritual work of mercy; a small fast, or one comfort given up and offered for someone; prayer for a named soul in purgatory, or a Mass intention asked for them; a hardship of the day offered up and united to Christ's suffering; a brief examination of conscience tonight; an invitation for someone to come to Mass; asking for the prayers of the saint the Church keeps today. A plain act of ordinary kindness is still the right challenge when it fits best — the practices are a well to draw from, not a quota to fill.
- LET THE SEASON SET THE WEIGHT: Lent leans toward prayer, fasting, and almsgiving; Advent toward preparation and honest waiting; the Easter season toward thanksgiving and witness; Ordinary Time toward the ordinary practices of the life of grace, done faithfully.
- NEVER INVENT A CITATION: the Catechism's teaching may echo through what you write by theme, in your own plain words. But never print a Catechism paragraph number, and never put a quotation in a saint's mouth, unless that exact material stands in today's input below. The only saint material you may use as fact is the name and the one clause today's input supplies. A fabricated citation is a hard failure — worse than saying less.

THE SCENE (for the day's audio): one or two sentences, 280 characters at most, of pure passage fact drawn ONLY from the Gospel text provided below — where it happens, who is there, what is done or asked. Nothing else. No interpretation, no application, no lesson, no second person, no conclusion. Never write "what Jesus is really saying is", "here's what this means", "a real man would", or "in my experience". End it pointing at the passage itself, the moment just before the reading begins. If no Gospel text is provided below, return the scene as an empty string.

THE SPOKEN BRIDGE AND CARRY (for the day's audio): after the Gospel is read aloud, the day's narrator speaks a short conversational bridge tying what was heard to the reflection and the challenge you have just written; after the challenge, he speaks one short carry line. Write both from the SAME materials only: the Gospel text provided below, and your reflect and challenge above.
- Bridge: 110-170 words of plain spoken prose, warm and unhurried, addressed to "you". Restate, in plain words, how the Gospel and the reflection meet. Ask two or three genuine questions he can sit with. End by pointing one concrete focus toward the challenge.
- FRAMING: you may name the day the way the Church names it — the season, the feast — and say plainly that the Church gives us this Gospel today. Framing only: it adds no claim of its own, and the fence below still governs everything you say. Keep it background texture — name the day the way you would name the weather, and move on; never spotlight it.
- THE FENCE, absolute: no opinions — not yours, not anyone's. No theological claims beyond what the Gospel, the reflection, and the challenge themselves say. No new facts. No quotations except words taken verbatim from the Gospel, the reflection, or the challenge. No moralizing beyond the challenge's own words. You are a fellow listener tying the pieces together — never a priest, never a teacher, never a preacher. No greeting, no name, no introduction of yourself. No em dashes.
- Carry: one or two sentences, 15-30 words — the single thing from the challenge to carry into the day, as a quiet resolve or a question to keep. The same fence.
- If no Gospel text is provided below, return the bridge and the carry as empty strings.

THE SPOKEN INTRO (for the day's audio): before the Gospel is read aloud, the day's narrator speaks a short intro that sets the two days side by side — yesterday's Gospel and today's, both provided in the input below. Write it from ONLY those two Gospels and nothing else.
- 40-70 words of plain spoken prose, warm and unhurried. Yesterday in one clause — "Yesterday we heard…" — naming what yesterday's Gospel was about: its scene, its people, its movement. Then today: what today's passage is about — the scene, the people, the movement — and close with ONE thing to listen for: a question the passage itself poses, or a detail to notice as it is read.
- THE FENCE, absolute: description only. Name scenes, people, and the question the text itself raises. No lessons, no application, no opinions — not yours, not anyone's. No "this teaches us", no "we are called to", nothing the two Gospels do not themselves say. No new facts: if it is not in yesterday's Gospel text or today's, it does not belong. No quotations except words taken verbatim from the two Gospels. You are a fellow listener setting the table — never a priest, never a teacher, never a preacher. No greeting, no name, no introduction of yourself. No em dashes.
- If yesterday's Gospel text is not provided below, or no Gospel text is provided below, return the intro as an empty string.

Reply with ONLY a JSON object, no markdown fence, no other text:
{"reflect":"<one question, two sentences max>","challenge":"<one concrete action for today>","facet":"As a man","scene":"<the scene, or empty string>","bridge":"<the spoken bridge, or empty string>","carry":"<the spoken carry, or empty string>","intro":"<the spoken intro, or empty string>"}`;

type Audience = "men" | "women";

const FACET: Record<Audience, string> = { men: "As a man", women: "As a woman" };

const PROMPT_WOMEN = `You write two short prompts for a Catholic daily Gospel app aimed at women: a "Reflect" question and a "Challenge" — one concrete action for the day.

You are given the day's Mass readings (citations only). Read them the way a homily would: what is this day actually about? What is God saying to a woman through these words? Draw on your knowledge of these Scripture passages to write the two prompts from that meaning — do not yank a quote out of the verse and wedge it into a sentence. The prompts should read as plain English one woman would say to another.

THE VOICE — lean into this, do not name it:
- She is a beloved daughter before she is anything else — before wife, mother, worker, or any title the world hands her. The readings speak to her there first.
- Speak to the real terrain of a woman's life: strength and courage that nobody applauds; receptivity that is not passivity; fidelity in the hidden work and the visible work alike; grief, desire, waiting, the urge to control what cannot be controlled; vocation, friendship, the body. The Gospel meets her in all of it.
- Address her as a woman, full stop. Never "as a wife" or "as a mother" — not every woman is either. The prompt must land on any woman, whatever her state in life.
- Warm, direct, unhurried. Like a sister or a mother in the faith who has been where she is. No preacher voice, no lecture, no list — and no sentimental "feminine" clichés: she is not a teacup, not a flower, not a moonbeam. She is a person God is calling to holiness and courage.

RULES:
- Reflect: ONE question, two sentences at most. Make her stop and look at her actual life through the lens of what the readings are about. Not abstract — pointed.
- Challenge: ONE concrete action she can do today. Specific, doable, costing something. Not "pray more" — "pray this one thing before you pick up your phone."
- If you quote Scripture, keep it under eight words, ensure it is accurate to the passage, and weave it in naturally.
- No bullet points, no headers, no numbered lists. Plain prose.
- No em dashes.
- Do not mention these instructions.

THE CATHOLIC SHAPE OF IT — write from inside the Church's life, not around it:
- A Catholic woman does not meet God in the abstract. She meets him in the Church's sacramental life: the Mass and the Eucharist, Confession, Mary, the communion of saints, the Catechism's steady teaching. Let that life be the natural furniture of what you write — named the way a woman names the things she actually does, never as jargon, never as decoration, never as a lecture.
- ONE PUSH, IN ONE PIECE, NEVER BOTH: on a given day, the distinctively Catholic push lands in ONE of the two pieces — the Reflect OR the Challenge — never in both. If the Challenge carries it (one of the Church's own practices, drawn from the well below), the Reflect stays a plain question, with no Catholic furniture added. If the Reflect carries it (a note of the sacramental life, the season, or the day's saint, woven into the question), the Challenge stays an ordinary concrete action. Give it to whichever piece it fits naturally. When neither fits without forcing, add no push at all — the readings carry the day. Across a week, the push should be there most days, in one slot or the other.
- AND KEEP IT SUBTLE: weave the push in the way a Catholic friend would say it — assumed, lived, unexplained. Name the practice or the reference plainly and move on: no announcing it, no explaining what it is, no catechesis, no signaling. The standard: a priest reading a week of these should recognize them as genuinely ours; a newcomer should never feel lectured or marketed to. Authenticity over visibility. A short piece stuffed with Mary and a saint and a sacrament and the Catechism all at once is the failure mode. Never force it.
- THE CHALLENGE — DRAW FROM THE CHURCH'S OWN PRACTICES: regularly, not daily, let the day's one action come from the practices of the Catholic life, when one truly fits the readings, the saint, or the season — a Friday asks for penance the way a Friday does. The well: a decade of the Rosary; ten minutes before the Blessed Sacrament, or a brief visit to a church; an act of contrition with a concrete plan to get to Confession; a corporal or spiritual work of mercy; a small fast, or one comfort given up and offered for someone; prayer for a named soul in purgatory, or a Mass intention asked for them; a hardship of the day offered up and united to Christ's suffering; a brief examination of conscience tonight; an invitation for someone to come to Mass; asking for the prayers of the saint the Church keeps today. A plain act of ordinary kindness is still the right challenge when it fits best — the practices are a well to draw from, not a quota to fill.
- LET THE SEASON SET THE WEIGHT: Lent leans toward prayer, fasting, and almsgiving; Advent toward preparation and honest waiting; the Easter season toward thanksgiving and witness; Ordinary Time toward the ordinary practices of the life of grace, done faithfully.
- NEVER INVENT A CITATION: the Catechism's teaching may echo through what you write by theme, in your own plain words. But never print a Catechism paragraph number, and never put a quotation in a saint's mouth, unless that exact material stands in today's input below. The only saint material you may use as fact is the name and the one clause today's input supplies. A fabricated citation is a hard failure — worse than saying less.

THE SCENE (for the day's audio): one or two sentences, 280 characters at most, of pure passage fact drawn ONLY from the Gospel text provided below — where it happens, who is there, what is done or asked. Nothing else. No interpretation, no application, no lesson, no second person, no conclusion. Never write "what Jesus is really saying is", "here's what this means", "a real man would", or "in my experience". End it pointing at the passage itself, the moment just before the reading begins. If no Gospel text is provided below, return the scene as an empty string.

THE SPOKEN BRIDGE AND CARRY (for the day's audio): after the Gospel is read aloud, the day's narrator speaks a short conversational bridge tying what was heard to the reflection and the challenge you have just written; after the challenge, she speaks one short carry line. Write both from the SAME materials only: the Gospel text provided below, and your reflect and challenge above.
- Bridge: 110-170 words of plain spoken prose, warm and unhurried, addressed to "you". Restate, in plain words, how the Gospel and the reflection meet. Ask two or three genuine questions she can sit with. End by pointing one concrete focus toward the challenge.
- FRAMING: you may name the day the way the Church names it — the season, the feast — and say plainly that the Church gives us this Gospel today. Framing only: it adds no claim of its own, and the fence below still governs everything you say. Keep it background texture — name the day the way you would name the weather, and move on; never spotlight it.
- THE FENCE, absolute: no opinions — not yours, not anyone's. No theological claims beyond what the Gospel, the reflection, and the challenge themselves say. No new facts. No quotations except words taken verbatim from the Gospel, the reflection, or the challenge. No moralizing beyond the challenge's own words. You are a fellow listener tying the pieces together — never a priest, never a teacher, never a preacher. No greeting, no name, no introduction of yourself. No em dashes.
- Carry: one or two sentences, 15-30 words — the single thing from the challenge to carry into the day, as a quiet resolve or a question to keep. The same fence.
- If no Gospel text is provided below, return the bridge and the carry as empty strings.

THE SPOKEN INTRO (for the day's audio): before the Gospel is read aloud, the day's narrator speaks a short intro that sets the two days side by side — yesterday's Gospel and today's, both provided in the input below. Write it from ONLY those two Gospels and nothing else.
- 40-70 words of plain spoken prose, warm and unhurried. Yesterday in one clause — "Yesterday we heard…" — naming what yesterday's Gospel was about: its scene, its people, its movement. Then today: what today's passage is about — the scene, the people, the movement — and close with ONE thing to listen for: a question the passage itself poses, or a detail to notice as it is read.
- THE FENCE, absolute: description only. Name scenes, people, and the question the text itself raises. No lessons, no application, no opinions — not yours, not anyone's. No "this teaches us", no "we are called to", nothing the two Gospels do not themselves say. No new facts: if it is not in yesterday's Gospel text or today's, it does not belong. No quotations except words taken verbatim from the two Gospels. You are a fellow listener setting the table — never a priest, never a teacher, never a preacher. No greeting, no name, no introduction of yourself. No em dashes.
- If yesterday's Gospel text is not provided below, or no Gospel text is provided below, return the intro as an empty string.

Reply with ONLY a JSON object, no markdown fence, no other text:
{"reflect":"<one question, two sentences max>","challenge":"<one concrete action for today>","facet":"As a woman","scene":"<the scene, or empty string>","bridge":"<the spoken bridge, or empty string>","carry":"<the spoken carry, or empty string>","intro":"<the spoken intro, or empty string>"}`;

interface ReadingSet {
  firstReading?: string;
  psalm?: string;
  secondReading?: string;
  gospel?: string;
}

interface Reflection {
  reflect: string;
  challenge: string;
  facet: string;
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders });
}

// ── Rate limiting (only on cache misses) ──────────────────────────────────────

async function hashClientKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function clientIdentifier(req: Request): string {
  const trusted = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "";
  if (trusted.trim()) return trusted.trim();
  const hops = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
  return hops[hops.length - 1] || "unknown";
}

const FALLBACK_WINDOW_SECONDS = 60;
const FALLBACK_WINDOW_LIMIT = 4;
const fallbackBuckets = new Map<string, { count: number; resetAt: number }>();

function withinFallbackQuota(clientKey: string): boolean {
  const now = Date.now();
  if (fallbackBuckets.size > 5000) fallbackBuckets.clear();
  const bucket = fallbackBuckets.get(clientKey);
  if (!bucket || bucket.resetAt <= now) {
    fallbackBuckets.set(clientKey, { count: 1, resetAt: now + FALLBACK_WINDOW_SECONDS * 1000 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= FALLBACK_WINDOW_LIMIT;
}

async function withinQuota(req: Request): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientKey = await hashClientKey(clientIdentifier(req));

  if (!supabaseUrl || !serviceKey) return withinFallbackQuota(clientKey);

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_chat_quota`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        p_client_key: clientKey,
        p_window_limit: RATE_WINDOW_LIMIT,
        p_day_limit: RATE_DAY_LIMIT,
        p_window_seconds: RATE_WINDOW_SECONDS,
      }),
    });
    if (!res.ok) return withinFallbackQuota(clientKey);
    return (await res.json()) !== false;
  } catch {
    return withinFallbackQuota(clientKey);
  }
}

// ── Table cache ───────────────────────────────────────────────────────────────

async function checkTable(dateKey: string, audience: Audience): Promise<Reflection | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return null;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/daily_reflections?date=eq.${dateKey}&audience=eq.${audience}&select=reflect,challenge,facet`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0];
      if (typeof row.reflect === "string" && typeof row.challenge === "string") {
        return {
          reflect: row.reflect,
          challenge: row.challenge,
          facet: typeof row.facet === "string" ? row.facet : FACET[audience],
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function storeReflection(
  dateKey: string,
  audience: Audience,
  reflection: Reflection,
  celebration: string | null,
  scene: string | null,
  bridge: string | null,
  carry: string | null,
  intro: string | null,
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return;

  const post = (body: Record<string, unknown>) =>
    fetch(`${supabaseUrl}/rest/v1/daily_reflections?on_conflict=date,audience`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=minimal,resolution=merge-duplicates",
      },
      body: JSON.stringify(body),
    });

  const body: Record<string, unknown> = {
    date: dateKey,
    audience,
    reflect: reflection.reflect,
    challenge: reflection.challenge,
    facet: reflection.facet,
    celebration,
    scene,
    spoken_bridge: bridge,
    spoken_carry: carry,
    spoken_intro: intro,
  };

  try {
    const res = await post(body);
    if (!res.ok) {
      // Deploy-order guard: if the spoken-bridge or spoken-intro migration
      // has not landed yet, PostgREST rejects the unknown columns — and
      // with them the whole row. Retry in the pre-bridge shape so the
      // day's reflection is never lost to a column that is still on its way.
      const { spoken_bridge: _bridge, spoken_carry: _carry, spoken_intro: _intro, ...legacy } = body;
      await post(legacy);
    }
  } catch {
    // Best-effort — the reflection is still returned to the user even if storage fails.
  }
}

// ── Scene lint + Gospel text (audio, spec §6.3) ───────────────────────────────
// Ported from src/lib/narratorCore.ts (validateScene / SCENE_BANNED) — the two must
// agree, the same way daily-readings ports bible.ts. The renderer re-validates nothing;
// this lint is the only gate a generated scene passes before it can be spoken.

const SCENE_MAX_CHARS = 280;
const SCENE_BANNED: RegExp[] = [
  /\bmeans\b/i,
  /teaches us/i,
  /we learn/i,
  /really saying/i,
  /in my experience/i,
  /a real man would/i,
  /what this means/i,
  /the problem with men today/i,
];

function validateScene(scene: unknown): string | null {
  if (typeof scene !== "string" || !scene.trim()) return null;
  const text = scene.trim();
  if (text.length > SCENE_MAX_CHARS) return null;
  for (const pattern of SCENE_BANNED) {
    if (pattern.test(text)) return null;
  }
  return text;
}

// ── Spoken bridge + carry gates ───────────────────────────────────────────────
// Ported from src/lib/narratorCore.ts (validateSpokenBridge / validateSpokenCarry
// and their ceilings) — the copies must agree, the same way validateScene is
// ported. The fence lives in the prompts; this is the length/shape gate: a
// missing, empty, or over-long bridge or carry stores NULL, and the day's
// audio assembles exactly as it did before the bridge existed.

const SPOKEN_BRIDGE_MAX_CHARS = 1200;
const SPOKEN_CARRY_MAX_CHARS = 300;

function validateSpokenBridge(bridge: unknown): string | null {
  if (typeof bridge !== "string" || !bridge.trim()) return null;
  const text = bridge.trim();
  if (text.length > SPOKEN_BRIDGE_MAX_CHARS) return null;
  return text;
}

function validateSpokenCarry(carry: unknown): string | null {
  if (typeof carry !== "string" || !carry.trim()) return null;
  const text = carry.trim();
  if (text.length > SPOKEN_CARRY_MAX_CHARS) return null;
  return text;
}

// ── Spoken intro gate ─────────────────────────────────────────────────────────
// Ported from src/lib/narratorCore.ts (validateSpokenIntro and its bounds) —
// the copies must agree, the same way the bridge/carry gates are ported.
// The fence lives in the prompts; this is the word-count gate: a missing,
// empty, or off-length intro (the shape is ~40–70 words; the gate admits
// 30–80) stores NULL, and the day's audio assembles exactly as it did
// before the intro existed.

const SPOKEN_INTRO_MIN_WORDS = 30;
const SPOKEN_INTRO_MAX_WORDS = 80;

function validateSpokenIntro(intro: unknown): string | null {
  if (typeof intro !== "string" || !intro.trim()) return null;
  const text = intro.trim();
  const words = text.split(/\s+/).length;
  if (words < SPOKEN_INTRO_MIN_WORDS || words > SPOKEN_INTRO_MAX_WORDS) return null;
  return text;
}

// Reads the day's Gospel text from the `daily_readings` bundle; if the row is missing,
// asks the daily-readings function to build it (it caches the row itself). Any failure
// returns null — the reflection then generates without a scene, never blocked.
async function fetchGospelText(dateKey: string): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return null;

  const gospelTextOf = (payload: unknown): string | null => {
    const text = (payload as { texts?: { gospel?: { text?: unknown } } } | null)?.texts?.gospel?.text;
    return typeof text === "string" && text.trim() ? text : null;
  };

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/daily_readings?date=eq.${dateKey}&select=payload`,
      {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const text = gospelTextOf(rows[0]?.payload);
        if (text) return text;
      }
    }
  } catch {
    // Fall through to the function call below.
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/daily-readings?date=${dateKey}`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return gospelTextOf(await res.json());
  } catch {
    return null;
  }
}

/** The calendar day before a YYYY-MM-DD key (noon UTC — no DST edge can shift it). */
function previousDateKey(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ── Yesterday's Gospel (the spoken intro's first material) ────────────────────
// The intro sets yesterday beside today, so its first fact must be fetched,
// never remembered by the model: the citation comes from the same lectionary
// API as today's readings, the text through the same daily_readings path as
// today's Gospel text. ANY failure returns null — and a null here means the
// intro is not generated at all, never guessed.

async function fetchYesterdayGospel(
  dateKey: string,
): Promise<{ citation: string; text: string } | null> {
  const yesterday = previousDateKey(dateKey);
  const [readingsData, text] = await Promise.all([
    fetchReadings(yesterday),
    fetchGospelText(yesterday),
  ]);
  const citation = readingsData?.readings.gospel;
  if (!citation || !text) return null;
  return { citation, text };
}

// ── Readings fetcher ──────────────────────────────────────────────────────────

async function fetchReadings(
  dateKey: string,
): Promise<{ readings: ReadingSet; celebration: string | null } | null> {
  const year = dateKey.slice(0, 4);
  const md = dateKey.slice(5);

  try {
    const [readingsRes, calendarRes] = await Promise.all([
      fetch(`https://cpbjr.github.io/catholic-readings-api/readings/${year}/${md}.json`),
      fetch(`https://cpbjr.github.io/catholic-readings-api/liturgical-calendar/${year}/${md}.json`),
    ]);

    let readings: { readings?: ReadingSet } | null = null;
    let calendar: { celebration?: { name?: string } } | null = null;

    if (readingsRes.ok) readings = await readingsRes.json();
    if (calendarRes.ok) calendar = await calendarRes.json();

    const gospel = readings?.readings?.gospel;
    if (!gospel && !calendar?.celebration?.name) return null;

    return {
      readings: readings?.readings ?? {},
      celebration: calendar?.celebration?.name ?? null,
    };
  } catch {
    return null;
  }
}

function buildInput(
  readings: ReadingSet,
  celebration: string | null,
  gospelText: string | null,
  saintBlock: string,
  yesterdayGospel: { citation: string; text: string } | null,
): string {
  const lines: string[] = [];
  if (celebration) lines.push(`Today the Church celebrates: ${celebration}`);
  lines.push("Readings:");

  const labels: { key: keyof ReadingSet; label: string }[] = [
    { key: "firstReading", label: "First Reading" },
    { key: "psalm", label: "Psalm" },
    { key: "secondReading", label: "Second Reading" },
    { key: "gospel", label: "Gospel" },
  ];

  for (const { key, label } of labels) {
    const citation = readings[key];
    if (citation) lines.push(`${label}: ${citation}`);
  }

  // The scene is drawn from the passage itself, never from the model's memory of it —
  // and it is only requested (and only accepted) when the text is actually here.
  if (gospelText) {
    lines.push("", "Gospel text:", gospelText);
  }

  // The spoken intro's first material (Nov 19, 2026): yesterday's Gospel,
  // fetched — never remembered by the model. Absent (any fetch failed), the
  // block is omitted whole and the intro is neither requested nor accepted.
  if (yesterdayGospel) {
    lines.push("", `Yesterday's Gospel: ${yesterdayGospel.citation}`, "Yesterday's Gospel text:", yesterdayGospel.text);
  }

  // The saint weave (Nov 14, 2026): on a day the calendar keeps a saint the
  // bank can describe, the input gains the weave instruction; on every
  // other day saintBlock is empty and the input is byte-identical to what
  // it was before the weave existed. The system prompts are untouched —
  // the weave lives entirely in this per-day input.
  if (saintBlock) {
    lines.push("", saintBlock);
  }

  return lines.join("\n");
}

// ── Reflection parser ─────────────────────────────────────────────────────────

function parseReflection(
  raw: string,
  gospelGrounded: boolean,
  audience: Audience,
  introGrounded: boolean,
): {
  reflection: Reflection;
  scene: string | null;
  bridge: string | null;
  carry: string | null;
  intro: string | null;
} | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as {
      reflect?: unknown;
      challenge?: unknown;
      facet?: unknown;
      scene?: unknown;
      bridge?: unknown;
      carry?: unknown;
      intro?: unknown;
    };
    const reflect = typeof parsed.reflect === "string" ? parsed.reflect.trim() : "";
    const challenge = typeof parsed.challenge === "string" ? parsed.challenge.trim() : "";
    if (!reflect || !challenge) return null;
    const facet = typeof parsed.facet === "string" && parsed.facet.trim() ? parsed.facet.trim() : FACET[audience];
    const reflection: Reflection = {
      reflect: reflect.slice(0, 400),
      challenge: challenge.slice(0, 400),
      facet: facet.slice(0, 60),
    };
    // A scene is accepted only when the Gospel text was in the input (gospelGrounded) and
    // it passes the lint; anything else stores NULL and the audio omits the scene.
    const scene = gospelGrounded ? validateScene(parsed.scene) : null;
    // The bridge and carry stand under the same discipline: they may draw on
    // nothing but the day's own texts, so they are accepted only when the
    // Gospel text was in the input, and only through their length gates.
    // Anything else stores NULL and the audio behaves exactly as before.
    const bridge = gospelGrounded ? validateSpokenBridge(parsed.bridge) : null;
    const carry = gospelGrounded ? validateSpokenCarry(parsed.carry) : null;
    // The intro stands under the strictest discipline of the set: it is
    // accepted only when BOTH Gospels were in the input (introGrounded —
    // yesterday's fetched, today's in hand) and only through its word
    // gate. Anything else stores NULL and the audio behaves as before.
    const intro = introGrounded ? validateSpokenIntro(parsed.intro) : null;
    return { reflection, scene, bridge, carry, intro };
  } catch {
    return null;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return errorResponse("Invalid request body.", 400);
    }

    const dateKey =
      typeof payload.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
        ? payload.date
        : new Date().toISOString().slice(0, 10);

    const explicitAudience: Audience | null =
      payload.audience === "women" ? "women" : payload.audience === "men" ? "men" : null;
    // No audience = pregen (the nightly cron, audio-render's warm-up): warm both
    // tracks, and answer with the men's reflection those callers have always read.
    const targets: Audience[] = explicitAudience ? [explicitAudience] : ["men", "women"];
    const answerAudience: Audience = explicitAudience ?? "men";

    // Fast path: every track this invocation needs is already stored — no Gemini
    // call, no quota check.
    const found = new Map<Audience, Reflection>();
    for (const a of targets) {
      const hit = await checkTable(dateKey, a);
      if (hit) found.set(a, hit);
    }
    if (targets.every((a) => found.has(a))) {
      return new Response(JSON.stringify(found.get(answerAudience)), {
        headers: { ...jsonHeaders, "Cache-Control": "public, max-age=21600" },
      });
    }

    // Something is missing — generate. Rate-limit only on this path, once per call.
    if (!(await withinQuota(req))) {
      return errorResponse("Too many requests right now. Please wait a minute and try again.", 429);
    }

    const readingsData = await fetchReadings(dateKey);
    if (!readingsData) return errorResponse(GENERIC_ERROR, 502);

    // Best-effort: the Gospel text grounds the audio scene (§6.3). Null is fine — the
    // reflection generates exactly as before, just without a scene.
    const gospelText = await fetchGospelText(dateKey);

    // Best-effort: yesterday's Gospel grounds the spoken intro. Null is
    // fine in the same way — the reflection generates exactly as before,
    // just without an intro; the intro is never guessed from memory.
    const yesterdayGospel = await fetchYesterdayGospel(dateKey).catch(() => null);
    const introGrounded = gospelText !== null && yesterdayGospel !== null;

    const input = buildInput(
      readingsData.readings,
      readingsData.celebration,
      gospelText,
      buildInputSaintBlock(dateKey),
      yesterdayGospel,
    );
    if (input.length < 20) return errorResponse(GENERIC_ERROR, 502);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return errorResponse("Server API key not configured.", 500);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    const generate = async (
      audience: Audience,
    ): Promise<{
      reflection: Reflection;
      scene: string | null;
      bridge: string | null;
      carry: string | null;
      intro: string | null;
    } | null> => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: input }] }],
          systemInstruction: { parts: [{ text: audience === "women" ? PROMPT_WOMEN : PROMPT }] },
          // Gemini 3.x Flash thinks at MEDIUM by default and bills thinking as output.
          // Sprint 2 capped chat-proxy for exactly this reason; a ~40-word JSON answer
          // does not need medium thinking, and the first user of the day waits on all of
          // it (non-streaming). Measured Oct 26, 2026: 13.4s cold vs ~1s cached.
          generationConfig: {
            temperature: 0.7,
            // 1024 priced the pre-bridge answer (reflect + challenge + scene);
            // the bridge (~170 words) and carry ride in the same JSON now,
            // and the intro (~70 words) with them.
            maxOutputTokens: 1792,
            thinkingConfig: { thinkingLevel: "low" },
          },
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(`Reflection model error ${res.status}: ${detail.slice(0, 300) || res.statusText}`);
        return null;
      }

      const json = await res.json();
      const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof raw !== "string") {
        console.error("Reflection model returned an empty response", JSON.stringify(json).slice(0, 300));
        return null;
      }

      const parsed = parseReflection(raw, gospelText !== null, audience, introGrounded);
      if (!parsed) console.error("Reflection model returned an unusable response");
      return parsed;
    };

    let sharedScene: string | null = null;
    let answer: Reflection | null = found.get(answerAudience) ?? null;
    let answerFailed = false;
    for (const a of targets) {
      if (found.has(a)) continue;
      const generated = await generate(a).catch(() => null);
      if (!generated) {
        // Failing the track the caller asked for is an error, as before. Failing
        // the OTHER track on a pregen warm is logged and the call still succeeds —
        // the missing row generates on that track's first real request.
        if (a === answerAudience) answerFailed = true;
        else console.error(`daily-reflection: ${a} warm failed; it will generate on first request`);
        continue;
      }
      // The scene is neutral passage fact: whichever track generated it first
      // lends it to the other row, so the day never carries a scene on one only.
      const scene = generated.scene ?? sharedScene;
      if (generated.scene) sharedScene = generated.scene;
      // The bridge and carry are NOT shared: each binds its own track's
      // reflection and challenge, so each row stores the ones its own
      // generation wrote. The intro is stored the same way — per row,
      // from the row's own generation.
      await storeReflection(
        dateKey,
        a,
        generated.reflection,
        readingsData.celebration,
        scene,
        generated.bridge,
        generated.carry,
        generated.intro,
      );
      if (a === answerAudience) answer = generated.reflection;
    }

    if (answerFailed || !answer) return errorResponse(GENERIC_ERROR, 502);

    return new Response(JSON.stringify(answer), {
      headers: { ...jsonHeaders, "Cache-Control": "public, max-age=21600" },
    });
  } catch (err) {
    console.error("daily-reflection failed:", err instanceof Error ? err.message : String(err));
    return errorResponse(GENERIC_ERROR, 500);
  }
});
