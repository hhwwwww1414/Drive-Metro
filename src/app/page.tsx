'use client';
import { useEffect, useState } from 'react';
import Legend from '@/components/Legend';
import MetroCanvas from '@/components/MetroCanvas';
import FabDrawer from '@/components/FabDrawer';
import RouteSelector from '@/components/RouteSelector';
import SearchResults, {
  SearchResults as SearchRes,
  SelectedRoute,
} from '@/components/SearchResults';
import { DataBundle } from '@/lib/types';
import { loadData } from '@/lib/csv';
import type { RouteSegment } from '@/lib/router';

export default function Page() {
  const [bundle, setBundle] = useState<DataBundle | null>(null);
  const [activeLines, setActiveLines] = useState<Set<string>>(new Set());
  const [routes, setRoutes] = useState<SearchRes>({
    exact: [],
    geo: [],
    bfs: [],
  });
  const [selected, setSelected] = useState<SelectedRoute>(null);
  const [pinned, setPinned] = useState<SelectedRoute[]>([]);

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
        currentRoute={(() => {
          const list: RouteSegment[] = [];
          pinned.forEach((p) => {
            const r = routes[p.type][p.idx];
            if (r) list.push(...r);
          });
          if (selected) {
            const r = routes[selected.type][selected.idx];
            if (r) list.push(...r);
          }
          return list;
        })()}
        focusRoute={selected ? routes[selected.type][selected.idx] : undefined}
      />
      <RouteSelector
        bundle={bundle}
        onRoute={(r) => {
          setRoutes(r);
          const has = r.exact.length || r.geo.length || r.bfs.length;
          setSelected(has ? { type: 'exact', idx: 0 } : null);
          setPinned([]);
        }}
      />
      {(routes.exact.length || routes.geo.length || routes.bfs.length) && (
        <SearchResults
          results={routes}
          bundle={bundle}
          selected={selected}
          onShow={(t, idx) => setSelected({ type: t, idx })}
          onPin={(t, idx) => {
            setPinned((prev) => {
              const exists = prev.some((p) => p.type === t && p.idx === idx);
              return exists
                ? prev.filter((p) => !(p.type === t && p.idx === idx))
                : [...prev, { type: t, idx }];
            });
          }}
        />
      )}
      <FabDrawer>
        <div className="p-4">Панель</div>
      </FabDrawer>
    </>
  );
}
