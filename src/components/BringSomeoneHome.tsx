import { useEffect, useState } from 'react';
import { Check, Copy, Share2, X } from 'lucide-react';
import { COME_HOME_URL } from '@/lib/comeHome';
import { PRINT_SERIF } from '@/lib/print';
import type { PersonaTheme } from '@/types';

interface BringSomeoneHomeProps {
  open: boolean;
  t: PersonaTheme;
  onClose: () => void;
}

const SHARE_LINE = 'Seven quiet days of welcome back — a Gospel a day, no strings.';

/**
 * The sender's half of the come-home door (Erik, Nov 18, 2026): a small
 * sheet off Today's More of Sanctum explaining the link and offering it
 * by share or copy. The link is a bare URL, identical for everyone —
 * there is no sender-side state: Sanctum never learns who it was sent
 * to, whether it was opened, or what happened next, and the sheet says
 * so in plain words before it offers the button.
 */
export function BringSomeoneHome({ open, t, onClose }: BringSomeoneHomeProps) {
  const [copied, setCopied] = useState(false);

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
      await navigator.clipboard.writeText(COME_HOME_URL);
      setCopied(true);
    } catch {
      // Clipboard can be blocked outside a secure context — the link stands below to copy by hand.
      setCopied(false);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Sanctum', text: SHARE_LINE, url: COME_HOME_URL });
        return;
      }
      await handleCopy();
    } catch {
      // The user dismissed the share sheet; nothing to recover from.
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-label="Bring someone home"
    >
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border p-5 animate-slide-up"
        style={{ backgroundColor: t.card, borderColor: t.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <p
            className="text-[12px] font-bold uppercase tracking-[0.2em]"
            style={{ fontFamily: PRINT_SERIF, color: t.accent }}
          >
            Bring someone home
          </p>
          <button onClick={onClose} aria-label="Close" style={{ color: t.textDim }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[13px] leading-relaxed mb-3" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
          For someone who has been away from the Church: seven quiet days — a short welcome and the
          day&rsquo;s Gospel — ending with an open door to a parish. No account, no sign-up, nothing
          asked of them.
        </p>
        <p className="text-[13px] leading-relaxed mb-4" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
          The link is the same for everyone. Sanctum never learns who you sent it to, and nothing
          about them is ever reported back to you.
        </p>
        <p
          className="text-[13px] break-all border px-3 py-2.5 mb-3"
          style={{ fontFamily: PRINT_SERIF, color: t.text, borderColor: t.border, backgroundColor: `${t.border}1F` }}
        >
          {COME_HOME_URL}
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            className="flex-1 min-h-[48px] flex items-center justify-center gap-2 px-4 py-3 border transition-opacity hover:opacity-80 active:opacity-60"
            style={{ backgroundColor: t.accent, borderColor: t.accent, color: '#fff' }}
          >
            <Share2 className="w-4 h-4" />
            <span className="text-[12px] font-bold uppercase tracking-wide" style={{ fontFamily: PRINT_SERIF }}>
              Share the link
            </span>
          </button>
          <button
            onClick={handleCopy}
            className="min-h-[48px] flex items-center justify-center gap-2 px-4 py-3 border transition-opacity hover:opacity-80 active:opacity-60"
            style={{ backgroundColor: 'transparent', borderColor: t.border, color: t.textBright }}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span className="text-[12px] font-bold uppercase tracking-wide" style={{ fontFamily: PRINT_SERIF }}>
              {copied ? 'Copied' : 'Copy'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
