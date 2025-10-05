'use client';
import { useEffect, useMemo, useState } from 'react';
import { DataBundle } from '@/lib/types';

type Props = {
  bundle: DataBundle;
  activeLines: Set<string>;
  onToggle: (lineId: string) => void;
  onToggleMany: (ids: string[], on: boolean) => void;
  onHoverPath?: (ids: string[] | null) => void;
  onSelectPath?: (ids: string[]) => void;
};

export default function Legend({ bundle, activeLines, onToggle, onToggleMany, onHoverPath, onSelectPath }: Props) {
  const byCorridor: Record<string, string[]> = {};
  for (const l of bundle.lines) {
    if (!byCorridor[l.corridor_id]) byCorridor[l.corridor_id] = [];
    byCorridor[l.corridor_id].push(l.line_id);
  }

  const lineVariants = useMemo(() => {
    type V = { variant: string; cities: string[] };
    const temp = new Map<string, { seq: number; city_id: string; variant: string }[]>();
    for (const p of bundle.linePaths) {
      const variant = p.variant_id != null ? String(p.variant_id) : '0';
      const key = `${p.line_id}::${variant}`;
      if (!temp.has(key)) temp.set(key, []);
      temp.get(key)!.push({ seq: p.seq, city_id: p.city_id, variant });
    }
    const out = new Map<string, V[]>();
    for (const [key, arr] of temp) {
      const [lineId, variant] = key.split('::');
      arr.sort((a, b) => a.seq - b.seq);
      if (!out.has(lineId)) out.set(lineId, []);
      out.get(lineId)!.push({ variant, cities: arr.map((r) => r.city_id) });
    }
    return out;
  }, [bundle.linePaths]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 768px)');
    if (media.matches) {
      setCollapsed(true);
    }
    const handler = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
      }
    };
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const toggleExpanded = (lineId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  };

  return (
    <div className={`legend${collapsed ? ' legend--collapsed' : ''}`}>
      <div className="legend__heading">
        <h3 className="legend__title">Коридоры и линии</h3>
        <button
          type="button"
          className="legend__collapse"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? 'Показать' : 'Скрыть'}
        </button>
      </div>

      <div className="legend__content">
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: '#f8f9fa',
            borderRadius: 8,
            fontSize: 12,
            color: '#666'
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Типы маршрутов:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 20, height: 4, background: '#7ED957', borderRadius: 2 }}></div>
            <span>Основные ветки (3+ линий)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 16, height: 3, background: '#009A49', borderRadius: 1.5 }}></div>
            <span>Ответвления (2 линии)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 2, background: '#6D4C41', borderRadius: 1 }}></div>
            <span>Уникальные участки (1 линия)</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="map-btn"
              onClick={() => onToggleMany(bundle.lines.map((l) => l.line_id), true)}
              style={{ fontSize: 12, padding: '4px 8px', height: 28 }}
            >
              Все
            </button>
            <button
              className="map-btn"
              onClick={() => onToggleMany(bundle.lines.map((l) => l.line_id), false)}
              style={{ fontSize: 12, padding: '4px 8px', height: 28 }}
            >
              Нет
            </button>
          </div>
        </div>

        {bundle.corridors.map((c) => {
          const lineIds = byCorridor[c.corridor_id] || [];
          return (
            <div key={c.corridor_id} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span
                  style={{
                    width: 16,
                    height: 4,
                    background: c.color,
                    borderRadius: 2,
                    flexShrink: 0
                  }}
                />
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: '#111',
                    flex: 1
                  }}
                >
                  {c.name}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="map-btn"
                    onClick={() => onToggleMany(lineIds, true)}
                    style={{ fontSize: 11, padding: '2px 6px', height: 24, minWidth: 32 }}
                  >
                    Все
                  </button>
                  <button
                    className="map-btn"
                    onClick={() => onToggleMany(lineIds, false)}
                    style={{ fontSize: 11, padding: '2px 6px', height: 24, minWidth: 32 }}
                  >
                    Нет
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 4, marginLeft: 8 }}>
                {bundle.lines
                  .filter((l) => l.corridor_id === c.corridor_id)
                  .map((l) => {
                    const on = activeLines.has(l.line_id);
                    const isExpanded = expanded.has(l.line_id);
                    const variant = lineVariants.get(l.line_id)?.[0];
                    const ids = variant
                      ? variant.cities
                      : bundle.linePaths
                          .filter((p) => p.line_id === l.line_id)
                          .sort((a, b) => a.seq - b.seq)
                          .map((p) => p.city_id);
                    return (
                      <div key={l.line_id}>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 8px',
                            border: '1px solid #e5e7eb',
                            borderRadius: 6,
                            background: on ? '#fff' : '#f9fafb',
                            opacity: on ? 1 : 0.7,
                            cursor: 'pointer',
                            transition: 'all 120ms ease-out',
                            fontSize: 13
                          }}
                          onMouseEnter={(e) => {
                            if (!on) e.currentTarget.style.background = '#f3f4f6';
                            onHoverPath?.(ids);
                          }}
                          onMouseLeave={(e) => {
                            if (!on) e.currentTarget.style.background = '#f9fafb';
                            onHoverPath?.(null);
                          }}
                          onClick={() => onSelectPath?.(ids)}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => onToggle(l.line_id)}
                            style={{
                              width: 14,
                              height: 14,
                              accentColor: l.color,
                              cursor: 'pointer'
                            }}
                          />
                          <span
                            style={{
                              width: 20,
                              height: 3,
                              background: l.color,
                              borderRadius: 2,
                              flexShrink: 0
                            }}
                          />
                          <span style={{ flex: 1 }}>{l.name}</span>
                          <button
                            type="button"
                            className="map-btn"
                            style={{ fontSize: 11, padding: '2px 6px', height: 24, minWidth: 32 }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleExpanded(l.line_id);
                            }}
                          >
                            {isExpanded ? 'Скрыть' : 'Маршрут'}
                          </button>
                        </label>

                        {isExpanded && (
                          <div
                            style={{
                              marginTop: 6,
                              marginLeft: 28,
                              paddingLeft: 8,
                              borderLeft: '1px dashed #d4d4d8',
                              display: 'grid',
                              gap: 4,
                              fontSize: 12,
                              color: '#4b5563'
                            }}
                          >
                            {(lineVariants.get(l.line_id) || []).map((variant, idx) => (
                              <button
                                key={`${l.line_id}-${variant.variant}-${idx}`}
                                type="button"
                                onClick={() => onSelectPath?.(variant.cities)}
                                className="map-btn"
                                style={{
                                  fontSize: 11,
                                  padding: '4px 6px',
                                  height: 26,
                                  justifyContent: 'flex-start'
                                }}
                              >
                                Вариант {variant.variant}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
