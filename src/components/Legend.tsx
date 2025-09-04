'use client';
import { useMemo, useState } from 'react';
import { DataBundle } from '@/lib/types';

type Props = {
  bundle: DataBundle;
  activeLines: Set<string>;
  onToggle: (lineId: string) => void;
};

export default function Legend({ bundle, activeLines, onToggle }: Props) {
  const byCorridor: Record<string, string[]> = {};
  for (const l of bundle.lines) {
    if (!byCorridor[l.corridor_id]) byCorridor[l.corridor_id] = [];
    byCorridor[l.corridor_id].push(l.line_id);
  }

  // Индексы для быстрого доступа
  const cityIndex = useMemo(() => {
    const idx: Record<string, { label: string; is_hub: number }> = {};
    for (const c of bundle.cities) idx[c.city_id] = { label: c.label, is_hub: c.is_hub };
    return idx;
  }, [bundle.cities]);

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

  const toggleAll = (ids: string[], on: boolean) => {
    const evt = new CustomEvent('legend:toggle-many', { detail: { ids, on } });
    window.dispatchEvent(evt);
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        top: 12,
        width: 320,
        maxHeight: 'calc(100vh - 24px)',
        overflow: 'auto',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,.06)',
        padding: 16,
        zIndex: 3,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111' }}>Коридоры и линии</h3>
      </div>
      
      <div style={{ 
        marginBottom: 16, 
        padding: 12, 
        background: '#f8f9fa', 
        borderRadius: 8, 
        fontSize: 12, 
        color: '#666' 
      }}>
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
            onClick={() => toggleAll(bundle.lines.map((l) => l.line_id), true)}
            style={{ fontSize: 12, padding: '4px 8px', height: 28 }}
          >
            Все
          </button>
          <button
            className="map-btn"
            onClick={() => toggleAll(bundle.lines.map((l) => l.line_id), false)}
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
              <span style={{ 
                width: 16, 
                height: 4, 
                background: c.color, 
                borderRadius: 2,
                flexShrink: 0
              }} />
              <div style={{ 
                fontWeight: 600, 
                fontSize: 14,
                color: '#111',
                flex: 1
              }}>
                {c.name}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button 
                  className="map-btn" 
                  onClick={() => toggleAll(lineIds, true)}
                  style={{ fontSize: 11, padding: '2px 6px', height: 24, minWidth: 32 }}
                >
                  Все
                </button>
                <button 
                  className="map-btn" 
                  onClick={() => toggleAll(lineIds, false)}
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
                          fontSize: 13,
                        }}
                        onMouseEnter={(e) => {
                          if (!on) e.currentTarget.style.background = '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                          if (!on) e.currentTarget.style.background = '#f9fafb';
                        }}
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
                            borderRadius: 1.5,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ 
                          fontSize: 13, 
                          color: on ? '#111' : '#666',
                          flex: 1
                        }}>
                          {l.name}
                        </span>
                        <button
                          type="button"
                          onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); toggleExpanded(l.line_id); }}
                          title={isExpanded ? 'Скрыть станции' : 'Показать станции'}
                          style={{
                            width: 24,
                            height: 24,
                            border: '1px solid #e5e7eb',
                            background: '#fff',
                            borderRadius: 6,
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <span style={{ display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 120ms ease' }}>▸</span>
                        </button>
                      </label>
                      {isExpanded && (
                        <div style={{ margin: '6px 0 10px 26px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', padding: '8px 10px' }}>
                          {(() => {
                            const variants = lineVariants.get(l.line_id) || [];
                            if (variants.length <= 1) {
                              const ids = (variants[0]?.cities) ?? bundle.linePaths.filter(p=>p.line_id===l.line_id).sort((a,b)=>a.seq-b.seq).map(p=>p.city_id);
                              return (<StationsList color={l.color} ids={ids} cityIndex={cityIndex} />);
                            }
                            return (
                              <div style={{ display: 'grid', gap: 12 }}>
                                {variants.map((v, i) => (
                                  <div key={v.variant}>
                                    <div style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 6px 2px' }}>Вариант {i + 1}</div>
                                    <StationsList color={l.color} ids={v.cities} cityIndex={cityIndex} />
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
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
  );
}

function StationsList({ color, ids, cityIndex }: { color: string; ids: string[]; cityIndex: Record<string, { label: string; is_hub: number }> }) {
  return (
    <div style={{ position: 'relative', paddingLeft: 28 }}>
      <div style={{ position: 'absolute', left: 14, top: 6, bottom: 6, width: 2, background: color, borderRadius: 1 }} />
      {ids.map((id, idx) => {
        const city = cityIndex[id];
        if (!city) return null;
        return (
          <div key={`${id}-${idx}`} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 6px 24px' }}>
            <div style={{ position: 'absolute', left: 8, width: 10, height: 10, borderRadius: 5, background: '#fff', border: `2px solid ${color}` }} />
            <div style={{ fontSize: 13, color: '#111', fontWeight: city.is_hub ? (600 as const) : (400 as const) }}>{city.label}</div>
          </div>
        );
      })}
    </div>
  );
}
