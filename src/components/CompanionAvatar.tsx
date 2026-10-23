import { useEffect, useState } from 'react';
import { PERSONAS } from '@/personas';
import type { PersonaId, PersonaTheme } from '@/types';

interface CompanionAvatarProps {
  personaId: PersonaId;
  theme: PersonaTheme;
  size?: number;
  animate?: boolean;
}

export function CompanionAvatar({ personaId, theme, size = 64, animate = false }: CompanionAvatarProps) {
  const [entered, setEntered] = useState(!animate);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!animate) return;
    setEntered(false);
    const timer = setTimeout(() => setEntered(true), 100);
    return () => clearTimeout(timer);
  }, [animate]);

  const persona = PERSONAS.find((p) => p.id === personaId);
  const portrait = persona?.portrait ?? '/joseph.webp';

  const scale = entered ? 1 : 0.6;
  const opacity = (entered && loaded) ? 1 : 0;

  return (
    <div
      className="relative flex-shrink-0 overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        transform: `scale(${scale})`,
        opacity,
        transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease-out',
        boxShadow: `inset 0 0 0 1.5px ${theme.accent}55`,
      }}
    >
      <img
        src={portrait}
        alt={persona?.name ?? 'Companion'}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className="w-full h-full object-cover"
        style={{ filter: 'contrast(1.08) saturate(0.92)' }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, ${theme.accentRgba(0.28)} 0%, transparent 60%)`,
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
}
