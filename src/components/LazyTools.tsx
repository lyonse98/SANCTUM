import { lazy, Suspense } from 'react';
import type { PersonaTheme } from '@/types';

const DrivewayReset = lazy(() =>
  import('@/components/DrivewayReset').then((m) => ({ default: m.DrivewayReset })),
);
const ColdStart = lazy(() =>
  import('@/components/ColdStart').then((m) => ({ default: m.ColdStart })),
);

function LazyFallback({ t }: { t: PersonaTheme }) {
  return (
    <div className="flex items-center justify-center py-8">
      <div
        className="w-5 h-5 rounded-full border-2 animate-spin"
        style={{ borderColor: `${t.accent}40`, borderTopColor: t.accent }}
      />
    </div>
  );
}

interface LazyDrivewayProps { t: PersonaTheme }
export function LazyDriveway({ t }: LazyDrivewayProps) {
  return (
    <Suspense fallback={<LazyFallback t={t} />}>
      <DrivewayReset t={t} />
    </Suspense>
  );
}

interface LazyColdStartProps { t: PersonaTheme }
export function LazyColdStart({ t }: LazyColdStartProps) {
  return (
    <Suspense fallback={<LazyFallback t={t} />}>
      <ColdStart t={t} />
    </Suspense>
  );
}
