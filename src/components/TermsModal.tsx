import { useState } from 'react';
import { Scroll, Heart, HandHeart } from 'lucide-react';
import { PRIVACY_PARAGRAPH } from '@/lib/privacyCopy';

const STORAGE_KEY = 'sanctum_terms_accepted';

export function hasAcceptedTerms(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

interface TermsModalProps {
  onAccept: () => void;
}

export function TermsModal({ onAccept }: TermsModalProps) {
  const [checking, setChecking] = useState(false);

  const handleAccept = () => {
    setChecking(true);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl border animate-slide-up max-h-[85vh] overflow-y-auto chat-scroll"
        style={{ backgroundColor: '#FBF8F3', borderColor: '#DCD3C5' }}
      >
        <div className="px-6 pt-7 pb-2 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg border"
            style={{ backgroundColor: '#F3EEE7', borderColor: '#DCD3C5' }}
          >
            <HandHeart className="w-7 h-7" style={{ color: '#C2410C' }} />
          </div>
          <h2 className="text-lg font-bold font-display uppercase tracking-wide mb-1.5" style={{ color: '#1B1815' }}>
            Welcome, Brother
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: '#635C51' }}>
            You're stepping into a quiet space. A few things to know before you enter.
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg p-3.5 border" style={{ backgroundColor: '#F3EEE7', borderColor: '#DCD3C5' }}>
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

          <div className="rounded-lg p-3.5 border" style={{ backgroundColor: '#F3EEE7', borderColor: '#DCD3C5' }}>
            <div className="flex items-start gap-2.5">
              <Heart className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
              <p className="text-[11px] leading-relaxed" style={{ color: '#4A443C' }}>
                If you are in crisis or considering self-harm, this app is not a substitute for professional
                help. Call or text <span className="font-bold" style={{ color: '#B91C1C' }}>988</span> (US) or visit
                findahelpline.com for international support.
              </p>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-center" style={{ color: '#756D61' }}>
{PRIVACY_PARAGRAPH}
          </p>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={handleAccept}
            disabled={checking}
            className="w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
            style={{ backgroundColor: '#4A6B4A', color: '#ffffff' }}
          >
            Enter Sanctum
          </button>
        </div>
      </div>
    </div>
  );
}
