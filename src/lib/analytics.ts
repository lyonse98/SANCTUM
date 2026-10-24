// Anonymous, metadata-only usage analytics. Fires behavioral events (which screen,
// which tool, which companion) so the owner can see a funnel. NEVER sends message
// text, typed input, email, or any PII. The session id is a random string held in
// localStorage — not tied to auth, not tied to identity. It exists only to group one
// man's path through the app into a sequence.
//
// All events are best-effort: failures are swallowed silently and never surface to the
// user. The allowlist of event names and property values is also enforced server-side
// inside the SECURITY DEFINER `track_event` function, so even a hand-crafted request
// cannot store unapproved strings.

const SESSION_KEY = 'sanctum_analytics_session';
const ANALYTICS_ENABLED_KEY = 'sanctum_analytics_opt_in';

function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      id = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return '0000000000000000';
  }
}

/** Analytics is strictly opt-in. It defaults to OFF: no event fires and no session id is
 *  created until a man turns it on in Settings. When off, track() is a no-op. */
export function isAnalyticsEnabled(): boolean {
  try {
    return localStorage.getItem(ANALYTICS_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAnalyticsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ANALYTICS_ENABLED_KEY, enabled ? 'true' : 'false');
    // Turning analytics off also forgets the session id, so nothing lingers to be reused.
    if (!enabled) localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

type EventName =
  | 'app_open'
  | 'tab_view'
  | 'tool_open'
  | 'companion_selected'
  | 'companion_route'
  | 'reflection_loaded'
  | 'share_opened'
  | 'reminder_signup'
  | 'feedback_opened';

export type EventProperty =
  // tabs
  | 'today' | 'church' | 'companions' | 'help' | 'workshop'
  // tools
  | 'rosary' | 'confession' | 'catechism' | 'lectio' | 'examen' | 'cold-start'
  | 'breathing' | 'grounding' | 'driveway' | 'rule' | 'scripture' | 'prayer-library'
  // companions
  | 'joseph' | 'david' | 'paul' | 'augustine' | 'ignatius' | 'peter' | 'moses' | 'therese' | 'aquinas'
  // funnel sources
  | 'gospel' | 'tab-bar' | 'companion-select' | 'settings';

const pending: Array<{ name: EventName; property?: EventProperty }> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 2000);
}

async function flush(): Promise<void> {
  if (!pending.length) return;
  const batch = pending.splice(0, pending.length);
  const session = getSessionId();
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analytics-track`;
    await Promise.all(
      batch.map((e) =>
        fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ session, name: e.name, property: e.property ?? null }),
        }).catch(() => {}),
      ),
    );
  } catch {
    // swallow — analytics never breaks the app
  }
}

/** Fire an anonymous funnel event. No-op when the man has opted out. */
export function track(name: EventName, property?: EventProperty): void {
  if (!isAnalyticsEnabled()) return;
  pending.push({ name, property });
  scheduleFlush();
}

/** Fire immediately (for events that should not wait for the 2s debounce, e.g. app_open). */
export function trackNow(name: EventName, property?: EventProperty): void {
  if (!isAnalyticsEnabled()) return;
  pending.push({ name, property });
  void flush();
}
