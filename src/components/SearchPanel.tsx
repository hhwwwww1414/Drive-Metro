'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DataBundle } from '@/lib/types';
import type { RouteSegment } from '@/lib/router';
import { findRoute } from '@/lib/graph';

interface Props {
  bundle: DataBundle;
  onRouteSelect: (route: RouteSegment[], cityPath: string[]) => void;
  onReset: () => void;
  hasRoute: boolean;
}

function buildCityPath(route: RouteSegment[]): string[] {
  const path: string[] = [];
  for (const segment of route) {
    if (segment.transfer) continue;
    if (path.length === 0) {
      path.push(segment.from);
    } else if (path[path.length - 1] !== segment.from) {
      path.push(segment.from);
    }
    path.push(segment.to);
  }
  return path;
}

export default function SearchPanel({ bundle, onRouteSelect, onReset, hasRoute }: Props) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (!hasRoute) {
      setSummary('');
    }
  }, [hasRoute]);


  const cityOptions = useMemo(() => {
    return [...bundle.cities].sort((a, b) => {
      const aLabel = a.label || a.city_id;
      const bLabel = b.label || b.city_id;
      return aLabel.localeCompare(bLabel, 'ru');
    });
  }, [bundle.cities]);

  const labelById = useMemo(() => {
    const map = new Map<string, string>();
    bundle.cities.forEach((city) => {
      map.set(city.city_id, city.label || city.city_id);
    });
    return map;
  }, [bundle.cities]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!from || !to) {
      setError('Выберите станции отправления и назначения.');
      return;
    }
    if (from === to) {
      setError('Выберите разные станции.');
      return;
    }

    const route = findRoute(bundle, from, to);
    if (!route.length) {
      setError('Маршрут не найден. Попробуйте выбрать другие станции.');
      return;
    }

    const cityPath = buildCityPath(route);
    onRouteSelect(route, cityPath);
    setSummary(`${labelById.get(from) ?? from} → ${labelById.get(to) ?? to}`);
    setError('');
  };

  const handleReset = () => {
    setFrom('');
    setTo('');
    setError('');
    setSummary('');
    onReset();
  };

  const showResetButton = hasRoute || Boolean(from || to || summary);

  return (
    <aside className="search-panel">
      <div className="search-panel__header">
        <h2 className="search-panel__title">Поиск маршрута</h2>
        {showResetButton && (
          <button
            type="button"
            className="search-panel__clear"
            onClick={handleReset}
            aria-label="Сбросить поиск"
          >
            ×
          </button>
        )}
      </div>

      <form className="search-panel__form" onSubmit={handleSubmit}>
        <div className="search-panel__inputs">
          <label className="search-panel__field">
            <span className="search-panel__label">Откуда</span>
            <select
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                if (error) setError('');
              }}
              className="search-panel__select"
            >
              <option value="">Выберите станцию</option>
              {cityOptions.map((city) => (
                <option key={city.city_id} value={city.city_id}>
                  {city.label || city.city_id}
                </option>
              ))}
            </select>
          </label>

          <label className="search-panel__field">
            <span className="search-panel__label">Куда</span>
            <select
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                if (error) setError('');
              }}
              className="search-panel__select"
            >
              <option value="">Выберите станцию</option>
              {cityOptions.map((city) => (
                <option key={`${city.city_id}-to`} value={city.city_id}>
                  {city.label || city.city_id}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button type="submit" className="map-btn search-panel__submit">
          Найти
        </button>
      </form>

      {summary && !error && (
        <div className="search-panel__summary">Маршрут: {summary}</div>
      )}

      {error && <div className="search-panel__error">{error}</div>}
    </aside>
  );
}
