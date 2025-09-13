'use client';
import { useMemo, useState } from 'react';
import { DataBundle } from '@/lib/types';
import { findRoutes } from '@/lib/graph';
import type { RouteSegment } from '@/lib/router';
import { Combobox } from './ui/combobox';

type Props = {
  bundle: DataBundle;
  onRoute: (routes: RouteSegment[][]) => void;
};

export default function RouteSelector({ bundle, onRoute }: Props) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

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
    const routes = findRoutes(bundle, from, to);
    onRoute(routes);
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
      <button type="submit" className="map-btn" style={{ padding: '4px 8px' }}>
        Найти
      </button>
    </form>
  );
}

