'use client';
import { useState } from 'react';
import { DataBundle } from '@/lib/types';
import { findRoutes } from '@/lib/graph';
import type { RouteSegment } from '@/lib/router';

type Props = {
  bundle: DataBundle;
  onRoute: (routes: RouteSegment[][]) => void;
};

export default function RouteSelector({ bundle, onRoute }: Props) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

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
      <select
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        style={{ padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4 }}
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
        style={{ padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4 }}
      >
        <option value="">Куда</option>
        {bundle.cities.map((c) => (
          <option key={c.city_id} value={c.city_id}>
            {c.label || c.city_id}
          </option>
        ))}
      </select>
      <button type="submit" className="map-btn" style={{ padding: '4px 8px' }}>
        Найти
      </button>
    </form>
  );
}

