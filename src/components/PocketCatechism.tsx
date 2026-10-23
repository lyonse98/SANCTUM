import { useState } from 'react';
import { BookOpen, Shield, Heart, Hand, ChevronRight, Quote, Users, Swords, ShieldAlert, Sparkles } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import { CatechismQA } from '@/components/CatechismQA';
import {
  PILLARS,
  CATECHISM,
  OBJECTIONS,
  type CatechismEntry,
  type ObjectionEntry,
  type PillarId,
} from '@/data/catechism';

const PILLAR_ICONS: Record<PillarId, typeof BookOpen> = {
  creed: BookOpen,
  sacraments: Heart,
  commandments: Shield,
  prayer: Hand,
  anthropology: Users,
};

interface PocketCatechismProps {
  t: PersonaTheme;
}

export function PocketCatechism({ t }: PocketCatechismProps) {
  const [mode, setMode] = useState<'pillars' | 'objections' | 'ask'>('pillars');
  const [activePillar, setActivePillar] = useState<PillarId>('creed');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const entries = mode === 'pillars' ? CATECHISM[activePillar] : OBJECTIONS;

  const modeBtn = (id: typeof mode, label: string) => (
    <button
      onClick={() => { setMode(id); setExpandedId(null); }}
      className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-[11px] font-bold transition-all border whitespace-nowrap"
      style={
        mode === id
          ? { backgroundColor: t.accentRgba(0.15), color: t.accent, borderColor: t.accentRgba(0.4) }
          : { backgroundColor: `${t.border}40`, color: t.textDim, borderColor: `${t.border}66` }
      }
    >
      {id === 'ask' && <Sparkles className="w-3 h-3" />}
      {label}
    </button>
  );

  return (
    <div className="rounded-xl p-4 border" style={{ backgroundColor: t.card, borderColor: `${t.border}66` }}>
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4" style={{ color: t.accent }} />
        <h3 className="text-sm font-bold font-display uppercase tracking-wide" style={{ color: t.textBright }}>
          Catechism
        </h3>
      </div>

      <p className="text-[11px] leading-relaxed mb-3" style={{ color: t.textDim }}>
        The faith in plain language — or ask your own question.
      </p>

      {/* Mode toggle */}
      <div className="flex gap-1.5 mb-3">
        {modeBtn('pillars', 'The Faith')}
        {modeBtn('objections', 'Objections')}
        {modeBtn('ask', 'Ask')}
      </div>

      {mode === 'ask' ? (
        <CatechismQA t={t} />
      ) : (
        <>
          {/* Pillar tabs */}
          {mode === 'pillars' && (
            <div className="flex gap-1 mb-3 overflow-x-auto scrollbar-hide">
              {PILLARS.map((p) => {
                const Icon = PILLAR_ICONS[p.id];
                return (
                  <button
                    key={p.id}
                    onClick={() => { setActivePillar(p.id); setExpandedId(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border"
                    style={
                      activePillar === p.id
                        ? { backgroundColor: t.accentRgba(0.12), color: t.accent, borderColor: t.accentRgba(0.3) }
                        : { backgroundColor: `${t.border}40`, color: t.textDim, borderColor: `${t.border}66` }
                    }
                  >
                    <Icon className="w-3 h-3" />
                    {p.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Entries */}
          <div className="space-y-2">
            {mode === 'pillars' &&
              (entries as CatechismEntry[]).map((entry) => (
                <CatechismCard
                  key={entry.id}
                  entry={entry}
                  expanded={expandedId === entry.id}
                  onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  t={t}
                />
              ))}

            {mode === 'objections' &&
              (entries as ObjectionEntry[]).map((entry) => (
                <ObjectionCard
                  key={entry.id}
                  entry={entry}
                  expanded={expandedId === entry.id}
                  onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  t={t}
                />
              ))}
          </div>

          {mode === 'objections' && (
            <p className="text-[10px] text-center mt-3 leading-relaxed" style={{ color: t.textDim }}>
              These are starting points, not the whole argument. When someone asks, listen first — then give what serves.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function CatechismCard({
  entry,
  expanded,
  onToggle,
  t,
}: {
  entry: CatechismEntry;
  expanded: boolean;
  onToggle: () => void;
  t: PersonaTheme;
}) {
  return (
    <div
      className="rounded-lg border transition-all cursor-pointer"
      style={{
        backgroundColor: expanded ? t.accentRgba(0.05) : `${t.border}40`,
        borderColor: expanded ? t.accentRgba(0.2) : `${t.border}66`,
      }}
      onClick={onToggle}
    >
      <div className="flex items-start gap-2 px-3 py-2.5">
        <ChevronRight
          className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 transition-transform"
          style={{ color: t.accent, transform: expanded ? 'rotate(90deg)' : 'none' }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-snug" style={{ color: expanded ? t.textBright : t.text }}>
            {entry.question}
          </p>
          {expanded && (
            <div className="mt-2 space-y-2.5 animate-fade-in">
              <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>{entry.answer}</p>

              <div className="flex items-start gap-1.5 pt-1">
                <Quote className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: t.accent }} />
                <p className="text-[11px] italic leading-relaxed" style={{ color: t.text }}>{entry.scripture}</p>
              </div>

              <div className="pt-1 border-t" style={{ borderColor: `${t.border}80` }}>
                <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: t.accent }}>Tradition</p>
                <p className="text-[11px] leading-relaxed" style={{ color: t.textDim }}>{entry.tradition}</p>
              </div>

              <div
                className="pt-2 border-t rounded-md p-2"
                style={{ borderColor: 'rgba(185,28,28,0.2)', backgroundColor: 'rgba(153,27,27,0.06)' }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Swords className="w-3 h-3 flex-shrink-0" style={{ color: '#B91C1C' }} />
                  <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#991B1B' }}>The Objection</p>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: t.textMuted }}>{entry.opposingView}</p>
              </div>

              <div
                className="pt-2 border-t rounded-md p-2"
                style={{ borderColor: `${t.accentRgba(0.2)}`, backgroundColor: t.accentRgba(0.05) }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <ShieldAlert className="w-3 h-3 flex-shrink-0" style={{ color: t.accent }} />
                  <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: t.accent }}>The Defense</p>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: t.textMuted }}>{entry.defense}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ObjectionCard({
  entry,
  expanded,
  onToggle,
  t,
}: {
  entry: ObjectionEntry;
  expanded: boolean;
  onToggle: () => void;
  t: PersonaTheme;
}) {
  return (
    <div
      className="rounded-lg border transition-all cursor-pointer"
      style={{
        backgroundColor: expanded ? t.accentRgba(0.05) : `${t.border}40`,
        borderColor: expanded ? t.accentRgba(0.2) : `${t.border}66`,
      }}
      onClick={onToggle}
    >
      <div className="flex items-start gap-2 px-3 py-2.5">
        <ChevronRight
          className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 transition-transform"
          style={{ color: t.accent, transform: expanded ? 'rotate(90deg)' : 'none' }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-snug" style={{ color: expanded ? t.textBright : t.text }}>
            {entry.question}
          </p>
          {expanded && (
            <div className="mt-2 space-y-2.5 animate-fade-in">
              <p className="text-xs leading-relaxed font-medium" style={{ color: t.textBright }}>{entry.shortAnswer}</p>

              <div className="flex items-start gap-1.5 pt-1">
                <Quote className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: t.accent }} />
                <p className="text-[11px] italic leading-relaxed" style={{ color: t.text }}>{entry.scripture}</p>
              </div>

              <div className="pt-1">
                <p className="text-[11px] leading-relaxed" style={{ color: t.textMuted }}>{entry.tradition}</p>
              </div>

              <div className="pt-2 border-t" style={{ borderColor: `${t.border}80` }}>
                <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: t.accent }}>Go Deeper</p>
                <p className="text-[11px] leading-relaxed" style={{ color: t.textDim }}>{entry.deeper}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
