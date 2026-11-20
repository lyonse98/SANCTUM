import type { Audience, Message } from '@/types';
import { loadAudience } from '@/lib/audience';
import { loadTailorProfile, northStarLabel } from '@/lib/tailorProfile';
import { loadReaderName } from '@/lib/readerName';
import { ACCESS_BLOCKED_MESSAGE, isAccessRequired, loadAccessToken } from '@/lib/accessToken';
import { ACCESS_URL } from '@/lib/accessRequest';
import { SourcesTrailerParser, type ChatSource } from '@/lib/chatSources';

interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  /** Structured citations for a grounded Aquinas answer (corpus spec §9.1).
   *  Only CatechismQA passes this; when it is absent the stream is untouched. */
  onSources?: (sources: ChatSource[]) => void;
}

// User-facing copy only: backend error text is never shown to the user, so nothing
// about the server or the upstream provider can leak into the chat transcript.
//
// verify_jwt is false: this is a no-auth app, so the browser holds only the anon key.
// Rate limiting is enforced per hashed IP instead.
const GENERIC_FAILURE = "I couldn't reach Sanctum just now. Give it a moment and try again.";
const RATE_LIMIT_FAILURE =
  'Sanctum is handling a lot of requests right now. Wait a minute, then send that again.';

function friendlyError(status: number): string {
  if (status === 429) return RATE_LIMIT_FAILURE;
  if (status === 401 || status === 403) return 'This session has expired. Reload Sanctum and try again.';
  return GENERIC_FAILURE;
}

export interface ChatContext {
  personaId: string;
  season?: string;
  distress?: boolean;
  /** The active track. Callers in the main app pass it explicitly; surfaces that
   *  only know a persona id (the Catechism's Aquinas seat) omit it and the stored
   *  on-device audience is used — it only ever steers how the reply addresses her. */
  audience?: Audience;
}

export interface ChatTiming {
  personaId: string;
  firstTokenMs: number | null;
  totalMs: number;
  at: number;
}

/** Recent reply timings, kept in memory only — the field-measurement hook for latency
 *  work (read via the console). Nothing is sent anywhere; timings are numbers, not text. */
const chatTimings: ChatTiming[] = [];
export function getChatTimings(): ChatTiming[] {
  return [...chatTimings];
}

export async function streamChat(
  messages: Message[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  context?: ChatContext,
): Promise<void> {
  let receivedAny = false;
  const trailerParser = new SourcesTrailerParser(!!callbacks.onSources);
  const flushTrailer = () => {
    const fin = trailerParser.finish();
    if (fin.text) callbacks.onToken(fin.text);
    if (fin.sources) callbacks.onSources?.(fin.sources);
  };
  const startedAt = performance.now();
  let firstTokenAt: number | null = null;
  const recordTiming = () => {
    const timing: ChatTiming = {
      personaId: context?.personaId ?? '',
      firstTokenMs: firstTokenAt === null ? null : Math.round(firstTokenAt - startedAt),
      totalMs: Math.round(performance.now() - startedAt),
      at: Date.now(),
    };
    chatTimings.push(timing);
    if (chatTimings.length > 50) chatTimings.shift();
    console.info('[Sanctum] chat timing', timing);
  };
  try {
    const audience = context?.audience ?? loadAudience();
    // The reader's North Star (Erik, Nov 18, 2026): the one profile field a
    // companion may be handed — chosen by the reader in the standing
    // profile, resolved to its phrasing on this device, null when unset.
    // This module reads the profile store for this field and nothing else.
    const northStar = northStarLabel(loadTailorProfile(audience).northStar);
    // The reader's name (Erik, Nov 18, 2026): given by the reader in
    // Settings, kept in its own small store — this module reads that
    // store for the name and nothing else. It rides as the name itself,
    // so a companion may use it sparingly; null when unset.
    const name = loadReaderName();
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-proxy`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        messages,
        // The companion's instructions live on the server and are selected by id; the browser
        // never sends prompt text, so nobody can swap out the safety rules with a crafted call.
        personaId: context?.personaId ?? '',
        season: context?.season ?? '',
        distress: context?.distress === true,
        audience,
        northStar,
        name,
        // The access token (Nov 20, 2026): the credential this device
        // holds for the testing season, read from its own store by the
        // one helper that reads it. It is a door key, not a profile
        // field — the function checks it and nothing is composed from
        // it. Null when the device was never given one.
        accessToken: loadAccessToken(),
      }),
      signal,
    });

    if (!res.ok) {
      console.error(`chat-proxy request failed with status ${res.status}`);
      recordTiming();
      // The access refusal is the one 403 that is not an expired
      // session: the testing-season gate. It is answered with the calm
      // line and the request page's address, carried as text.
      const errorBody: unknown = await res.json().catch(() => null);
      if (isAccessRequired(res.status, errorBody)) {
        callbacks.onError(`${ACCESS_BLOCKED_MESSAGE} You can request access at ${ACCESS_URL}.`);
        return;
      }
      callbacks.onError(friendlyError(res.status));
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      recordTiming();
      callbacks.onError(GENERIC_FAILURE);
      return;
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        receivedAny = true;
        if (firstTokenAt === null) firstTokenAt = performance.now();
        const emit = trailerParser.push(chunk);
        if (emit) callbacks.onToken(emit);
      }
    }

    flushTrailer();
    recordTiming();
    callbacks.onDone();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      flushTrailer();
      recordTiming();
      callbacks.onDone();
      return;
    }
    // If we already streamed partial text, treat it as a completed response
    // rather than showing an error — the connection dropped but the content is usable.
    if (receivedAny) {
      flushTrailer();
      recordTiming();
      callbacks.onDone();
      return;
    }
    console.error('streamChat failed:', err);
    recordTiming();
    callbacks.onError(GENERIC_FAILURE);
  }
}
