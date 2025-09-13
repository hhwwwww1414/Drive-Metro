'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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

  const routeDistance = useCallback(
    (route: RouteSegment[]) => {
      let d = 0;
      for (const seg of route) {
        if (seg.transfer) continue;
        const a = cityIndex[seg.from];
        const b = cityIndex[seg.to];
        if (a && b) d += distance(a, b);
      }
      return Math.round(d);
    },
    [cityIndex]
  );

  const routeLines = useCallback((route: RouteSegment[]) => {
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
  }, []);

  const [sortBy, setSortBy] = useState<'distance' | 'transfers'>('distance');
  const [corridor, setCorridor] = useState<string>('all');

  const items = useMemo(() => {
    return routes.map((r, idx) => {
      const lines = routeLines(r);
      const dist = routeDistance(r);
      const transfers = r.filter((s) => s.transfer).length;
      const corridors = new Set(lines.map((l) => l.corridor_id));
      const start = cityIndex[r[0].from]?.label || r[0].from;
      const end = cityIndex[r[r.length - 1].to]?.label || r[r.length - 1].to;
      return { idx, route: r, lines, dist, transfers, corridors, start, end };
    });
  }, [routes, cityIndex, routeLines, routeDistance]);

  const filtered = useMemo(() => {
    if (corridor === 'all') return items;
    return items.filter((i) => i.corridors.has(corridor));
  }, [items, corridor]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      sortBy === 'distance' ? a.dist - b.dist : a.transfers - b.transfers
    );
  }, [filtered, sortBy]);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 5,
  });

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
      <div style={{ display: 'flex', gap: 8 }}>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'distance' | 'transfers')}
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="distance">По расстоянию</option>
          <option value="transfers">По пересадкам</option>
        </select>
        <select
          value={corridor}
          onChange={(e) => setCorridor(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="all">Все коридоры</option>
          {bundle.corridors.map((c) => (
            <option key={c.corridor_id} value={c.corridor_id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div ref={parentRef} style={{ overflowY: 'auto', maxHeight: 300 }}>
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = sorted[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: 8,
                }}
              >
                <button
                  onClick={() => onSelect(item.idx)}
                  onMouseEnter={() => onSelect(item.idx)}
                  className="w-full text-left rounded-xl hover:bg-gray-100 flex flex-col gap-1.5"
                  style={{
                    padding: '10px 12px',
                    border:
                      selected === item.idx
                        ? '2px solid #E4002B'
                        : '1px solid var(--btn-border)',
                    background: 'var(--frame-bg)',
                    cursor: 'pointer',
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
                    <span style={{ color: '#6b7280' }}>
                      {virtualRow.index + 1}.
                    </span>
                    {item.start} → {item.end}
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
                    {item.lines.map((l, j) => (
                      <span
                        key={l.line_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
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
                        {j < item.lines.length - 1 && (
                          <span style={{ color: '#6b7280' }}>→</span>
                        )}
                      </span>
                    ))}
                    <span style={{ marginLeft: 'auto', color: '#6b7280' }}>
                      {item.dist} км
                    </span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
