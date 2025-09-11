'use client';
import { useState } from 'react';
import { DataBundle } from '@/lib/types';
import { findRoutes } from '@/lib/graph';
import type { RouteSegment } from '@/lib/router';

type Props = {
  bundle: DataBundle;
  onRoutes: (routes: RouteSegment[][]) => void;
};

export default function RoutePanel({ bundle, onRoutes }: Props) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to) return;
    const found = findRoutes(bundle, from, to);
    onRoutes(found);
  };

    return (
      <div className="route-panel">
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
    </div>
  );
}

