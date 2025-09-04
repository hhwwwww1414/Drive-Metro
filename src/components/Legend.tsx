'use client';
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
                  return (
                    <label
                      key={l.line_id}
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
