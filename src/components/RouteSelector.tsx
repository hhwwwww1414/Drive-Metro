'use client';
import { useMemo, useState } from 'react';
import { DataBundle } from '@/lib/types';
import { findRoutes, findRoutesGeozone, findRoutesBFS } from '@/lib/graph';
import type { RouteSegment } from '@/lib/router';
import { Combobox } from './ui/combobox';

type SearchResults = {
  exact: RouteSegment[][];
  geo: RouteSegment[][];
  bfs: RouteSegment[][];
};

type Props = {
  bundle: DataBundle;
  onRoute: (res: SearchResults) => void;
};

export default function RouteSelector({ bundle, onRoute }: Props) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [maxTransfers, setMaxTransfers] = useState<number | 'any'>('any');

  const options = useMemo(
    () =>
      bundle.cities.map((c) => ({
        value: c.city_id,
        label: c.label || c.city_id,
      })),
    [bundle.cities]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to) return;
    const limit = maxTransfers === 'any' ? Infinity : Number(maxTransfers);
    const res: SearchResults = {
      exact: findRoutes(bundle, from, to).filter(
        (r) => r.filter((s) => s.transfer).length <= limit
      ),
      geo: findRoutesGeozone(bundle, from, to, limit),
      bfs: findRoutesBFS(bundle, from, to, limit),
    };
    onRoute(res);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        position: 'fixed',
        right: 12,
        top: 12,
        display: 'flex',
        gap: 8,
        padding: 8,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        zIndex: 4,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ width: 150 }}>
        <Combobox
          value={from}
          onChange={setFrom}
          options={options}
          placeholder="Откуда"
        />
      </div>
      <div style={{ width: 150 }}>
        <Combobox
          value={to}
          onChange={setTo}
          options={options}
          placeholder="Куда"
        />
      </div>
      <select
        value={maxTransfers}
        onChange={(e) =>
          setMaxTransfers(e.target.value === 'any' ? 'any' : Number(e.target.value))
        }
        className="rounded border px-2 py-1 text-sm"
      >
        <option value="any">Пересадки: любые</option>
        <option value={0}>Без пересадок</option>
        <option value={1}>До 1</option>
        <option value={2}>До 2</option>
      </select>
      <button type="submit" className="map-btn" style={{ padding: '4px 8px' }}>
        Найти
      </button>
    </form>
  );
}

