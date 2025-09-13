'use client';
import { useEffect, useState } from 'react';
import Legend from '@/components/Legend';
import MetroCanvas from '@/components/MetroCanvas';
import FabDrawer from '@/components/FabDrawer';
import RouteSelector from '@/components/RouteSelector';
import RouteResultList from '@/components/RouteResultList';
import { DataBundle } from '@/lib/types';
import { loadData } from '@/lib/csv';
import type { RouteSegment } from '@/lib/router';

export default function Page() {
  const [bundle, setBundle] = useState<DataBundle | null>(null);
  const [activeLines, setActiveLines] = useState<Set<string>>(new Set());
  const [routes, setRoutes] = useState<RouteSegment[][]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    loadData()
      .then((b) => {
        setBundle(b);
        setActiveLines(new Set(b.lines.map((l) => l.line_id))); // включить все
      })
      .catch((err) => console.error('CSV load failed', err));
  }, []);

  if (!bundle) {
    return (
      <div className="fixed inset-0 grid place-items-center">
        <div className="text-gray-500">Загрузка данных…</div>
      </div>
    );
  }

  return (
    <>
      <Legend
        bundle={bundle}
        activeLines={activeLines}
        onToggle={(id) => {
          const next = new Set(activeLines);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          setActiveLines(next);
        }}
        onToggleMany={(ids, on) => {
          setActiveLines((prev) => {
            const next = new Set(prev);
            if (on) {
              ids.forEach((id) => next.add(id));
            } else {
              ids.forEach((id) => next.delete(id));
            }
            return next;
          });
        }}
      />
      <MetroCanvas
        bundle={bundle}
        activeLines={activeLines}
        currentRoute={selected != null ? routes[selected] : []}
      />
      <RouteSelector
        bundle={bundle}
        onRoute={(r) => {
          setRoutes(r);
          setSelected(r.length ? 0 : null);
        }}
      />
      {routes.length > 0 && (
        <RouteResultList
          routes={routes}
          bundle={bundle}
          selected={selected}
          onSelect={setSelected}
        />
      )}
      <FabDrawer>
        <div className="p-4">Панель</div>
      </FabDrawer>
    </>
  );
}
