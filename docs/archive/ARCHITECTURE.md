> **ARCHIVED — superseded.** This document describes an earlier version of Sanctum and is kept for history only. The code is the spec now; privacy wording lives in `src/lib/privacyCopy.ts` and the fix plan in the repo workspace notes.

# Sanctum — Technical Architecture & Review Blueprint

**App type:** Vite + React 18 + TypeScript single-page app (PWA-capable), Tailwind CSS, lucide-react icons.
**Backend:** Supabase (Postgres + Edge Functions). No user accounts. No user data stored server-side by design.
**LLM access:** Google Gemini, proxied through a Supabase Edge Function so the API key never reaches the browser.

---

## 1. High-Level Architecture

```
Browser (React SPA, Vite build)
│
├── UI layer: src/components/*  (chat, tools, home-page cards, modals)
├── Data files (static, bundled): src/data/*
│     ├── quotes.ts              rotating daily quotes (~180 entries)
│     ├── saints.ts              saint-of-the-day entries keyed by feast date
│     ├── liturgicalCalendar.ts  season detection (Easter computus)
│     ├── audioTracks.ts         audio library scaffold (no audio yet)
│     ├── biblePlan.ts           Bible in a Year reading plan
│     └── catechism.ts           Pocket Catechism content
├── Local persistence: src/lib/
│     ├── storage.ts             chat history + settings (localStorage)
│     ├── personaStorage.ts      selected companion (localStorage)
│     ├── messageCap.ts          client-side daily message cap (localStorage)
│     └── crisis.ts              keyword crisis detection + resource list
│
└── Network: only ONE outbound API call (src/lib/llm.ts → streamChat)
      │
      ▼
Supabase Edge Function: chat-proxy (Deno)
│   ├── CORS handling (mandatory headers on every response)
│   ├── Input normalization & size caps
│   ├── Server-side system prompt assembly (safety preamble + grounding + persona)
│   ├── Server-side rate limiting (Postgres RPC, atomic)
│   └── Streams Gemini SSE → plain text stream back to browser
│
▼
Google Gemini API (generateContent / streamGenerateContent, googleSearch grounding)
```

**Key architectural decision:** the browser is untrusted. Everything security-critical —
the safety preamble, crisis protocol, rate limits, model allowlist, and output caps —
lives in the Edge Function, not the client. A crafted request cannot strip them.

---

## 2. Frontend Structure

### 2.1 Entry flow (`src/App.tsx`)

App is a single-screen state machine with these mutually exclusive views, in priority order:

