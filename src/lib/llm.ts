import type { Message, Settings } from '@/types';

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

export async function streamChat(
  messages: Message[],
  settings: Settings,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  context?: ChatContext,
): Promise<void> {
  let receivedAny = false;
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
        model: settings.model,
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
      callbacks.onError(friendlyError(res.status));
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
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
        callbacks.onToken(chunk);
      }
    }

    callbacks.onDone();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      callbacks.onDone();
      return;
    }
    // If we already streamed partial text, treat it as a completed response
    // rather than showing an error — the connection dropped but the content is usable.
    if (receivedAny) {
      callbacks.onDone();
      return;
    }
    console.error('streamChat failed:', err);
    callbacks.onError(GENERIC_FAILURE);
  }
}
