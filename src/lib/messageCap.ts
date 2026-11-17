const DAILY_CAP_KEY = 'sanctum_daily_msg_count';
const DAILY_CAP_DATE_KEY = 'sanctum_daily_msg_date';
export const DAILY_MESSAGE_CAP = 15;

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function getDailyMessageCount(): number {
  try {
    const date = localStorage.getItem(DAILY_CAP_DATE_KEY);
    if (date !== getTodayKey()) return 0;
    return parseInt(localStorage.getItem(DAILY_CAP_KEY) || '0', 10);
  } catch {
    return 0;
  }
}

export function incrementDailyMessageCount(): number {
  try {
    const today = getTodayKey();
    const storedDate = localStorage.getItem(DAILY_CAP_DATE_KEY);
    if (storedDate !== today) {
      localStorage.setItem(DAILY_CAP_DATE_KEY, today);
      localStorage.setItem(DAILY_CAP_KEY, '1');
      return 1;
    }
    const current = parseInt(localStorage.getItem(DAILY_CAP_KEY) || '0', 10);
    const next = current + 1;
    localStorage.setItem(DAILY_CAP_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}

export function getRemainingMessages(): number {
  return Math.max(0, DAILY_MESSAGE_CAP - getDailyMessageCount());
}

export function isAtMessageCap(): boolean {
  return getDailyMessageCount() >= DAILY_MESSAGE_CAP;
}

/**
 * Cap-as-rhythm copy (Play 9b, Nov 16, 2026). The cap counts MESSAGES —
 * one per user send — so the counting line says messages, plainly, in the
 * companions' own frame: they keep hours, the way a house of prayer keeps
 * hours. There is no escalation in the wording or (in ChatInput) the
 * styling as the count runs down; the number simply counts.
 */
export function capRemainingLine(remaining: number): string {
  if (remaining <= 0) return 'Companions keep hours — no messages left today';
  return `Companions keep hours — ${remaining} message${remaining === 1 ? '' : 's'} left today`;
}

/**
 * The closing prayer offered at the cap (Play 9b): brief and original,
 * ending the conversation the way the companions themselves would — in
 * prayer, pointed outward to the sacraments.
 */
export const CAP_CLOSING_PRAYER =
  'Lord Jesus, thank You for the words shared here today. Quiet my heart, keep me in Your grace, and lead me to You in person — at Mass, and in Confession. Amen.';

/** The outward pointer shown at the cap: a priest and the sacraments first. */
export const CAP_OUTWARD_LINE =
  'What a companion cannot give, a priest can. Take what came up today to Mass and to Confession — Real Help can help you find a priest, a director, or a counselor near you.';
