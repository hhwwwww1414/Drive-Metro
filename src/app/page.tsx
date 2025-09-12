'use client';
import { useEffect, useState } from 'react';
import Legend from '@/components/Legend';
import MetroCanvas from '@/components/MetroCanvas';
import DriverSearchDrawer from '@/components/DriverSearchDrawer';
import RouteResultList from '@/components/RouteResultList';
import { DataBundle } from '@/lib/types';
import { loadData } from '@/lib/csv';
import type { RouteSegment } from '@/lib/router';

export default function Page() {
  const [bundle, setBundle] = useState<DataBundle | null>(null);
  const [activeLines, setActiveLines] = useState<Set<string>>(new Set());
  const [routes] = useState<RouteSegment[][]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [currentRoute, setCurrentRoute] = useState<RouteSegment[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [uiHidden, setUiHidden] = useState(false);

  useEffect(() => {
    loadData()
      .then((b) => {
        setBundle(b);
        setActiveLines(new Set(b.lines.map((l) => l.line_id))); // включить все
      })
      .catch((err) => console.error('CSV load failed', err));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // ловим массовые переключения из MetroCanvas (от Legend)
  useEffect(() => {
    const onUpdate = (e: Event) => {
      const ids = (e as CustomEvent).detail as string[];
      setActiveLines(new Set(ids));
    };
    window.addEventListener('page:update-lines', onUpdate as EventListener);
    return () => window.removeEventListener('page:update-lines', onUpdate as EventListener);
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
      {!uiHidden && (
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
        />
      )}
      {!uiHidden && <DriverSearchDrawer bundle={bundle} />}
      <MetroCanvas
        bundle={bundle}
        activeLines={activeLines}
        currentRoute={currentRoute}
        onToggleTheme={() =>
          setTheme((t) => (t === 'light' ? 'dark' : 'light'))
        }
        onHideUI={() => setUiHidden(true)}
        uiHidden={uiHidden}
      />
      {!uiHidden && (
        <RouteResultList
          bundle={bundle}
          routes={routes}
          selected={selectedIdx}
          onSelect={(idx) => {
            setSelectedIdx(idx);
            const route = routes[idx];
            setCurrentRoute(route);
            setActiveLines((prev) => {
              const next = new Set(prev);
              for (const seg of route) {
                if (!seg.transfer) next.add(seg.line.line_id);
              }
              return next;
            });
          }}
        />
      )}
      {uiHidden && (
        <button
          className="fixed bottom-4 right-4 rounded-full bg-yellow-300 px-4 py-2 text-sm font-medium text-gray-800 shadow"
          onClick={() => setUiHidden(false)}
        >
          Показать интерфейс
        </button>
      )}
    </>
  );
}
