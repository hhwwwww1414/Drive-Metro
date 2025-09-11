'use client';
import { useState, useMemo } from 'react';
import { DataBundle } from '@/lib/types';
import { findRoutes } from '@/lib/graph';
import type { RouteSegment } from '@/lib/router';

type Props = {
  bundle: DataBundle;
  onRoute: (route: RouteSegment[]) => void;
};

export default function RoutePanel({ bundle, onRoute }: Props) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [routes, setRoutes] = useState<RouteSegment[][]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  const cityIndex = useMemo(() => {
    const idx: Record<string, string> = {};
    for (const c of bundle.cities) idx[c.city_id] = c.label || c.city_id;
    return idx;
  }, [bundle.cities]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to) return;
    const found = findRoutes(bundle, from, to);
    setRoutes(found);
    if (found[0]) {
      setSelected(0);
      onRoute(found[0]);
    }
  };

  const selectRoute = (idx: number) => {
    setSelected(idx);
    onRoute(routes[idx]);
  };

  const describe = (route: RouteSegment[]) => {
    const transfers = route.filter((s) => s.transfer).length;
    const legs = route.filter((s) => !s.transfer).length;
    const start = cityIndex[route[0].from] ?? route[0].from;
    const end = cityIndex[route[route.length - 1].to] ?? route[route.length - 1].to;
    return `${start} → ${end} · пересадок: ${transfers}, плеч: ${legs}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        top: 12,
        width: '100%',
        maxWidth: 360,
        padding: 12,
        background: '#1f2937',
        color: '#fff',
        borderRadius: 12,
        zIndex: 4,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <select
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 16,
            border: '1px solid #4b5563',
            borderRadius: 8,
            background: '#374151',
            color: '#fff',
          }}
        >
          <option value="">Откуда</option>
          {bundle.cities.map((c) => (
            <option key={c.city_id} value={c.city_id}>
              {c.label || c.city_id}
            </option>
          ))}
        </select>
        <select
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 16,
            border: '1px solid #4b5563',
            borderRadius: 8,
            background: '#374151',
            color: '#fff',
          }}
        >
          <option value="">Куда</option>
          {bundle.cities.map((c) => (
            <option key={c.city_id} value={c.city_id}>
              {c.label || c.city_id}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="map-btn"
          style={{
            width: '100%',
            height: 44,
            fontSize: 16,
            background: '#ffdd2d',
            color: '#1f2937',
            borderColor: '#ffdd2d',
            marginTop: 4,
          }}
        >
          Найти
        </button>
      </form>
      {routes.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {routes.map((r, idx) => (
            <button
              key={idx}
              onClick={() => selectRoute(idx)}
              style={{
                textAlign: 'left',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #4b5563',
                background: selected === idx ? '#3f3f46' : '#2d2d2d',
                color: '#fff',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {describe(r)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

