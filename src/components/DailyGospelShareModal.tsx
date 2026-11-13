import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Download, Share2, BookOpen } from 'lucide-react';
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
import {
  buildSharePieces,
  cardTextPlan,
  type SharePiece,
  type SharePieceId,
} from '@/lib/sharePieces';
import { readTailorShare } from '@/lib/tailorShare';
import type { KeyVerse } from '@/lib/keyVerse';
import type { Reflection } from '@/lib/reflection';
import type { Audience, PersonaTheme } from '@/types';

interface DailyGospelShareModalProps {
  open: boolean;
  t: PersonaTheme;
  season?: string | null;
  celebration?: string | null;
  keyVerse: KeyVerse | null;
  reflection: Reflection | null;
  /** The day on screen — keys the on-device tailored pieces for this date/track. */
  dateKey?: string | null;
  audience: Audience;
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

/** Type sizes per piece — one text, generously set; Scripture largest. */
const PIECE_FONT_SIZE: Record<SharePieceId, number> = {
  verse: 48,
  passage: 42,
  tradition: 38,
  reflection: 38,
  challenge: 38,
};

/** Pieces that open with the big decorative quote mark. */
const QUOTED_PIECES: SharePieceId[] = ['verse', 'passage', 'tradition'];

/**
 * Draws ONE piece on its own card: the DAILY GOSPEL header, the season /
 * celebration line, the piece's label, its text, and its attribution. The
 * words come from cardTextPlan and from nowhere else — a card can never
 * carry another piece's text.
 */
function drawCard(
  canvas: HTMLCanvasElement,
  options: {
    t: PersonaTheme;
    style: CardStyle;
    season?: string | null;
    celebration?: string | null;
    facet?: string | null;
    piece: SharePiece;
  },
): string {
  const { t, style, season, celebration, facet, piece } = options;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const plan = cardTextPlan(piece, { season, celebration, facet });

  const W = CARD_WIDTH;
  const PAD = 110;
  const contentWidth = W - PAD * 2;

  const fontSize = PIECE_FONT_SIZE[piece.id];
  const font = `${piece.id === 'tradition' ? 'italic ' : ''}400 ${fontSize}px Georgia, "Times New Roman", serif`;
  const lineHeight = Math.round(fontSize * 1.42);
  const body = measure(ctx, plan.text, font, contentWidth, lineHeight);

  const headerY = 150;
  const labelY = 300;
  const textY = labelY + 64;
  const attributionGap = plan.attribution ? 88 : 36;
  const endY = textY + body.height + attributionGap + 190;

  canvas.width = W;
  canvas.height = Math.max(880, Math.round(endY));

  paintCardBackdrop(ctx, W, canvas.height, t, style);

  // ── Header ──
  if (style === 'scripture' || style === 'ember') {
    ctx.fillStyle = t.accent;
    ctx.fillRect(W / 2 - 30, headerY - 52, 60, 3);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = t.accent;
  ctx.font = '600 24px system-ui, -apple-system, sans-serif';
  ctx.fillText(plan.header, W / 2, headerY);

  ctx.fillStyle = t.textDim;
  ctx.font = '400 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(plan.subtitle, W / 2, headerY + 34);

  // ── The piece ──
  ctx.fillStyle = t.accent;
  ctx.font = '600 20px system-ui, -apple-system, sans-serif';
  ctx.fillText(plan.label, W / 2, labelY);

  if (QUOTED_PIECES.includes(piece.id)) {
    ctx.fillStyle = t.accentRgba(0.15);
    ctx.font = '400 120px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('\u201C', PAD - 40, textY - 6);
    ctx.textAlign = 'center';
  }

  ctx.fillStyle = t.textBright;
  ctx.font = font;
  drawParagraph(ctx, body.lines, W / 2, textY, lineHeight);

  if (plan.attribution) {
    ctx.fillStyle = t.accent;
    ctx.font = 'italic 600 26px Georgia, serif';
    ctx.fillText(plan.attribution, W / 2, textY + body.height + 44);
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
  ctx.fillText(plan.footer, W / 2, bottomY + 46);

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

const FOOTNOTES: Record<SharePieceId, string> = {
  verse: 'Scripture from the public-domain World English Bible.',
  reflection: 'One line from today\u2019s reflection, chosen to stand on its own.',
  challenge: 'Today\u2019s challenge, standing alone \u2014 the one to send a brother or sister.',
  passage: 'From your tailored devotional this morning \u00b7 Douay-Rheims.',
  tradition: 'From your tailored devotional this morning.',
};

export function DailyGospelShareModal({
  open,
  t,
  season,
  celebration,
  keyVerse,
  reflection,
  dateKey,
  audience,
  onClose,
}: DailyGospelShareModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState('');
  const [style, setStyle] = useState<CardStyle>('scripture');
  const [selectedId, setSelectedId] = useState<SharePieceId>('verse');

  // The tailored pieces live on-device, keyed to this date and track — read
  // them fresh each time the shelf opens.
  const tailorShare = useMemo(
    () => (open && dateKey ? readTailorShare(dateKey, audience) : null),
    [open, dateKey, audience],
  );

  const pieces = useMemo(
    () => buildSharePieces({ keyVerse, reflection, tailorShare }),
    [keyVerse, reflection, tailorShare],
  );

  const selected = pieces.find((p) => p.id === selectedId) ?? pieces[0] ?? null;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selected) return;
    const url = drawCard(canvas, {
      t,
      style,
      season,
      celebration,
      facet: reflection?.facet,
      piece: selected,
    });
    if (url) setDataUrl(url);
  }, [t, style, season, celebration, reflection, selected]);

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
    if (!selected) return '';
    return selected.attribution ? `"${selected.text}" ${selected.attribution}` : selected.text;
  }, [selected]);

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
          {/* The choice that matters comes first: WHICH piece of today to send. */}
          <p
            className="text-[10px] uppercase tracking-widest font-bold mb-2"
            style={{ color: t.textDim }}
          >
            What would you like to share?
          </p>
          <div className="space-y-2" role="radiogroup" aria-label="Shareable pieces">
            {pieces.map((piece) => {
              const isSelected = selected?.id === piece.id;
              return (
                <button
                  key={piece.id}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedId(piece.id)}
                  className="w-full text-left rounded-xl border px-3.5 py-3 transition-all active:scale-[0.99]"
                  style={
                    isSelected
                      ? { borderColor: t.accent, backgroundColor: t.accentRgba(0.08) }
                      : { borderColor: `${t.border}99`, backgroundColor: `${t.border}26` }
                  }
                >
                  <span
                    className="block text-[10px] uppercase tracking-widest font-bold mb-1"
                    style={{ color: isSelected ? t.accent : t.textDim }}
                  >
                    {piece.pickerLabel}
                  </span>
                  <span className="block text-xs leading-relaxed" style={{ color: t.text }}>
                    {piece.text}
                    {piece.attribution && (
                      <span style={{ color: t.textDim }}> — {piece.attribution}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {pieces.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: t.textDim }}>
              Nothing to share yet today — the day is still loading.
            </p>
          )}

          {selected && (
            <>
              <canvas ref={canvasRef} className="w-full rounded-lg mt-4" style={{ display: 'block' }} />

              {/* Style is the second choice — the same piece, a different dress. */}
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
                {FOOTNOTES[selected.id]}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
