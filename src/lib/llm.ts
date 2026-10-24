import type { Message } from '@/types';

interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
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
      }),
      signal,
    });

    if (!res.ok) {
      console.error(`chat-proxy request failed with status ${res.status}`);
      recordTiming();
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
        callbacks.onToken(chunk);
      }
    }

    recordTiming();
    callbacks.onDone();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      recordTiming();
      callbacks.onDone();
      return;
    }
    // If we already streamed partial text, treat it as a completed response
    // rather than showing an error — the connection dropped but the content is usable.
    if (receivedAny) {
      recordTiming();
      callbacks.onDone();
      return;
    }
    console.error('streamChat failed:', err);
    recordTiming();
    callbacks.onError(GENERIC_FAILURE);
  }
}
