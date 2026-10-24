import { useEffect, useMemo, useState } from 'react';
import { X, Link2, Check, Share2, Lock, Church } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import { PRIVACY_SHARE } from '@/lib/privacyCopy';

interface ShareInviteModalProps {
  open: boolean;
  t: PersonaTheme;
  onClose: () => void;
}

const INVITE_LINE =
  'Sanctum — a private Catholic companion for men. Daily Gospel, examen, and eight voices for the road. No account needed.';

function appUrl(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export function ShareInviteModal({ open, t, onClose }: ShareInviteModalProps) {
  const [copied, setCopied] = useState(false);
  const url = useMemo(() => appUrl(), []);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard can be blocked outside a secure context — let them select it by hand.
      setCopied(false);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Sanctum', text: INVITE_LINE, url });
        return;
      }
      await handleCopy();
    } catch {
      // The user dismissed the share sheet; nothing to recover from.
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl border max-w-md w-full overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto chat-scroll"
        style={{ backgroundColor: t.card, borderColor: t.borderLight }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10"
          style={{ backgroundColor: t.card, borderColor: t.border }}
        >
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4" style={{ color: t.accent }} />
            <h3 className="text-sm font-semibold" style={{ color: t.textBright }}>
              Pass it on
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-opacity hover:opacity-70"
            style={{ color: t.textMuted }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <div
            className="rounded-xl border p-4 mb-4"
            style={{ borderColor: t.accentRgba(0.3), backgroundColor: t.accentRgba(0.07) }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0"
                style={{ borderColor: t.accentRgba(0.4), backgroundColor: t.accentRgba(0.1) }}
              >
                <Church className="w-4 h-4" style={{ color: t.accent }} strokeWidth={2.2} />
              </div>
              <span
                className="text-sm font-bold font-display uppercase tracking-wide"
                style={{ color: t.textBright }}
              >
                Sanctum
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>
              {INVITE_LINE}
            </p>
          </div>

          <p className="text-[9px] uppercase tracking-widest font-bold mb-1.5" style={{ color: t.textDim }}>
            The link
          </p>
          <div className="flex items-center gap-2">
            <div
              className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 rounded-lg border"
              style={{ borderColor: `${t.border}99`, backgroundColor: `${t.border}26` }}
            >
              <Link2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: t.textDim }} />
              <span className="text-xs truncate" style={{ color: t.text }}>
                {url || 'Open Sanctum to get the link'}
              </span>
            </div>
            <button
              onClick={handleCopy}
              disabled={!url}
              className="flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border transition-all active:scale-[0.97] disabled:opacity-50"
              style={{
                backgroundColor: copied ? t.accentRgba(0.14) : `${t.border}40`,
                borderColor: copied ? t.accentRgba(0.4) : `${t.border}99`,
                color: copied ? t.accent : t.textMuted,
              }}
              aria-label="Copy link"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
              <span className="text-[11px] font-bold uppercase tracking-wide">
                {copied ? 'Copied' : 'Copy'}
              </span>
            </button>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => void handleShare()}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all active:scale-[0.98]"
              style={{ backgroundColor: t.accent, color: '#fff' }}
            >
              <Share2 className="w-4 h-4" />
              Share the link
            </button>
          </div>

          <p
            className="flex items-start justify-center gap-1.5 text-[11px] mt-3 text-center leading-relaxed"
            style={{ color: t.textDim }}
          >
            <Lock className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>{PRIVACY_SHARE}</span>
          </p>
          <p className="text-[11px] mt-2 text-center leading-relaxed" style={{ color: t.textDim }}>
            Sending it to a phone? Tell him: open the link, tap Share &rarr; &ldquo;Add to Home Screen&rdquo;,
            and Sanctum lives on his home screen like an app.
          </p>
        </div>
      </div>
    </div>
  );
}
