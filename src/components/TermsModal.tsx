import { useState } from 'react';
import { Scroll, Heart, Lock, Zap } from 'lucide-react';
import { PRIVACY_PARAGRAPH } from '@/lib/privacyCopy';
import { PRINT_SERIF } from '@/lib/print';
import type { Audience } from '@/types';
import { MISSION_LINE, MISSION_ATTRIBUTION } from '@/lib/mission';

const STORAGE_KEY = 'sanctum_terms_accepted';

export function hasAcceptedTerms(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

interface TermsModalProps {
  /** The track chosen at the door — saved on-device by the app before entry. */
  onAccept: (audience: Audience) => void;
}

/**
 * The welcome gate, re-set as a book's title page (Stage 1 of the printed-
 * page re-skin, Erik, Nov 14, 2026): the name over a double rule, the Bloy
 * epigraph, the notices between hairlines, the one choice the door asks
 * for, and the two stamped chips as the imprint line at the foot. Every
 * word, state, and behaviour is the gate it has always been — only the
 * setting changed. The palette stays the pre-track house neutrals (see the
 * stray-colour allowlist): no day theme exists yet at the door.
 */
export function TermsModal({ onAccept }: TermsModalProps) {
  const [checking, setChecking] = useState(false);
  // No default: the door asks. (Installs from before the women's track carry a
  // stored terms acceptance and never see this gate again — they load as men's
  // and can switch in Settings.)
  const [choice, setChoice] = useState<Audience | null>(null);

  const handleAccept = () => {
    if (!choice) return;
    setChecking(true);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    onAccept(choice);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md rounded-[4px] border animate-slide-up max-h-[85vh] overflow-y-auto chat-scroll"
        style={{ backgroundColor: '#FBF8F3', borderColor: '#DCD3C5' }}
      >
        <div className="px-6 pt-8 pb-2 text-center">
          <p
            className="text-[30px] leading-none font-semibold uppercase"
            style={{ fontFamily: PRINT_SERIF, letterSpacing: '0.16em', color: '#1B1815' }}
          >
            Sanctum
          </p>
          <div aria-hidden="true" style={{ borderTop: '3px double #A39A8A', margin: '14px 42px 0' }} />
          <h2
            className="text-lg font-bold mt-5 mb-1.5"
            style={{ fontFamily: PRINT_SERIF, color: '#1B1815' }}
          >
            Welcome{choice === 'women' ? ', Sister' : choice === 'men' ? ', Brother' : ''}
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: '#635C51' }}>
            You're stepping into a quiet space. A few things to know before you enter.
          </p>
          {/* Why this place exists — the thesis, read once at the door. */}
          <p
            className="italic text-[13px] leading-snug mt-4"
            style={{ fontFamily: PRINT_SERIF, color: '#4A443C' }}
          >
            {MISSION_LINE}
          </p>
          <p className="text-[9px] uppercase tracking-[0.25em] mt-1" style={{ color: '#A39A8A' }}>
            {MISSION_ATTRIBUTION}
          </p>
        </div>

        <div className="px-6 py-4">
          <div style={{ borderTop: '1px solid #DCD3C5' }} className="pt-3.5 pb-1">
            <div className="flex items-start gap-2.5">
              <Scroll className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#C2410C' }} />
              <p className="text-[11px] leading-relaxed" style={{ color: '#4A443C' }}>
                Sanctum is an automated AI spiritual companion and habit tool designed for educational,
                reflective, and devotional purposes only. It is <span className="font-bold" style={{ color: '#1B1815' }}>NOT</span> a
                licensed mental health service, medical device, crisis intervention platform, or official
                Catholic sacrament (such as Sacramental Confession).
              </p>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #DCD3C5' }} className="pt-3.5 pb-1 mt-2">
            <div className="flex items-start gap-2.5">
              <Heart className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
              <p className="text-[11px] leading-relaxed" style={{ color: '#4A443C' }}>
                If you are in crisis or considering self-harm, this app is not a substitute for professional
                help. Call or text <span className="font-bold" style={{ color: '#B91C1C' }}>988</span> (US) or visit
                findahelpline.com for international support.
              </p>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-center mt-3" style={{ color: '#756D61' }}>
{PRIVACY_PARAGRAPH}
          </p>
        </div>

        <div className="px-6 pb-7">
          {/* The one choice the door asks for: which track of Sanctum is hers (or his).
              Same Gospel, same saints' wisdom — companions, reflections, and
              examinations written for the life actually being lived. */}
          <p className="text-[11px] leading-relaxed text-center mb-3" style={{ color: '#756D61' }}>
            Sanctum is kept in two tracks. Choose yours — you can change it later in Settings.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-3" role="radiogroup" aria-label="Choose your track">
            {([
              { id: 'men', label: 'For Men', sub: 'Brothers in the faith' },
              { id: 'women', label: 'For Women', sub: 'Sisters in the faith' },
            ] as const).map((opt) => {
              const selected = choice === opt.id;
              return (
                <button
                  key={opt.id}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setChoice(opt.id)}
                  className="py-3 px-2 rounded-md border transition-all active:scale-[0.98]"
                  style={{
                    backgroundColor: selected ? '#4A6B4A' : '#F3EEE7',
                    borderColor: selected ? '#4A6B4A' : '#DCD3C5',
                    color: selected ? '#ffffff' : '#4A443C',
                  }}
                >
                  <span className="block text-sm font-bold" style={{ fontFamily: PRINT_SERIF }}>{opt.label}</span>
                  <span className="block text-[10px] mt-0.5" style={{ color: selected ? '#E7E2D6' : '#A39A8A' }}>
                    {opt.sub}
                  </span>
                </button>
              );
            })}
          </div>
          {/* The brand statement's first home (Erik, Nov 14, 2026): the
              tagline and the two stamped chips live at this door and on the
              About page — nowhere else; Today carries none of it. On the
              title page the tagline follows the track chosen above, the way
              the greeting does, so it appears once a track is picked; the
              chips stand at the foot either way, as the imprint. */}
          {choice && (
            <p
              className="text-xs italic leading-relaxed text-center mb-3"
              style={{ fontFamily: PRINT_SERIF, color: '#635C51' }}
            >
              {choice === 'women'
                ? 'A private sanctuary for women seeking counsel, stillness, and strength'
                : 'A private sanctuary for men seeking counsel, stillness, and strength'}
            </p>
          )}
          <button
            onClick={handleAccept}
            disabled={checking || !choice}
            className="w-full py-3.5 rounded-md font-bold text-sm uppercase transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: '#4A6B4A', color: '#ffffff', fontFamily: PRINT_SERIF, letterSpacing: '0.14em' }}
          >
            Enter Sanctum
          </button>
          <div className="mt-5 pt-3" style={{ borderTop: '1px solid #DCD3C5' }}>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="text-[10px] stamped flex items-center gap-1" style={{ color: '#A39A8A' }}>
                <Lock className="w-3 h-3" /> Nothing You Write Is Stored
              </span>
              <span className="text-[10px]" style={{ color: '#A39A8A' }}>•</span>
              <span className="text-[10px] stamped flex items-center gap-1" style={{ color: '#A39A8A' }}>
                <Zap className="w-3 h-3" /> No Account Needed
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
