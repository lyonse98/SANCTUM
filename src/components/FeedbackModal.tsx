import { useState } from 'react';
import { Lightbulb, Bug, MessageSquare, X, Send, Check, Loader2, AlertCircle, Mail } from 'lucide-react';
import type { PersonaTheme } from '@/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const MAX_MESSAGE_LENGTH = 4000;

type Category = 'idea' | 'bug' | 'other';

const CATEGORIES: { id: Category; label: string; hint: string; Icon: typeof Lightbulb }[] = [
  { id: 'idea', label: 'An idea', hint: 'Something Sanctum should do', Icon: Lightbulb },
  { id: 'bug', label: 'Something broke', hint: 'A screen that misbehaved', Icon: Bug },
  { id: 'other', label: 'Something else', hint: 'Anything at all', Icon: MessageSquare },
];

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  t: PersonaTheme;
  /** Where the man was standing when he wrote this — context for a bug report. */
  page?: string;
}

export function FeedbackModal({ open, onClose, t, page }: FeedbackModalProps) {
  const [category, setCategory] = useState<Category>('idea');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const trimmed = message.trim();
  const canSend = trimmed.length > 0 && !busy;

  const handleClose = () => {
    onClose();
    // Reset only after the modal is gone, so the user never sees the form flicker.
    setTimeout(() => {
      setSent(false);
      setError(null);
      setMessage('');
      setEmail('');
      setCategory('idea');
    }, 200);
  };

  const handleSend = async () => {
    if (!canSend) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/feedback-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          category,
          message: trimmed,
          contactEmail: email.trim() || undefined,
          page,
        }),
      });

      const body = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        setError(body?.error ?? 'Could not send that just now. Please try again.');
        setBusy(false);
        return;
      }

      setSent(true);
    } catch {
      setError('No connection. Your words are still here — try again when you are back online.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto chat-scroll"
        style={{ backgroundColor: t.bg, borderColor: t.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10"
          style={{ backgroundColor: t.bg, borderColor: t.border }}
        >
          <h3
            className="text-sm font-bold font-display uppercase tracking-wide"
            style={{ color: t.textBright }}
          >
            {sent ? 'Thank you' : 'Send Feedback'}
          </h3>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg transition-opacity hover:opacity-70"
            aria-label="Close"
            style={{ color: t.textMuted }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {sent ? (
          <div className="px-5 py-8 text-center animate-fade-in">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 border"
              style={{ backgroundColor: t.accentRgba(0.12), borderColor: t.accentRgba(0.4) }}
            >
              <Check className="w-6 h-6" style={{ color: t.accent }} />
            </div>
            <p className="text-sm font-bold font-display mb-2" style={{ color: t.textBright }}>
              It is in the queue
            </p>
            <p className="text-xs leading-relaxed mb-5" style={{ color: t.textMuted }}>
              Every note gets read. No automated reply, and nothing about you is attached to it.
            </p>
            <button
              onClick={handleClose}
              className="w-full py-2.5 rounded-lg text-xs font-bold border transition-all active:scale-[0.98]"
              style={{ backgroundColor: t.accentRgba(0.14), borderColor: t.accentRgba(0.4), color: t.accent }}
            >
              Close
            </button>
          </div>
        ) : (
          <div className="px-5 py-4">
            <p className="text-[11px] leading-relaxed mb-4" style={{ color: t.textMuted }}>
              Tell us what is working, what is broken, or what is missing. This goes straight to the
              person who builds Sanctum.
            </p>

            <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: t.textDim }}>
              What is this?
            </p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {CATEGORIES.map(({ id, label, hint, Icon }) => {
                const active = category === id;
                return (
                  <button
                    key={id}
                    onClick={() => setCategory(id)}
                    title={hint}
                    className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border transition-all active:scale-[0.97]"
                    style={{
                      backgroundColor: active ? t.accentRgba(0.12) : `${t.border}33`,
                      borderColor: active ? t.accentRgba(0.45) : `${t.border}80`,
                      color: active ? t.accent : t.textMuted,
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-center leading-tight">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>

            <label
              htmlFor="feedback-message"
              className="block text-[10px] uppercase tracking-widest font-bold mb-2"
              style={{ color: t.textDim }}
            >
              Your note
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => { setMessage(e.target.value); setError(null); }}
              rows={5}
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={busy}
              placeholder={
                category === 'bug'
                  ? 'What happened, and what did you expect instead?'
                  : 'What would make Sanctum better for you?'
              }
              className="w-full text-sm rounded-lg px-3 py-2.5 border focus:outline-none transition-colors resize-none chat-scroll disabled:opacity-60"
              style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}80`, color: t.text }}
            />
            {trimmed.length > MAX_MESSAGE_LENGTH - 500 && (
              <p className="text-[10px] mt-1 text-right" style={{ color: t.textDim }}>
                {MAX_MESSAGE_LENGTH - trimmed.length} characters left
              </p>
            )}

            <label
              htmlFor="feedback-email"
              className="block text-[10px] uppercase tracking-widest font-bold mb-2 mt-4"
              style={{ color: t.textDim }}
            >
              Email — optional
            </label>
            <div className="relative">
              <Mail
                className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: t.textDim }}
              />
              <input
                id="feedback-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                disabled={busy}
                placeholder="Only if you want a reply"
                className="w-full text-sm rounded-lg pl-9 pr-3 py-2.5 border focus:outline-none transition-colors disabled:opacity-60"
                style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}80`, color: t.text }}
              />
            </div>
            <p className="text-[10px] leading-relaxed mt-2" style={{ color: t.textDim }}>
              Leave it blank to stay anonymous. Your note is saved along with the name of the screen you
              were on — nothing else about you is recorded.
            </p>

            {error && (
              <div
                className="flex items-start gap-2 mt-3 rounded-lg border px-3 py-2.5 animate-fade-in"
                style={{ backgroundColor: 'rgba(153,27,27,0.06)', borderColor: 'rgba(153,27,27,0.25)' }}
              >
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#991B1B' }} />
                <p className="text-[10px] leading-relaxed" style={{ color: '#991B1B' }}>
                  {error}
                </p>
              </div>
            )}

            <button
              onClick={() => void handleSend()}
              disabled={!canSend}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all active:scale-[0.98] mt-4 disabled:opacity-50"
              style={{ backgroundColor: t.accentRgba(0.14), borderColor: t.accentRgba(0.4), color: t.accent }}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span className="text-xs font-bold uppercase tracking-wide">
                {busy ? 'Sending…' : 'Send it'}
              </span>
            </button>

            <p className="text-[10px] leading-relaxed mt-3 text-center" style={{ color: t.textDim }}>
              Nothing is emailed yet. Your note is saved where it can be read, so nothing is lost.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
