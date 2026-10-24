import { useEffect, useState } from 'react';
import { Check, Download, Share, X } from 'lucide-react';
import {
  canNativeInstall,
  detectPlatform,
  isInAppBrowser,
  promptNativeInstall,
  subscribeInstallChanges,
} from '@/lib/install';

export interface InstallTokens {
  accent: string;
  accentSoft: string;
  border: string;
  textBright: string;
  text: string;
  textMuted: string;
  textDim: string;
}

function stepsFor(platform: string, inApp: boolean): string[] {
  if (platform === 'ios') {
    const steps = [
      'Tap the Share button — the square with an arrow pointing up — at the bottom of Safari.',
      'Scroll down and tap "Add to Home Screen".',
      'Tap "Add". Sanctum now sits on your Home Screen and opens like an app.',
    ];
    if (inApp) {
      return [
        'You opened this inside another app, and apps like Gmail or WhatsApp cannot add to the Home Screen. Tap the ⋯ or Share icon and choose "Open in Safari" first.',
        ...steps,
      ];
    }
    return steps;
  }
  if (platform === 'android') {
    return [
      'Tap the ⋮ menu in the corner of the browser.',
      'Tap "Install app" (on some phones, "Add to Home screen").',
      'Tap "Install" to confirm. Sanctum now opens like an app.',
    ];
  }
  return [
    'In Chrome or Edge, click the install icon at the right end of the address bar — or open the browser menu and choose "Install Sanctum".',
    'Click "Install". Sanctum opens in its own window, like an app.',
  ];
}

/**
 * The home-screen instructions, written for the device in hand: only its own steps,
 * an escape hatch first when the page sits inside another app's browser, and a real
 * one-tap Install button on Android/Chrome when the browser offers one.
 */
export function InstallInstructions({
  tokens,
  onInstalled,
}: {
  tokens: InstallTokens;
  onInstalled?: () => void;
}) {
  const [nativeReady, setNativeReady] = useState(() => canNativeInstall());
  const [installing, setInstalling] = useState(false);
  const [done, setDone] = useState(false);
  const platform = detectPlatform();
  const inApp = isInAppBrowser();
  const steps = stepsFor(platform, inApp);

  useEffect(() => subscribeInstallChanges(() => setNativeReady(canNativeInstall())), []);

  const handleNativeInstall = async () => {
    setInstalling(true);
    const outcome = await promptNativeInstall();
    setInstalling(false);
    if (outcome === 'accepted') {
      setDone(true);
      onInstalled?.();
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 py-1">
        <Check className="w-4 h-4 flex-shrink-0" style={{ color: tokens.accent }} />
        <p className="text-xs font-bold" style={{ color: tokens.textBright }}>
          Done — Sanctum is on your Home Screen.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[11px] leading-relaxed mb-3" style={{ color: tokens.textMuted }}>
        No app store, no account — ten seconds, and Sanctum is one tap away every morning
        and every hard night.
      </p>

      {nativeReady ? (
        <button
          onClick={handleNativeInstall}
          disabled={installing}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-60"
          style={{ backgroundColor: tokens.accent, color: '#fff' }}
        >
          <Download className="w-4 h-4" />
          {installing ? 'Installing…' : 'Install Sanctum — one tap'}
        </button>
      ) : (
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold border"
                style={{
                  backgroundColor: tokens.accentSoft,
                  borderColor: tokens.accent,
                  color: tokens.accent,
                }}
              >
                {i + 1}
              </span>
              <span className="text-[11px] leading-relaxed" style={{ color: tokens.text }}>
                {step}
              </span>
            </li>
          ))}
        </ol>
      )}

      {platform === 'ios' && !inApp && (
        <p className="flex items-center gap-1.5 text-[10px] mt-3" style={{ color: tokens.textDim }}>
          <Share className="w-3 h-3 flex-shrink-0" />
          Look for this Share icon in Safari&rsquo;s toolbar.
        </p>
      )}
    </div>
  );
}

/** Full-screen wrapper so Settings (and anywhere else) can open the same instructions. */
export function InstallModal({
  tokens,
  cardBackground,
  onClose,
}: {
  tokens: InstallTokens;
  cardBackground: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slide-up border p-5"
        style={{ backgroundColor: cardBackground, borderColor: tokens.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5" style={{ color: tokens.accent }} />
            <h2 className="text-sm font-bold font-display uppercase tracking-wide" style={{ color: tokens.textBright }}>
              Keep Sanctum one tap away
            </h2>
          </div>
          <button onClick={onClose} style={{ color: tokens.textDim }} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <InstallInstructions tokens={tokens} onInstalled={onClose} />
      </div>
    </div>
  );
}
