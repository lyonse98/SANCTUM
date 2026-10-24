import { useState, useEffect } from 'react';
import { X, ShieldAlert, Lock, MessageSquare, BarChart3 } from 'lucide-react';
import { useFeedback } from '@/components/FeedbackProvider';
import { isAnalyticsEnabled, setAnalyticsEnabled } from '@/lib/analytics';
import { PRIVACY_PARAGRAPH, ANALYTICS_COPY } from '@/lib/privacyCopy';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onOpenTerms?: () => void;
}

export function SettingsModal({ open, onClose, onOpenTerms }: SettingsModalProps) {
  const feedback = useFeedback();
  const [analyticsOn, setAnalyticsOn] = useState(() => isAnalyticsEnabled());

  useEffect(() => {
    if (open) setAnalyticsOn(isAnalyticsEnabled());
  }, [open ]);

  if (!open) return null;

  const getVar = (name: string) => `var(${name})`;
  const card = getVar('--p-card');
  const border = getVar('--p-border');
  const accent = getVar('--p-accent');
  const textBright = getVar('--p-text-bright');
  const textMuted = getVar('--p-text-muted');
  const textDim = getVar('--p-text-dim');

  const borderRgba50 = 'color-mix(in srgb, var(--p-border) 50%, transparent)';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slide-up max-h-[85vh] overflow-y-auto chat-scroll border"
        style={{ backgroundColor: card, borderColor: `${border}99` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b sticky top-0 rounded-t-2xl"
          style={{ borderColor: `${border}66`, backgroundColor: card }}
        >
          <h2 className="text-sm font-bold font-display uppercase tracking-wide" style={{ color: textBright }}>Settings</h2>
          <button onClick={onClose} className="transition-colors" style={{ color: textDim }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">


          <div className="pt-2 space-y-3">
            <div className="rounded-lg p-3 border" style={{ backgroundColor: borderRgba50, borderColor: borderRgba50 }}>
              <div className="flex items-start gap-2">
                <BarChart3 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
                <div className="flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: textBright }}>
                    Usage Analytics
                  </p>
                  <p className="text-[11px] leading-relaxed mb-2" style={{ color: textMuted }}>
{ANALYTICS_COPY}
                  </p>
                  <button
                    onClick={() => {
                      const next = !analyticsOn;
                      setAnalyticsOn(next);
                      setAnalyticsEnabled(next);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all"
                    style={{ backgroundColor: analyticsOn ? accent : 'transparent', borderColor: accent, color: analyticsOn ? '#fff' : textMuted }}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wide">
                      {analyticsOn ? 'Analytics On' : 'Analytics Off'}
                    </span>
                    <span className="text-[10px]">{analyticsOn ? 'Tap to turn off' : 'Tap to turn on'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg p-3 border" style={{ backgroundColor: borderRgba50, borderColor: borderRgba50 }}>
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: textBright }}>
                    Not a Therapy Service
                  </p>
                  <p className="text-[11px] leading-relaxed" style={{ color: textMuted }}>
                    This is a spiritual companion, not a licensed therapist or medical professional. If you are in
                    crisis, call or text <span className="font-bold">988</span> (US). For domestic violence, call{' '}
                    <span className="font-bold">1-800-799-7233</span>. If outside the US, visit findahelpline.com.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg p-3 border" style={{ backgroundColor: borderRgba50, borderColor: borderRgba50 }}>
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: textBright }}>
                    Your Privacy
                  </p>
                  <p className="text-[11px] leading-relaxed" style={{ color: textMuted }}>
{PRIVACY_PARAGRAPH}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-1 space-y-2">
            <button
              onClick={() => { onClose(); feedback?.openFeedback('settings'); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border transition-all"
              style={{
                backgroundColor: borderRgba50,
                borderColor: borderRgba50,
                color: textMuted,
              }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Feedback / Bug Report
            </button>

            <button
              onClick={() => { onClose(); onOpenTerms?.(); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border transition-all"
              style={{
                backgroundColor: borderRgba50,
                borderColor: borderRgba50,
                color: textMuted,
              }}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Terms & Privacy Disclaimer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
