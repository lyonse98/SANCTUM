import { useState } from 'react';
import { Church, Loader2 } from 'lucide-react';
import {
  ACCESS_CONTACT_MAX,
  ACCESS_NAME_MAX,
  ACCESS_NOTE_MAX,
  submitAccessRequest,
  validateAccessRequest,
  type AccessRequestErrors,
} from '@/lib/accessRequest';
import { CrisisLine } from '@/components/CrisisLine';
import { SeasonBackdrop } from '@/components/SeasonBackdrop';
import { PRINT_SERIF, PRINT_STAMP_CLASS } from '@/lib/print';
import type { PersonaTheme } from '@/types';

interface AccessRequestPageProps {
  t: PersonaTheme;
  accent: string;
}

/**
 * The access-request door (Erik, Nov 20, 2026): the surface the bare
 * ?access=1 link opens — the Instagram bio link — BEFORE the welcome
 * gate, with no track choice asked. While Sanctum is in a small
 * testing season, the public link asks instead of admitting: a name, a
 * way to reach the person, one optional line. The request rides the
 * feedback door to where Erik already reads, and he sends the app
 * link personally to the people he lets in. There is deliberately no
 * link into the app anywhere on this page.
 *
 * The privacy shape is stated on the page itself: this request is the
 * one thing kept on a server — a name and a contact, so a person can
 * be answered. The surface collects nothing else: no analytics event,
 * no tally, no core act, and nothing stored on the device.
 */
export function AccessRequestPage({ t, accent }: AccessRequestPageProps) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<AccessRequestErrors>({});
  const [sendError, setSendError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (busy || sent) return;
    const fields = { name, contact, note };
    const found = validateAccessRequest(fields);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setSendError(null);
    const result = await submitAccessRequest(fields);
    setBusy(false);
    if (result.ok) {
      setSent(true);
    } else {
      setSendError(result.error);
    }
  };

  const fieldError = (message?: string) =>
    message ? (
      <p className="text-[13px] leading-relaxed mt-1.5" style={{ fontFamily: PRINT_SERIF, color: '#991B1B' }}>
        {message}
      </p>
    ) : null;

  const labelClass = `${PRINT_STAMP_CLASS} block mb-2`;
  const inputStyle: React.CSSProperties = {
    backgroundColor: `${t.border}26`,
    borderColor: t.border,
    color: t.text,
    fontFamily: PRINT_SERIF,
    fontSize: 15,
  };

  return (
    <div className="fixed inset-0 overflow-y-auto chat-scroll" style={{ backgroundColor: t.bg }} data-access-request-page>
      <SeasonBackdrop />
      <div
        className="relative z-10 min-h-full flex flex-col items-center px-5 py-8 pb-16 max-w-2xl mx-auto"
        style={{
          backgroundColor: t.card,
          borderLeft: `1px solid ${t.border}`,
          borderRight: `1px solid ${t.border}`,
        }}
      >
        <div className="w-full text-center mb-6">
          <Church className="w-5 h-5 mx-auto mb-2" style={{ color: accent }} strokeWidth={2.2} aria-hidden="true" />
          <p
            className="text-[12px] font-bold uppercase tracking-[0.22em] mb-1"
            style={{ fontFamily: PRINT_SERIF, color: accent }}
          >
            Sanctum
          </p>
          <h1 className="text-[22px] leading-tight mt-3" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
            Sanctum is in a small testing season
          </h1>
        </div>

        <div className="w-full mb-6">
          <p className="leading-relaxed mb-3" style={{ fontFamily: PRINT_SERIF, color: t.text, fontSize: 15 }}>
            Sanctum is a daily devotional for your phone: the day&rsquo;s Gospel each morning, a short
            reflection, prayers and the Rosary, and companions to talk with. It is free — no account,
            and nothing you write in it is stored on a server.
          </p>
          <p className="leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.textMuted, fontSize: 15 }}>
            For now the door is kept small on purpose. Requests are read by the man who built it. If
            there&rsquo;s room, he sends you the link personally.
          </p>
        </div>

        {sent ? (
          <div className="w-full pt-6 mb-6 text-center" style={{ borderTop: `1px solid ${t.border}` }} data-access-success>
            <h2 className="text-[19px] leading-tight mb-3" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
              Your request is in.
            </h2>
            <p className="leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.textMuted, fontSize: 15 }}>
              If there&rsquo;s room in this season, you&rsquo;ll hear from Erik personally.
            </p>
          </div>
        ) : (
          <div className="w-full pt-6 mb-6" style={{ borderTop: `1px solid ${t.border}` }}>
            <div className="mb-4">
              <label htmlFor="access-name" className={labelClass} style={{ color: t.textDim }}>
                Your name
              </label>
              <input
                id="access-name"
                type="text"
                autoComplete="name"
                maxLength={ACCESS_NAME_MAX}
                value={name}
                onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: undefined })); }}
                disabled={busy}
                className="w-full rounded-none px-3 py-2.5 border focus:outline-none disabled:opacity-60"
                style={inputStyle}
              />
              {fieldError(errors.name)}
            </div>

            <div className="mb-4">
              <label htmlFor="access-contact" className={labelClass} style={{ color: t.textDim }}>
                Email, phone, or Instagram — however he should reach you
              </label>
              <input
                id="access-contact"
                type="text"
                autoComplete="off"
                spellCheck={false}
                maxLength={ACCESS_CONTACT_MAX}
                value={contact}
                onChange={(e) => { setContact(e.target.value); setErrors((prev) => ({ ...prev, contact: undefined })); }}
                disabled={busy}
                className="w-full rounded-none px-3 py-2.5 border focus:outline-none disabled:opacity-60"
                style={inputStyle}
              />
              {fieldError(errors.contact)}
            </div>

            <div className="mb-5">
              <label htmlFor="access-note" className={labelClass} style={{ color: t.textDim }}>
                Who sent you, or anything he should know? <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <input
                id="access-note"
                type="text"
                autoComplete="off"
                maxLength={ACCESS_NOTE_MAX}
                value={note}
                onChange={(e) => { setNote(e.target.value); setErrors((prev) => ({ ...prev, note: undefined })); }}
                disabled={busy}
                className="w-full rounded-none px-3 py-2.5 border focus:outline-none disabled:opacity-60"
                style={inputStyle}
              />
              {fieldError(errors.note)}
            </div>

            <p className="text-[13px] leading-relaxed mb-4" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
              This request is the one thing kept on a server — your name and contact, so he can answer
              you. Nothing in the app itself is stored.
            </p>

            {sendError && (
              <p className="text-[13px] leading-relaxed mb-3" style={{ fontFamily: PRINT_SERIF, color: '#991B1B' }}>
                {sendError}
              </p>
            )}

            <button
              onClick={() => void handleSubmit()}
              disabled={busy}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 px-4 py-3 border transition-opacity hover:opacity-80 active:opacity-60 disabled:opacity-60"
              style={{ backgroundColor: accent, borderColor: accent, color: '#fff' }}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              <span className="text-[13px] font-bold uppercase tracking-wide" style={{ fontFamily: PRINT_SERIF }}>
                {busy ? 'Sending…' : 'Send the request'}
              </span>
            </button>
          </div>
        )}

        <CrisisLine muted={t.textMuted} bright={t.textBright} className="mt-auto" />
      </div>
    </div>
  );
}
