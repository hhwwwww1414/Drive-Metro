'use client';
import { Corridor, DataBundle } from '@/lib/types';

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

  const toggleAll = (ids: string[], on: boolean) => {
    const evt = new CustomEvent('legend:toggle-many', { detail: { ids, on } });
    window.dispatchEvent(evt);
  };

  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        top: 12,
        width: 360,
        maxHeight: 'calc(100vh - 24px)',
        overflow: 'auto',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,.06)',
        padding: 12,
        zIndex: 3,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>Ветки</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="map-btn"
            onClick={() => toggleAll(bundle.lines.map((l) => l.line_id), true)}
          >
            Показать все
          </button>
          <button
            className="map-btn"
            onClick={() => toggleAll(bundle.lines.map((l) => l.line_id), false)}
          >
            Скрыть все
          </button>
        </div>
      </div>

      {bundle.corridors.map((c) => {
        const lineIds = byCorridor[c.corridor_id] || [];
        return (
          <div key={c.corridor_id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 12, height: 12, background: c.color, borderRadius: 3 }} />
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button className="map-btn" onClick={() => toggleAll(lineIds, true)}>
                  Все
                </button>
                <button className="map-btn" onClick={() => toggleAll(lineIds, false)}>
                  Нет
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              {bundle.lines
                .filter((l) => l.corridor_id === c.corridor_id)
                .map((l) => {
                  const on = activeLines.has(l.line_id);
                  return (
                    <label
                      key={l.line_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        background: on ? '#fff' : '#f9fafb',
                        opacity: on ? 1 : 0.6,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => onToggle(l.line_id)}
                      />
                      <span
                        style={{
                          width: 24,
                          height: 4,
                          background: l.color,
                          borderRadius: 2,
                        }}
                      />
                      <span style={{ fontSize: 14 }}>{l.name}</span>
                    </label>
                  );
                })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
