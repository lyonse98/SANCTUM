import { useState, useEffect } from 'react';
import { X, ShieldAlert, Lock, MessageSquare, BarChart3, Download, Users, Eraser } from 'lucide-react';
import { useFeedback } from '@/components/FeedbackProvider';
import { isAnalyticsEnabled, setAnalyticsEnabled } from '@/lib/analytics';
import { PRIVACY_PARAGRAPH, analyticsCopy } from '@/lib/privacyCopy';
import { eraseTailorProfile, hasTailorProfile } from '@/lib/tailorProfile';
import type { Audience } from '@/types';
import { InstallModal } from '@/components/InstallInstructions';

interface SettingsModalProps {
  open: boolean;
  audience: Audience;
  onAudienceChange: (audience: Audience) => void;
  onClose: () => void;
  onOpenTerms?: () => void;
}

export function SettingsModal({ open, audience, onAudienceChange, onClose, onOpenTerms }: SettingsModalProps) {
  const feedback = useFeedback();
  const [analyticsOn, setAnalyticsOn] = useState(() => isAnalyticsEnabled());
  const [installOpen, setInstallOpen] = useState(false);
  // The Tailor profile erase shows only when this track actually has one —
  // re-checked each time the sheet opens, since the profile is edited in the
  // Tailor panel, not here.
  const [tailorProfileExists, setTailorProfileExists] = useState(false);

  useEffect(() => {
    if (open) {
      setAnalyticsOn(isAnalyticsEnabled());
      setTailorProfileExists(hasTailorProfile(audience));
    }
  }, [open, audience]);

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

          {/* The track switch. Switching closes any open companion and returns to
              Today; each companion's conversation is kept separately on-device. */}
          <div className="rounded-lg p-3 border" style={{ backgroundColor: borderRgba50, borderColor: borderRgba50 }}>
            <div className="flex items-start gap-2">
              <Users className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
              <div className="flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: textBright }}>
                  Your Track
                </p>
                <p className="text-[11px] leading-relaxed mb-2" style={{ color: textMuted }}>
                  Sanctum is kept for men and for women — different companions, reflections, and
                  examinations for the life being lived. Switching closes your current companion and
                  returns to Today; every companion&rsquo;s conversation stays saved separately on this device.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'men', label: 'For Men' },
                    { id: 'women', label: 'For Women' },
                  ] as const).map((opt) => {
                    const selected = audience === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => { if (!selected) onAudienceChange(opt.id); }}
                        aria-pressed={selected}
                        className="py-2 px-2 rounded-lg border text-[11px] font-bold uppercase tracking-wide transition-all"
                        style={{
                          backgroundColor: selected ? accent : 'transparent',
                          borderColor: accent,
                          color: selected ? '#fff' : textMuted,
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>


          <div className="pt-2 space-y-3">
            <div className="rounded-lg p-3 border" style={{ backgroundColor: borderRgba50, borderColor: borderRgba50 }}>
              <div className="flex items-start gap-2">
                <BarChart3 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
                <div className="flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: textBright }}>
                    Usage Analytics
                  </p>
                  <p className="text-[11px] leading-relaxed mb-2" style={{ color: textMuted }}>
{analyticsCopy(audience)}
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

            {tailorProfileExists && (
              <div className="rounded-lg p-3 border" style={{ backgroundColor: borderRgba50, borderColor: borderRgba50 }}>
                <div className="flex items-start gap-2">
                  <Eraser className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
                  <div className="flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: textBright }}>
                      Tailor Profile
                    </p>
                    <p className="text-[11px] leading-relaxed mb-2" style={{ color: textMuted }}>
                      Your standing Tailor Today profile — your season of life, the battles you
                      named, your goal — is kept on this device only. Erase it here whenever you
                      like; Tailor Today will simply ask each morning afresh.
                    </p>
                    <button
                      onClick={() => {
                        eraseTailorProfile(audience);
                        setTailorProfileExists(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all"
                      style={{ backgroundColor: 'transparent', borderColor: accent, color: textMuted }}
                    >
                      <Eraser className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-bold uppercase tracking-wide">Erase Tailor profile</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-1 space-y-2">
            <button
              onClick={() => setInstallOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border transition-all"
              style={{
                backgroundColor: borderRgba50,
                borderColor: borderRgba50,
                color: textMuted,
              }}
            >
              <Download className="w-3.5 h-3.5" />
              Add Sanctum to your Home Screen
            </button>

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
      {installOpen && (
        <InstallModal
          cardBackground={card}
          tokens={{
            accent,
            accentSoft: borderRgba50,
            border,
            textBright,
            text: `var(--p-text)`,
            textMuted,
            textDim,
          }}
          onClose={() => setInstallOpen(false)}
        />
      )}
    </div>
  );
}
