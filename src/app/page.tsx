'use client';
import { useEffect, useState, useRef } from 'react';
import Legend from '@/components/Legend';
import MetroCanvas, { type MetroCanvasHandle } from '@/components/MetroCanvas';
import SearchDrawer from '@/components/SearchDrawer';
import { getDriverIndex, type DriverIndex } from '@/lib/driver-index';
import { DataBundle } from '@/lib/types';
import { loadData, initDriverIndex } from '@/lib/csv';

export default function Page() {
  const [bundle, setBundle] = useState<DataBundle | null>(null);
  const [activeLines, setActiveLines] = useState<Set<string>>(new Set());
  const canvasRef = useRef<MetroCanvasHandle>(null);
  const [lockedPath, setLockedPath] = useState<string[] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [driverIndex, setDriverIndex] = useState<DriverIndex | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);

  useEffect(() => {
    loadData()
      .then((b) => {
        setBundle(b);
        setActiveLines(new Set(b.lines.map((l) => l.line_id))); // включить все
        try {
          initDriverIndex(b.drivers);
          setDriverIndex(getDriverIndex());
        } catch (err) {
          console.error('Driver index init failed', err);
          setIndexError(err instanceof Error ? err.message : String(err));
        }
      })
      .catch((err) => console.error('CSV load failed', err));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLockedPath(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
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
      {(!driverIndex || indexError) && (
        <div
          className={`fixed left-0 right-0 top-0 z-10 text-center text-sm py-1 ${
            indexError ? 'bg-red-200 text-red-900' : 'bg-yellow-200'
          }`}
        >
          {indexError ? 'Ошибка индекса маршрутов' : 'Инициализация индекса маршрутов…'}
        </div>
      )}
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
        onHoverPath={(ids) => {
          if (ids) {
            canvasRef.current?.highlightPath(ids);
          } else if (lockedPath) {
            canvasRef.current?.highlightPath(lockedPath);
          } else {
            canvasRef.current?.clearHighlights();
          }
        }}
        onSelectPath={(ids) => {
          setLockedPath(ids);
          canvasRef.current?.highlightPath(ids);
          canvasRef.current?.fitToPath(ids);
        }}
      />
      {driverIndex && !indexError && (
        <>
          <button
            className="map-btn"
            style={{ position: 'fixed', top: 12, right: 12, zIndex: 5 }}
            onClick={() => setDrawerOpen(true)}
          >
            Поиск
          </button>
          <SearchDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            bundle={bundle}
            driverIndex={driverIndex}
            canvasRef={canvasRef}
          />
        </>
      )}
      <MetroCanvas ref={canvasRef} bundle={bundle} activeLines={activeLines} />
    </>
  );
}
