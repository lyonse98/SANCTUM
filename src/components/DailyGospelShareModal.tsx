import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Download, Share2, BookOpen, Sparkles, Target } from 'lucide-react';
import {
  CARD_WIDTH,
  STYLE_LABELS,
  cardFilename,
  downloadDataUrl,
  paintCardBackdrop,
  shareDataUrl,
  wrapText,
  type CardStyle,
} from '@/lib/shareCard';
import type { KeyVerse } from '@/lib/keyVerse';
import type { Reflection } from '@/lib/reflection';
import type { PersonaTheme } from '@/types';

interface DailyGospelShareModalProps {
  open: boolean;
  t: PersonaTheme;
  season?: string | null;
  celebration?: string | null;
  keyVerse: KeyVerse | null;
  reflection: Reflection | null;
  onClose: () => void;
}

/** Wraps a paragraph and returns the lines plus the total pixel height. */
function measure(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  maxWidth: number,
  lineHeight: number,
): { lines: string[]; height: number } {
  ctx.font = font;
  const lines = wrapText(ctx, text, maxWidth);
  return { lines, height: lines.length * lineHeight };
}

function drawParagraph(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  centerX: number,
  startY: number,
  lineHeight: number,
): void {
  lines.forEach((line, i) => ctx.fillText(line, centerX, startY + i * lineHeight));
}

function drawCard(
  canvas: HTMLCanvasElement,
  options: {
    t: PersonaTheme;
    style: CardStyle;
    season?: string | null;
    celebration?: string | null;
    keyVerse: KeyVerse | null;
    reflection: Reflection | null;
  },
): string {
  const { t, style, season, celebration, keyVerse, reflection } = options;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const W = CARD_WIDTH;
  const PAD = 110;
  const contentWidth = W - PAD * 2;

  const verseFont = `400 46px Georgia, "Times New Roman", serif`;
  const verseLineHeight = 66;
  const bodyFont = '400 30px Georgia, "Times New Roman", serif';
  const bodyLineHeight = 44;

  const verseText = keyVerse?.text ?? '';
  const verse = measure(ctx, verseText, verseFont, contentWidth, verseLineHeight);
  const reflect = measure(ctx, reflection?.reflect ?? '', bodyFont, contentWidth, bodyLineHeight);
  const challenge = measure(ctx, reflection?.challenge ?? '', bodyFont, contentWidth, bodyLineHeight);

  const startY = 300;
  const verseBlock = verse.height + (keyVerse?.citation ? 54 : 0);
  const sectionGap = 52;
  const reflectBlock = 34 + reflect.height;
  const challengeBlock = 34 + challenge.height;
  const endY = startY + verseBlock + sectionGap + reflectBlock + sectionGap + challengeBlock + 200;

  canvas.width = W;
  canvas.height = Math.max(W, Math.round(endY));

  paintCardBackdrop(ctx, W, canvas.height, t, style);

  // ── Header ──
  const headerY = 150;
  if (style === 'scripture' || style === 'ember') {
    ctx.fillStyle = t.accent;
    ctx.fillRect(W / 2 - 30, headerY - 52, 60, 3);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = t.accent;
  ctx.font = '600 24px system-ui, -apple-system, sans-serif';
  ctx.fillText('DAILY GOSPEL', W / 2, headerY);

  ctx.fillStyle = t.textDim;
  ctx.font = '400 22px system-ui, -apple-system, sans-serif';
  const subtitle = [season, celebration].filter(Boolean).join(' \u00b7 ') || 'The Word for today';
  ctx.fillText(subtitle, W / 2, headerY + 34);

  // ── Key verse ──
  if (verseText) {
    ctx.fillStyle = t.accentRgba(0.15);
    ctx.font = '400 120px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('\u201C', PAD - 40, startY - 6);

    ctx.textAlign = 'center';
    ctx.fillStyle = t.textBright;
    ctx.font = verseFont;
    drawParagraph(ctx, verse.lines, W / 2, startY, verseLineHeight);

    if (keyVerse?.citation) {
      ctx.fillStyle = t.accent;
      ctx.font = 'italic 600 26px Georgia, serif';
      ctx.fillText(`\u2014 ${keyVerse.citation}`, W / 2, startY + verse.height + 30);
    }
  }

  // ── Reflect ──
  let y = startY + verseBlock + sectionGap;
  if (reflection?.reflect) {
    ctx.textAlign = 'center';
    ctx.fillStyle = t.accent;
    ctx.font = '600 20px system-ui, -apple-system, sans-serif';
    ctx.fillText('REFLECT', W / 2, y);
    y += 34;

    ctx.fillStyle = t.textMuted;
    ctx.font = bodyFont;
    drawParagraph(ctx, reflect.lines, W / 2, y, bodyLineHeight);
    y += reflect.height + sectionGap;
  }

  // ── Challenge ──
  if (reflection?.challenge) {
    ctx.textAlign = 'center';
    ctx.fillStyle = t.accent;
    ctx.font = '600 20px system-ui, -apple-system, sans-serif';
    ctx.fillText('CHALLENGE', W / 2, y);
    y += 34;

    ctx.fillStyle = t.textBright;
    ctx.font = bodyFont;
    drawParagraph(ctx, challenge.lines, W / 2, y, bodyLineHeight);
  }

  // ── Footer ──
  const bottomY = canvas.height - 130;
  ctx.strokeStyle = style === 'scripture' ? `${t.accent}44` : t.borderLight;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 60, bottomY);
  ctx.lineTo(W / 2 + 60, bottomY);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = t.textMuted;
  ctx.font = 'italic 400 22px Georgia, serif';
  ctx.fillText(reflection?.facet ?? 'A word for the road', W / 2, bottomY + 46);

  ctx.textAlign = 'right';
  ctx.fillStyle = t.textDim;
  ctx.font = '600 18px system-ui, -apple-system, sans-serif';
  ctx.fillText('SANCTUM', W - 70, bottomY + 46);

  ctx.textAlign = 'left';
  ctx.fillStyle = t.accent;
  ctx.font = '400 16px system-ui, sans-serif';
  ctx.fillText('\u2719', 70, bottomY + 46);

  return canvas.toDataURL('image/png');
}