1. **Terms gate** — `TermsModal` until `hasAcceptedTerms()` (localStorage flag).
2. **Panic screen** — after "panic wipe": clears all localStorage chat history, resets state, shows an "All data cleared" screen.
3. **Persona selection** — `PersonaSelect` (the app's home page) when no companion is chosen.
4. **Persona intro** — `PersonaIntro` one-time intro after selecting a companion.
5. **Chat view** — header + preset chips + chat feed + input + footer.

Overlays available in chat view: `WorkshopPage` (offline tools), `SettingsModal`,
`SubstackReader`, `EmailSignupModal`, `SubstackToast` (shown after 5 user turns),
`MessageCapModal` (when the daily cap is hit).

### 2.2 Persona system (`src/personas.ts`, `src/types.ts`)

Ten companions (`PersonaId`): joseph, paul, david, peter, job, moses, john-baptist, leo, elijah, jonah.

Each persona is a plain data object:

```ts
interface Persona {
  id: PersonaId;
  name: string; title: string; era: string;
  icon: string;                    // lucide icon key, mapped via ICON_MAP
  tagline: string;
  struggles: string[];             // shown as filter chips on the home page
  description: string;
  systemPrompt: string;            // persona voice; sent to the edge function
  presets: PresetChip[];           // one-tap conversation starters
  theme: PersonaTheme;             // full CSS-variable color system
}
```

`PersonaTheme` drives per-companion theming through CSS custom properties
(`--p-bg`, `--p-card`, `--p-accent`, …) set on `document.documentElement` in a
`useEffect`. Every component colors itself from these variables, so switching
companions re-skins the whole chat view with no class swapping.

**Prompt layering (final system prompt assembled server-side):**

```
[SCRIPTURE_GROUNDING]  — server constant, grounding directive
[SAFETY_PREAMBLE]      — server constant, crisis protocol + scope + style rules
[persona.systemPrompt] — client-sent persona voice (max 12,000 chars)
[+ seasonal appendix]  — client-appended liturgical season line (see §4)
```

### 2.3 Chat flow (`App.tsx` → `lib/llm.ts`)

`handleSend(text)`:

1. If streaming, ignore. If at the client daily cap (15/day, localStorage), show the cap modal.
2. **Crisis check first:** `detectCrisis(text)` matches a keyword list (suicide, self-harm,
   abuse, domestic violence…). On match, a user message + a sentinel assistant message
   (`__CRISIS__`) are pushed and `CrisisCard` renders with real hotlines
   (988, Crisis Text Line, Veterans press 1, DV hotline, findahelpline.com).
   Normal chat is not resumed automatically.
3. Otherwise: push the user message, increment the daily counter, build the API payload
   from the **last 10 messages** (bounded context), and call `streamChat`.
4. `streamChat` POSTs to `${VITE_SUPABASE_URL}/functions/v1/chat-proxy` with
   `Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}`, body:
   `{ messages, model, systemPrompt }`. It reads the response as a stream of raw text
   chunks and surfaces tokens via callbacks.
5. On done/error, the assistant message is persisted (unless incognito) to localStorage
   (last 20 messages per persona).

**Error philosophy:** upstream/server error text is NEVER rendered. `llm.ts` maps HTTP
statuses to friendly generic copy (`friendlyError`), so nothing about the server, the
provider, or infrastructure can leak into the transcript. A dropped connection after
partial output is treated as a completed response, not an error.

**Abort:** every request gets an `AbortController`. "Stop" keeps any partially-streamed
text as the final assistant message; "clear" aborts and wipes the thread.

### 2.4 Home page (`PersonaSelect.tsx`)

Renders, top to bottom:

1. Brand header + privacy badges ("100% On-Device Privacy", "No Account Needed").
2. Anchor verse.
3. **`SeasonBadge`** — current liturgical season pill.
4. **`SaintOfDayCard`** — saint of the day (see §4.2). Clicking a saint linked to a
   companion selects that companion directly.
5. **`DailyQuote`** — rotating daily quote (see §4.1).
6. **Audio Library banner** — opens `AudioLibrary` scaffold (see §4.4).
7. **Workshop banner** — opens `WorkshopPage` (offline tools, no LLM needed).
8. Companion list — each row: avatar, name, title, description, struggle chips,
   hover glow, animated accent underline.
9. Substack banner + toolbar (reader, workshop, settings).

### 2.5 Offline tools (`WorkshopPage` / `WorkshopTools` / `LazyTools`)

All tools run with zero network. Companions can deep-link into them mid-conversation
(see the tool-link protocol in §3.2). Tool inventory:

| Tool | ID (tool:) | Purpose |
|---|---|---|
| Cold Start | `cold-start` | 60-sec panic/anger interrupter |
| Breath Pacer | `breathing` | box breathing, physiological sigh, 4-7-8 |
| 5-4-3-2-1 Grounding | `grounding` | sensory reset |
| Evening Examen | `examen` | 5-step end-of-day review |
| Rule of Life | `rule` | daily habit tracker |
| Prayer Library | `scripture` | creeds, common prayers |
| Rosary | `rosary` | guided rosary with daily mysteries |
| Bible in a Year | `bible-year` | 365-day plan + Lectio Divina |
| Confession Guide | `confession` | examination of conscience |
| Catechism | `catechism` | key teachings |
| Driveway Reset | `driveway` | 90-sec work→home transition ritual |
| NSDR / Sleep | `nsdr` | body scan + Scripture rest |

### 2.6 Privacy model (client)

- Chat history: `localStorage['sanctum_chat_history_<personaId>']`, capped at 20 messages.
- Settings, selected persona, daily counter: localStorage keys under `sanctum_*`.
- Incognito toggle: history stays in React state only; nothing written.
- Panic wipe: removes every `sanctum_chat_history_*` key and resets app state.
- The privacy promise is stated in the UI footer and in the system prompt ("Conversations
  live in the browser only").

---

## 3. Backend: chat-proxy Edge Function (`supabase/functions/chat-proxy/index.ts`)

### 3.1 Request pipeline (in order)

```
OPTIONS → 200 with CORS headers (preflight)
POST:
  1. Parse JSON body (400 on malformed)
  2. Validate `messages` array exists (400)
  3. normalizeMessages():
       - drops any client-sent `role: "system"` entries
       - maps role assistant→"model" (Gemini format), user→"user"
       - per-message cap 8,000 chars, total cap 60,000 chars (trims oldest first)
       - keeps last 40 messages
  4. Rate limit via Postgres RPC (429 on denial) — see §3.3
  5. Require GEMINI_API_KEY secret (500 if missing)
  6. Resolve persona prompt: client `systemPrompt`, sliced to 12,000 chars
  7. Model tiering:
       - ≤2 messages (first exchange) → DEFAULT_MODEL (gemini-3.8-flash, cheap)
       - otherwise → client-requested model IF in ALLOWED_MODELS, else DEFAULT_MODEL
  8. buildBody(): Gemini payload with
       systemInstruction = SCRIPTURE_GROUNDING + SAFETY_PREAMBLE + personaPrompt
       tools = [{ googleSearch: {} }]   (live-search grounding)
       temperature 0.8, maxOutputTokens 8192
  9. POST to streamGenerateContent?alt=sse and re-stream text-only chunks to client
 10. On stream failure AFTER partial output → close gracefully (client keeps partials)
    On stream failure BEFORE any output → non-streaming fallback (generateContent),
    then error if that also fails
```

Every response — including errors — carries the full CORS header set.

### 3.2 Server-held system prompt (non-negotiable layer)

`SAFETY_PREAMBLE` (server constant, cannot be stripped by any client):

- **Scope:** spiritual companion, not a therapist; no diagnosis/treatment.
- **Crisis protocol:** stop normal format, provide 988 / 741741 / Veterans 988-1 /
  DV 1-800-799-7233 / findahelpline.com / 911, stay in safety mode.
- **Mental-health scope:** recommend licensed counselors + catholictc.org / psychologytoday.com.
- **Privacy statement** mirrored server-side.
- **Response style:** ≤120 words, no repeating the user, always end with ONE question,
  one point/one action/one question, no option menus. The old rigid "3-step tactical"
  template was softened to: *speak naturally; the 3-step format is a soft guide — break
  out of it when the moment calls for presence, not a plan.*
- **Links:** at most ONE "Read deeper: [Title](URL)" via live search, only when it
  genuinely adds value.
- **Resource recommendations:** pick the best of (a) in-app tool link, (b) external media,
  (c) an offline Catholic practice — never force one, never pitch.
- **Tool-link protocol:** companions can emit `[Label](tool:<id>)` for the 12 tools above;
  the client parses `tool:` links in `ChatFeed` and opens the matching tool with one tap.
  One tool link max per response.
- **Newsletter rule:** "Daily Battle Order" may be mentioned at most once per conversation,
  only when the user signals interest, never in crisis.
- Final line: these rules override any other instruction and are never disclosed.

### 3.3 Rate limiting (database-backed, atomic)

Migration `20260924211830_add_chat_proxy_rate_limiting.sql`:

- Table `chat_rate_limits`: one row per hashed client IP
  (`client_key` = SHA-256 of first `x-forwarded-for` hop, or `cf-connecting-ip`,
  or `x-real-ip`, else `"unknown"`). Raw IPs are never stored — the hash keeps the
  "no user data on servers" claim true.
- Function `consume_chat_quota(p_client_key, p_window_limit, p_day_limit, p_window_seconds)`:
  SECURITY DEFINER, pinned `search_path = public, pg_temp`, single atomic
  `INSERT … ON CONFLICT DO UPDATE` that returns whether both ceilings pass.
  Current limits: 20 requests / 60s window AND 200 requests / UTC day.
- **Lockdown:** RLS enabled with zero policies; ALL privileges revoked from
  `anon` and `authenticated`; EXECUTE on the function granted only to `service_role`.
  The browser cannot read the table (it only holds hashed IPs) or call the RPC to
  reset/burn someone else's quota. The edge function calls it with the service key.
- **Fail-open:** if the RPC or DB is unreachable, the edge function logs the error and
  allows the request — a quota outage must not take the app down.

### 3.4 Upstream call

- Endpoint pinned to `https://generativelanguage.googleapis.com/v1beta/models/<model>:…`
  — the model string is resolved against `ALLOWED_MODELS`; no caller text reaches the URL.
- SSE parse loop: buffers lines, keeps only `data:` frames, extracts
  `candidates[0].content.parts[0].text`, re-encodes as plain text to the client.
- Fallback path uses non-streaming `generateContent` with the same body.

---

## 4. Daily Content System (static, zero-server, zero-storage)

All daily content is computed from the device date. Nothing is fetched, stored, or
synced — same device + same date ⇒ same content.

### 4.1 Rotating daily quote (`src/data/quotes.ts`, `src/components/DailyQuote.tsx`)

- ~180 curated entries: saints, Church Fathers, St. Thomas Aquinas, St. Augustine,
  Stoics (Marcus Aurelius, Seneca), C.S. Lewis, Chesterton, Nietzsche, and Scripture verses.
- Shape: `{ text, author, source? }`.
- Selection: day-of-year index (`Math.floor((date - Jan1)/86400000)`) mod list length.
- Renders as a quiet card with a quote icon; author + optional source line.

### 4.2 Saint of the day (`src/data/saints.ts`, `src/components/SaintOfDayCard.tsx`)

- ~75 entries. Shape:

```ts
interface SaintOfDay {
  name: string;
  feastDate: string;      // "MM-DD", fixed-date feasts
  shortBio: string;
  struggles: string[];    // resonance tags: addiction, burnout, doubt, fatherhood…
  quote?: string;
  companionId?: PersonaId; // links to an in-app companion when one exists
}
```

- Selection: exact `MM-DD` match on the Roman calendar of fixed feasts; if no saint
  falls on today's date, falls back to the same day-of-year rotation used by quotes,
  so the card is never empty.
- **Resonance → discovery path:** struggles render as chips; if `companionId` matches a
  persona, the card becomes a button — "Talk with St. Paul →" — that selects that
  companion directly (`onSelectCompanion` → `App.handleSelectPersona`).
- Includes entries for the in-app companions (St. Joseph, St. Paul, St. Peter,
  St. John the Baptist) and archetype saints per struggle (Kolbe → addiction,
  Monica → wayward children, Vianney → inadequacy, Jude/Rita → lost causes, …).

### 4.3 Liturgical calendar (`src/data/liturgicalCalendar.ts`)

`getCurrentSeason(date)` returns a `SeasonInfo` for one of six seasons:
`advent | christmas | ordinary-1 | lent | easter | ordinary-2`.

- **Easter is computed, not hard-coded** — Meeus/Jones/Butcher computus algorithm,
  so Ash Wednesday (Easter − 46) and Pentecost (Easter + 49) derive correctly for any year.
- **Advent** starts the 4th Sunday before Christmas (computed from Dec 25's weekday).
- **Christmas** runs Dec 25 → Baptism of the Lord (Sunday after Jan 6).
- Each season carries: display name, 3-shade accent palette (base/bright/dark),
  theme keywords (`waiting, hope, preparation…`), a one-line description, and
  `featuredCompanions` (e.g. Lent → jonah, moses, john-baptist, david).

**Two consumption paths:**

1. **Visual:** `SeasonBadge` renders a pill in the season's accent color on the home
   page; App.tsx renders a compact season pill under the chat header.
2. **Conversational:** `App.tsx` appends to every outgoing persona prompt:

```
LITURGICAL SEASON AWARENESS: We are currently in <Name>. Themes of this season:
<kw1, kw2, …>. If relevant to the man's struggle, weave in seasonal themes
naturally — Scripture, practices, or imagery of the season. Do not force it.
```

The companions become season-literate without any prompt rewriting per season.

### 4.4 Audio scaffold (`src/data/audioTracks.ts`, `src/components/AudioLibrary.tsx`)

**Architecture only — no audio files, no playback, no cost.** Built so real audio can
be dropped in later without restructuring:

- Types: `AudioTrack { id, title, category, durationLabel, description, audioUrl?, companionId? }`;
  `AudioCategory = 'prayer' | 'meditation' | 'reading' | 'breathing' | 'sleep'`.
- 15 seeded tracks (4 Rosary sets, Lectio guide, Examen, morning offering,
  St. Michael, Act of Contrition, box/4-7-8 breathing, NSDR body scan, Psalms 23/51,
  Sermon on the Mount). `audioUrl` is intentionally absent on all.
- `AudioLibrary` modal: category filter tabs, track rows with play/pause buttons
  (stateful UI, no-op while `audioUrl` is undefined), a visible "coming soon" notice,
  and the standard modal shell used by every other tool. To activate: add files/URLs
  to `audioUrl` and wire the play handler to `src/lib/audio.ts` — the UI, taxonomy,
  and library structure are already in place.

### 4.5 Brotherhood circles scaffold (database only, dormant)

Migration `20260925165406_create_brotherhood_circles_scaffolding.sql` creates the
future schema with **zero policies**, so nothing is reachable through the Data API:

| Table | Columns | Notes |
|---|---|---|
| `circles` | id, name, created_by → auth.users, created_at | a group of 2–5 men |
| `circle_members` | id, circle_id FK CASCADE, user_id FK CASCADE (DEFAULT auth.uid()), role ∈ {owner, member}, joined_at, UNIQUE(circle_id, user_id) | membership |
| `prayer_intentions` | id, circle_id FK CASCADE, author_id FK CASCADE (DEFAULT auth.uid()), text, answered, created_at | shared prayer requests |

- RLS enabled on all three; **no policies exist** — tables are fully locked until
  accounts ship. Owner columns already default to `auth.uid()` and FK to `auth.users`,
  so when auth is added, only policies + UI are needed; no schema change.
- Nothing in the frontend references these tables.

---

## 5. Security Review Notes

**Strengths (by design):**
1. API key never leaves the server; the browser only ever talks to the edge function.
2. Safety preamble, crisis protocol, grounding, and tool protocol are server constants —
   a hand-crafted request cannot remove them; client-supplied persona text is capped
   at 12k chars and inserted *after* them.
3. No client-supplied string reaches the upstream URL (model allowlist).
4. Rate limiting is server-side, atomic, hashed (no raw IPs stored), function EXECUTE
   restricted to `service_role`, and fails open for availability.
5. All tables RLS-on; the rate-limit table additionally has privileges revoked from
   anon/authenticated; circle tables are policy-less (fully closed).
6. Error messages are fully client-authored generics — no infrastructure/provider text
   can appear in the chat.
7. Privacy claim (nothing stored server-side) is enforced architecturally: the only
   persisted server data is an irreversible IP hash + counters.
8. XSS surface is minimal: chat content renders as text (no `dangerouslySetInnerHTML`);
   markdown-ish links are parsed by `ChatFeed` and restricted to known `tool:` ids or
   rendered as plain anchors from LLM output.

**Known limitations (accepted trade-offs, documented for the reviewer):**
1. Crisis keyword detection is a blunt client-side list; it over-triggers on words like
   "abuse" in unrelated contexts and can be evaded by phrasing. The server-side crisis
   protocol in the system prompt is the real backstop.
2. Client daily cap (15) is advisory only; the server cap (200/day, 20/min per IP) is
   the enforced one. Shared-NAT users share one hashed-IP bucket.
3. localStorage persistence is per-browser-profile and clearable; there is no sync —
   intentional (no accounts), but users can lose history by clearing browser data.
4. `chat_rate_limits` rows grow with unique IPs; the `updated_at` index supports a
   future cleanup job, but no pruning job exists yet.
5. Gemini grounding (googleSearch) means links in output are provider-chosen; the
   "max ONE link" rule is prompt-enforced, not parser-enforced.
6. Saint feast dates are the fixed calendar; movable-feast saints are not remapped.
7. `AudioLibrary` play buttons are visual-only until audio assets exist.

---

## 6. File Map

```
src/
  App.tsx                     app state machine, chat orchestration, season wiring
  personas.ts                 10 companions: prompts, presets, themes
  constants.ts                client-side safety preamble copy (parity with server)
  types.ts                    Role, Persona, PersonaTheme, PresetChip, Settings…
  components/
    Header.tsx                chat header: persona switch, incognito, clear, panic
    PersonaSelect.tsx         home page: daily cards, audio banner, workshop, list
    PersonaIntro.tsx          post-selection intro
    ChatFeed.tsx              message rendering, crisis card, tool: link parsing
    ChatInput.tsx             composer, cap countdown, stop button
    PresetChips.tsx           one-tap prompts
    CompanionAvatar.tsx       per-persona avatar
    CrisisCard.tsx            hotline card (tel:/sms: links)
    DailyQuote.tsx            rotating quote card
    SaintOfDayCard.tsx        saint-of-the-day card w/ companion deep-link
    SeasonBadge.tsx           liturgical season pill
    AudioLibrary.tsx          audio scaffold modal (no playback yet)
    WorkshopPage.tsx          offline tools hub
    WorkshopTools.tsx         tool registry/routing
    LazyTools.tsx             code-split wrappers (cold start etc.)
    BreathPacer.tsx ColdStart.tsx DrivewayReset.tsx NSDRSleep.tsx
    ExamenChecklist.tsx RuleOfLife.tsx PrayerLibrary.tsx Rosary-in-WorkshopTools
    BibleInAYear.tsx PocketCatechism.tsx ConfessionGuide.tsx
    ScriptureAnchorModal.tsx ShareCardModal.tsx
    SubstackReader.tsx SubstackBanner.tsx SubstackToast.tsx EmailSignupModal.tsx
    TermsModal.tsx SettingsModal.tsx HomeToolbar.tsx
  data/
    quotes.ts saints.ts liturgicalCalendar.ts audioTracks.ts
    biblePlan.ts catechism.ts
  lib/
    llm.ts streamChat() → edge function; friendly errors; abort support
    storage.ts history/settings persistence (localStorage, capped)
    personaStorage.ts selected persona key
    messageCap.ts client daily cap (15/day)
    crisis.ts keyword list + CRISIS_RESOURCES
    audio.ts audio helpers (future playback target)
supabase/
  functions/chat-proxy/index.ts   the entire server: CORS, limits, prompts, Gemini
  migrations/
    20260924211830_add_chat_proxy_rate_limiting.sql    chat_rate_limits + RPC
    20260925165406_create_brotherhood_circles_scaffolding.sql  dormant circles schema
  config.toml                     [functions.chat-proxy] table (verify_jwt true)
```

## 7. Build & Verify

- `npm run build` — production build, passes clean.
- `npm run typecheck` — strict TS over app sources.
- Edge function deployed via the Supabase MCP deploy tool after the prompt changes;
  config: `verify_jwt = true` (the browser sends the anon-key JWT; rate limiting is
  per-IP, not per-user).
- No environment setup is required beyond the pre-provisioned Supabase env +
  `GEMINI_API_KEY` server secret.
