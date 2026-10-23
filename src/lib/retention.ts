const LAST_VISIT_KEY = 'sanctum_last_visit';
const VISIT_COUNT_KEY = 'sanctum_visit_count';
const INSTALL_PROMPTED_KEY = 'sanctum_install_prompted';
const EXAMEN_STREAK_KEY = 'sanctum_examen_streak';
const EXAMEN_LAST_KEY = 'sanctum_examen_last_date';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function daysBetween(dateStr1: string, dateStr2: string): number {
  const [y1, m1, d1] = dateStr1.split('-').map(Number);
  const [y2, m2, d2] = dateStr2.split('-').map(Number);
  const dt1 = new Date(y1, m1 - 1, d1);
  const dt2 = new Date(y2, m2 - 1, d2);
  return Math.round((dt2.getTime() - dt1.getTime()) / 86400000);
}

export function recordVisit(): { isFirstVisit: boolean; isReturning: boolean; visitCount: number; daysSinceLast: number } {
  const today = todayKey();
  let visitCount = 0;
  let lastVisit = '';

  try {
    const raw = localStorage.getItem(VISIT_COUNT_KEY);
    visitCount = raw ? parseInt(raw, 10) : 0;
    lastVisit = localStorage.getItem(LAST_VISIT_KEY) ?? '';
  } catch { /* ignore */ }

  const isFirstVisit = visitCount === 0;
  const daysSinceLast = lastVisit ? daysBetween(lastVisit, today) : 0;
  const isReturning = !isFirstVisit && daysSinceLast >= 1;

  visitCount += 1;

  try {
    localStorage.setItem(VISIT_COUNT_KEY, String(visitCount));
    localStorage.setItem(LAST_VISIT_KEY, today);
  } catch { /* ignore */ }

  return { isFirstVisit, isReturning, visitCount, daysSinceLast };
}

export function shouldShowInstallPrompt(): boolean {
  try {
    const prompted = localStorage.getItem(INSTALL_PROMPTED_KEY) === 'true';
    if (prompted) return false;
    const raw = localStorage.getItem(VISIT_COUNT_KEY);
    const count = raw ? parseInt(raw, 10) : 0;
    return count >= 3;
  } catch {
    return false;
  }
}

export function markInstallPrompted(): void {
  try {
    localStorage.setItem(INSTALL_PROMPTED_KEY, 'true');
  } catch { /* ignore */ }
}

export function recordExamenComplete(): { streak: number; isNew: boolean } {
  const today = todayKey();
  let streak = 0;
  let lastDate = '';

  try {
    streak = parseInt(localStorage.getItem(EXAMEN_STREAK_KEY) ?? '0', 10) || 0;
    lastDate = localStorage.getItem(EXAMEN_LAST_KEY) ?? '';
  } catch { /* ignore */ }

  if (lastDate === today) {
    return { streak: Math.max(streak, 1), isNew: false };
  }

  const gap = lastDate ? daysBetween(lastDate, today) : 99;
  if (gap === 1) {
    streak += 1;
  } else {
    streak = 1;
  }

  try {
    localStorage.setItem(EXAMEN_STREAK_KEY, String(streak));
    localStorage.setItem(EXAMEN_LAST_KEY, today);
  } catch { /* ignore */ }

  return { streak, isNew: true };
}

export function getExamenStreak(): number {
  try {
    return parseInt(localStorage.getItem(EXAMEN_STREAK_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}