export function DailyGospelShareModal({
  open,
  t,
  season,
  celebration,
  keyVerse,
  reflection,
  onClose,
}: DailyGospelShareModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState('');
  const [style, setStyle] = useState<CardStyle>('scripture');

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = drawCard(canvas, { t, style, season, celebration, keyVerse, reflection });
    if (url) setDataUrl(url);
  }, [t, style, season, celebration, keyVerse, reflection]);

  useEffect(() => {
    if (open) draw();
  }, [open, draw]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const shareText = useMemo(() => {
    const parts: string[] = [];
    if (keyVerse) parts.push(`"${keyVerse.text}" \u2014 ${keyVerse.citation}`);
    if (reflection) parts.push(`Challenge: ${reflection.challenge}`);
    return parts.join('\n\n');
  }, [keyVerse, reflection]);

  if (!open) return null;

  const filename = cardFilename('daily-gospel');

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
            <BookOpen className="w-4 h-4" style={{ color: t.accent }} />
            <h3 className="text-sm font-semibold" style={{ color: t.textBright }}>
              Share today&rsquo;s Gospel
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
          <canvas ref={canvasRef} className="w-full rounded-lg" style={{ display: 'block' }} />

          {keyVerse && (
            <p className="text-[10px] uppercase tracking-widest font-bold mt-3 text-center" style={{ color: t.textDim }}>
              {keyVerse.citation}
              {reflection?.facet ? ` \u00b7 ${reflection.facet}` : ''}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            <span
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: t.accentRgba(0.12), color: t.accent }}
            >
              <BookOpen className="w-2.5 h-2.5" /> Verse
            </span>
            <span
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: t.accentRgba(0.12), color: t.accent }}
            >
              <Sparkles className="w-2.5 h-2.5" /> Reflect
            </span>
            <span
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: t.accentRgba(0.12), color: t.accent }}
            >
              <Target className="w-2.5 h-2.5" /> Challenge
            </span>
          </div>

          <div className="flex gap-1.5 mt-3">
            {(Object.keys(STYLE_LABELS) as CardStyle[]).map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all border"
                style={
                  style === s
                    ? { backgroundColor: t.accentRgba(0.12), color: t.accent, borderColor: t.accentRgba(0.3) }
                    : { backgroundColor: `${t.border}40`, color: t.textDim, borderColor: `${t.border}66` }
                }
              >
                {STYLE_LABELS[s]}
              </button>
            ))}
          </div>

          <p className="text-[11px] mt-3 text-center leading-relaxed" style={{ color: t.textDim }}>
            Scripture from the public-domain World English Bible. Share the verse, the reflection, and the challenge.
          </p>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => downloadDataUrl(dataUrl, filename)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium border transition-colors"
              style={{ backgroundColor: t.cardHover, borderColor: t.borderLight, color: t.text }}
            >
              <Download className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={() => void shareDataUrl(dataUrl, filename, 'Sanctum \u2014 Daily Gospel', shareText)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-opacity"
              style={{ backgroundColor: t.accent, color: '#fff' }}
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
