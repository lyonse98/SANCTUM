import { useEffect, useState } from 'react';

/**
 * The reading size (Erik, Nov 18, 2026): an on-device setting — Standard,
 * Large, Extra large — that scales the devotional body text (the Gospel
 * card's readings, reflection, and challenge; Tonight's lines) and
 * nothing else. Labels, buttons, and chrome keep their sizes at every
 * setting. The scale never goes below 1, so body text never renders
 * smaller than its Standard size — and the body text it scales already
 * stands at the readability floor (13px and up), so no setting can push
 * a reading below 13px. Kept under the sanctum_ prefix; the panic wipe
 * takes it with everything else.
 */

export const READING_SIZE_KEY = 'sanctum_reading_size';

export type ReadingSize = 'standard' | 'large' | 'xlarge';

export const READING_SIZES: { id: ReadingSize; label: string; scale: number }[] = [
  { id: 'standard', label: 'Standard', scale: 1 },
  { id: 'large', label: 'Large', scale: 1.18 },
  { id: 'xlarge', label: 'Extra large', scale: 1.36 },
];

export const DEFAULT_READING_SIZE: ReadingSize = 'standard';

/** Fired on window when the setting changes, so open surfaces re-render at the new size. */
export const READING_SIZE_EVENT = 'sanctum:reading-size';

export function loadReadingSize(): ReadingSize {
  try {
    const raw = localStorage.getItem(READING_SIZE_KEY);
    return READING_SIZES.some((s) => s.id === raw) ? (raw as ReadingSize) : DEFAULT_READING_SIZE;
  } catch {
    return DEFAULT_READING_SIZE;
  }
}

export function saveReadingSize(size: ReadingSize): void {
  try {
    localStorage.setItem(READING_SIZE_KEY, size);
  } catch {
    // storage unavailable — the setting simply does not persist
  }
  try {
    window.dispatchEvent(new Event(READING_SIZE_EVENT));
  } catch {
    // no window event bus — surfaces pick the size up on their next mount
  }
}

/** The multiplier a setting applies to body text. Never below 1. */
export function readingScale(size: ReadingSize): number {
  return READING_SIZES.find((s) => s.id === size)?.scale ?? 1;
}

/**
 * A body-text size under the current setting: the base size scaled and
 * rounded. The floor is structural — the scale is never below 1 and the
 * bases this is used with stand at 13px or above, so the result can
 * never fall below 13px at any setting.
 */
export function scaledBodyPx(basePx: number, size: ReadingSize): number {
  return Math.max(13, Math.round(basePx * readingScale(size)));
}

/** React access to the setting, live across changes made in Settings. */
export function useReadingSize(): ReadingSize {
  const [size, setSize] = useState<ReadingSize>(() => loadReadingSize());
  useEffect(() => {
    const onChange = () => setSize(loadReadingSize());
    window.addEventListener(READING_SIZE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(READING_SIZE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  return size;
}
