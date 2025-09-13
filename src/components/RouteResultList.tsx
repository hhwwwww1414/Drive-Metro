'use client';
import { useMemo } from 'react';
import type { DataBundle } from '@/lib/types';
import type { RouteSegment } from '@/lib/router';
import { distance } from '@/lib/geometry';

type Props = {
  routes: RouteSegment[][];
  bundle: DataBundle;
  selected: number | null;
  onSelect: (idx: number) => void;
};

export default function RouteResultList({ routes, bundle, selected, onSelect }: Props) {
  const cityIndex = useMemo(() => {
    const m: Record<string, { x: number; y: number; label?: string }> = {};
    for (const c of bundle.cities) m[c.city_id] = c;
    return m;
  }, [bundle.cities]);

  const routeDistance = (route: RouteSegment[]) => {
    let d = 0;
    for (const seg of route) {
      if (seg.transfer) continue;
      const a = cityIndex[seg.from];
      const b = cityIndex[seg.to];
      if (a && b) d += distance(a, b);
    }
    return Math.round(d);
  };

  const routeLines = (route: RouteSegment[]) => {
    const out: RouteSegment['line'][] = [];
    let prev: string | null = null;
    for (const seg of route) {
      if (seg.transfer) continue;
      if (seg.line.line_id !== prev) {
        out.push(seg.line);
        prev = seg.line.line_id;
      }
    }
    return out;
  };

  if (!routes.length) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
        maxWidth: 360,
        padding: 8,
        background: 'var(--frame-bg)',
        border: '1px solid var(--frame-border)',
        borderRadius: 12,
        zIndex: 4,
        fontFamily: 'Inter, system-ui, sans-serif',
        color: 'var(--text)',
      }}
    >
      {routes.map((r, idx) => {
        const lines = routeLines(r);
        const dist = routeDistance(r);
        const start = cityIndex[r[0].from]?.label || r[0].from;
        const end = cityIndex[r[r.length - 1].to]?.label || r[r.length - 1].to;
        return (
          <button
            key={idx}
            onClick={() => onSelect(idx)}
            style={{
              textAlign: 'left',
              padding: '10px 12px',
              borderRadius: 12,
              border: selected === idx ? '2px solid #E4002B' : '1px solid var(--btn-border)',
              background: 'var(--frame-bg)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span style={{ color: '#6b7280' }}>{idx + 1}.</span>
              {start} → {end}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                flexWrap: 'wrap',
                fontSize: 12,
              }}
            >
              {lines.map((l, j) => (
                <span
                  key={l.line_id}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <span
                    style={{
                      background: l.color,
                      color: '#fff',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >
                    {l.name}
                  </span>
                  {j < lines.length - 1 && (
                    <span style={{ color: '#6b7280' }}>→</span>
                  )}
                </span>
              ))}
              <span style={{ marginLeft: 'auto', color: '#6b7280' }}>{dist} км</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
