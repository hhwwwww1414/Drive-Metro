'use client';
import { DataBundle } from '@/lib/types';
import type { RouteSegment } from '@/lib/router';
import { distance } from '@/lib/geometry';
import { useMemo } from 'react';

export type SearchResults = {
  exact: RouteSegment[][];
  geo: RouteSegment[][];
  bfs: RouteSegment[][];
};

export type SelectedRoute = { type: keyof SearchResults; idx: number } | null;

type Props = {
  results: SearchResults;
  bundle: DataBundle;
  selected: SelectedRoute;
  onShow: (type: keyof SearchResults, idx: number) => void;
  onPin: (type: keyof SearchResults, idx: number) => void;
};

function useCityIndex(bundle: DataBundle) {
  return useMemo(() => {
    const m: Record<string, { x: number; y: number; label?: string }> = {};
    for (const c of bundle.cities) m[c.city_id] = c;
    return m;
  }, [bundle.cities]);
}

type Item = ReturnType<typeof buildItem>;

function RouteCard({
  item,
  active,
  onShow,
  onPin,
}: {
  item: Item;
  active: boolean;
  onShow: () => void;
  onPin: () => void;
}) {
  return (
    <div
      className="rounded-xl border p-2 mb-2"
      style={{ borderColor: active ? '#E4002B' : 'var(--btn-border)' }}
    >
      <div className="text-sm font-semibold mb-1">
        {item.start} → {item.end}
      </div>
      <div className="text-xs text-gray-600 mb-2 flex gap-2 flex-wrap">
        <span>{item.dist} км</span>
        <span>пересадок: {item.transfers}</span>
      </div>
      <div className="flex gap-2">
        <button className="text-xs map-btn" onClick={onShow}>
          Показать путь
        </button>
        <button className="text-xs map-btn" onClick={onPin}>
          Закрепить
        </button>
      </div>
    </div>
  );
}

function buildItem(
  route: RouteSegment[],
  cityIndex: Record<string, { x: number; y: number; label?: string }>
) {
  let d = 0;
  for (const seg of route) {
    if (seg.transfer) continue;
    const a = cityIndex[seg.from];
    const b = cityIndex[seg.to];
    if (a && b) d += distance(a, b);
  }
  const transfers = route.filter((s) => s.transfer).length;
  const start = cityIndex[route[0].from]?.label || route[0].from;
  const end =
    cityIndex[route[route.length - 1].to]?.label ||
    route[route.length - 1].to;
  return { route, dist: Math.round(d), transfers, start, end };
}

export default function SearchResults({
  results,
  bundle,
  selected,
  onShow,
  onPin,
}: Props) {
  const cityIndex = useCityIndex(bundle);

  const columns: { key: keyof SearchResults; title: string }[] = [
    { key: 'exact', title: 'Точный поиск' },
    { key: 'geo', title: 'Геозона' },
    { key: 'bfs', title: 'BFS' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        display: 'flex',
        gap: 8,
        zIndex: 4,
        fontFamily: 'Inter, system-ui, sans-serif',
        color: 'var(--text)',
      }}
    >
      {columns.map((col) => {
        const items = results[col.key].map((r) => buildItem(r, cityIndex));
        return (
          <div key={col.key} style={{ width: 240, maxHeight: 360, overflowY: 'auto' }}>
            <div className="font-semibold mb-2">{col.title}</div>
            {items.map((item, idx) => (
              <RouteCard
                key={idx}
                item={item}
                active={
                  selected?.type === col.key && selected.idx === idx
                }
                onShow={() => onShow(col.key, idx)}
                onPin={() => onPin(col.key, idx)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
