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
