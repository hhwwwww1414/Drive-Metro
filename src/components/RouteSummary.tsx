'use client';
import { useMemo } from 'react';
import type { RouteSegment } from '@/lib/router';
import type { DataBundle } from '@/lib/types';

type Props = {
  route: RouteSegment[];
  bundle: DataBundle;
};

export default function RouteSummary({ route, bundle }: Props) {
  const cityIndex = useMemo(() => {
    const idx: Record<string, string> = {};
    for (const c of bundle.cities) idx[c.city_id] = c.label || c.city_id;
    return idx;
  }, [bundle.cities]);

  if (route.length === 0) return null;

  const cities: string[] = [];
  cities.push(cityIndex[route[0].from] ?? route[0].from);
  for (const seg of route) {
    const name = cityIndex[seg.to] ?? seg.to;
    if (cities[cities.length - 1] !== name) cities.push(name);
  }

  const lines: string[] = [];
  let prevLine: string | null = null;
  for (const seg of route) {
    if (seg.transfer) continue;
    if (seg.line.line_id !== prevLine) {
      lines.push(seg.line.name);
      prevLine = seg.line.line_id;
    }
  }

  const transfers = route.filter((s) => s.transfer).length;
  const legs = route.filter((s) => !s.transfer).length;

  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        padding: 12,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        zIndex: 4,
        fontFamily: 'Inter, system-ui, sans-serif',
        maxWidth: 320,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Сводка маршрута</div>
      <div style={{ fontSize: 13, marginBottom: 6 }}>
        Города: {cities.join(' → ')}
      </div>
      <div style={{ fontSize: 13, marginBottom: 6 }}>
        Линии: {lines.join(', ')}
      </div>
      <div style={{ fontSize: 13 }}>
        Пересадок: {transfers}, плеч: {legs}
      </div>
    </div>
  );
}

