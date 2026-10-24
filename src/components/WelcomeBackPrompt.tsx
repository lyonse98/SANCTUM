import { useEffect, useState } from 'react';
import { Heart, Download, X } from 'lucide-react';
import { PERSONAS } from '@/personas';
import { recordVisit, shouldShowInstallPrompt, snoozeInstallPrompt, clearInstallValueMoment } from '@/lib/retention';
import { InstallInstructions } from '@/components/InstallInstructions';
import { canNativeInstall, subscribeInstallChanges } from '@/lib/install';

interface WelcomeBackPromptProps {
  onOpenCompanions: () => void;
  onOpenWorkshop: () => void;
}

export function WelcomeBackPrompt({ onOpenCompanions, onOpenWorkshop }: WelcomeBackPromptProps) {
  const [welcomeBack, setWelcomeBack] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [daysSince, setDaysSince] = useState(0);
  const t = PERSONAS[0].theme;

  useEffect(() => {
    const visit = recordVisit();
    setDaysSince(visit.daysSinceLast);
    if (visit.isReturning) {
      setWelcomeBack(true);
    }
    if (shouldShowInstallPrompt()) {
      const timer = setTimeout(() => setShowInstall(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissWelcome = () => setWelcomeBack(false);
  const dismissInstall = (days: number) => {
    setShowInstall(false);
    snoozeInstallPrompt(days);
    clearInstallValueMoment();
  };

  // If the browser offers a native prompt mid-view, or the install lands, refresh/close.
  useEffect(() => subscribeInstallChanges(() => {
    if (shouldShowInstallPrompt()) setShowInstall(true);
  }), []);

  return (
    <>
      {/* Welcome back toast */}
      {welcomeBack && (
        <div
          className="fixed top-0 left-0 right-0 z-40 flex justify-center px-4 animate-slide-down"
        >
          <div
            className="mt-4 w-full max-w-md rounded-xl border shadow-2xl px-4 py-3 flex items-center gap-3"
            style={{ backgroundColor: t.card, borderColor: t.accentRgba(0.3) }}
          >
            <Heart className="w-5 h-5 flex-shrink-0" style={{ color: t.accent }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold font-display" style={{ color: t.textBright }}>
                {daysSince === 1 ? 'Good to see you again.' : `Good to see you again — it's been ${daysSince} days.`}
              </p>
              <p className="text-[11px] leading-relaxed" style={{ color: t.textDim }}>
                Pick up where you left off.
              </p>
            </div>
            <button
              onClick={dismissWelcome}
              className="p-1 rounded transition-opacity hover:opacity-70 flex-shrink-0"
              style={{ color: t.textDim }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Install prompt — platform-specific steps, a real one-tap button on
          Android/Chrome, and a dismissal that snoozes instead of banning forever. */}
      {showInstall && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 animate-slide-up"
        >
          <div
            className="mb-4 w-full max-w-md rounded-xl border shadow-2xl px-4 py-4"
            style={{ backgroundColor: t.card, borderColor: t.border }}
          >
            <div className="flex items-start gap-3 mb-3">
              <Download className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: t.accent }} />
              <div className="flex-1">
                <p className="text-sm font-bold font-display" style={{ color: t.textBright }}>
                  Keep Sanctum one tap away
                </p>
              </div>
              <button
                onClick={() => dismissInstall(14)}
                className="p-1 rounded transition-opacity hover:opacity-70 flex-shrink-0"
                style={{ color: t.textDim }}
                aria-label="Not now"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <InstallInstructions
              tokens={{
                accent: t.accent,
                accentSoft: t.accentRgba(0.15),
                border: t.border,
                textBright: t.textBright,
                text: t.text,
                textMuted: t.textMuted,
                textDim: t.textDim,
              }}
              onInstalled={() => { setShowInstall(false); clearInstallValueMoment(); }}
            />
            {!canNativeInstall() && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => dismissInstall(30)}
                  className="flex-1 py-2.5 rounded-lg text-xs font-bold transition-all active:scale-95"
                  style={{ backgroundColor: t.accentRgba(0.15), color: t.accent, border: `1px solid ${t.accentRgba(0.3)}` }}
                >
                  Got it
                </button>
                <button
                  onClick={() => dismissInstall(14)}
                  className="px-4 py-2.5 rounded-lg text-xs font-medium transition-all active:scale-95"
                  style={{ color: t.textDim }}
                >
                  Not now
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
