/**
 * The listening speed (Erik, Nov 18, 2026): one on-device preference,
 * shared by every narrator playback — the daily Listen bar and the
 * tailored devotional's player alike — applied through the audio
 * element's playbackRate. Kept under the sanctum_ prefix, so the panic
 * wipe takes it with everything else. The default is 1: the narrators
 * at the pace they were recorded.
 */

export const LISTEN_SPEED_KEY = 'sanctum_listen_speed';

/** The speeds on offer, in the order the player toggle walks them. */
export const LISTEN_SPEEDS = [1, 1.15, 1.3] as const;
export type ListenSpeed = (typeof LISTEN_SPEEDS)[number];

export const DEFAULT_LISTEN_SPEED: ListenSpeed = 1;

/** The stored speed, validated against the offered set; anything else is the default. */
export function loadListenSpeed(): ListenSpeed {
  try {
    const raw = Number(localStorage.getItem(LISTEN_SPEED_KEY));
    return (LISTEN_SPEEDS as readonly number[]).includes(raw) ? (raw as ListenSpeed) : DEFAULT_LISTEN_SPEED;
  } catch {
    return DEFAULT_LISTEN_SPEED;
  }
}

export function saveListenSpeed(speed: ListenSpeed): void {
  try {
    localStorage.setItem(LISTEN_SPEED_KEY, String(speed));
  } catch {
    // storage unavailable — playback simply stays at the recorded pace
  }
}

/** The next speed in the toggle's walk, wrapping back to 1 after the fastest. */
export function nextListenSpeed(speed: ListenSpeed): ListenSpeed {
  const at = LISTEN_SPEEDS.indexOf(speed);
  return LISTEN_SPEEDS[(at + 1) % LISTEN_SPEEDS.length];
}

/** The toggle's face: "1×", "1.15×", "1.3×". */
export function listenSpeedLabel(speed: ListenSpeed): string {
  return `${speed}×`;
}
