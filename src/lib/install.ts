/**
 * Home-screen install plumbing. Until Sanctum is a store app, the home-screen icon is
 * the retention channel — this module answers three questions for the UI:
 *   1. Is Sanctum already running from the home screen? (Never prompt then.)
 *   2. What device is this, and was the page opened inside another app's browser?
 *      (In-app browsers cannot install — the #1 failure mode for shared links.)
 *   3. Did Chrome/Android offer a native install prompt we can fire with one tap?
 */

export type InstallPlatform = 'ios' | 'android' | 'desktop';

const INSTALLED_KEY = 'sanctum_installed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    markInstalled();
    notify();
  });
}

export function subscribeInstallChanges(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function markInstalled(): void {
  try {
    localStorage.setItem(INSTALLED_KEY, 'true');
  } catch {
    // ignore
  }
}

export function isInstalledFlagSet(): boolean {
  try {
    return localStorage.getItem(INSTALLED_KEY) === 'true';
  } catch {
    return false;
  }
}

/** True when running as an installed web app (home-screen launch), not in a browser tab. */
export function isStandaloneDisplay(): boolean {
  try {
    if (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) {
      return true;
    }
    const nav = navigator as Navigator & { standalone?: boolean };
    return nav.standalone === true;
  } catch {
    return false;
  }
}

export function detectPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  // iPadOS reports as Macintosh but has touch.
  if (/Macintosh/i.test(ua) && 'ontouchend' in document) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/**
 * True when the page is inside another app's embedded browser (Gmail, WhatsApp,
 * Instagram, Facebook, the Google app, an Android WebView). Those surfaces have no
 * Add to Home Screen — the user must open the page in a real browser first.
 */
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter for|Snapchat|GSA\/|; wv\)/i.test(ua)) return true;
  // iOS webviews omit the Safari token; real Safari and the major iOS browsers carry it
  // (directly or via their own CriOS/FxiOS/EdgiOS tokens).
  if (detectPlatform() === 'ios' && !/Safari\/|CriOS|FxiOS|EdgiOS/i.test(ua)) return true;
  return false;
}

export function canNativeInstall(): boolean {
  return deferredPrompt !== null;
}

export async function promptNativeInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const event = deferredPrompt;
  deferredPrompt = null;
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'accepted') markInstalled();
    notify();
    return choice.outcome;
  } catch {
    notify();
    return 'unavailable';
  }
}
