'use client';
import { useCallback, useEffect, useState, useRef } from 'react';
import Legend from '@/components/Legend';
import MetroCanvas, { type MetroCanvasHandle } from '@/components/MetroCanvas';
import SearchPanel from '@/components/SearchPanel';
import { DataBundle } from '@/lib/types';
import { loadData } from '@/lib/csv';
import type { RouteSegment } from '@/lib/router';

export default function Page() {
  const [bundle, setBundle] = useState<DataBundle | null>(null);
  const [activeLines, setActiveLines] = useState<Set<string>>(new Set());
  const canvasRef = useRef<MetroCanvasHandle>(null);
  const [lockedPath, setLockedPath] = useState<string[] | null>(null);
  const [currentRoute, setCurrentRoute] = useState<RouteSegment[]>([]);

  const clearRoute = useCallback(
    (resetView = false) => {
      setCurrentRoute([]);
      setLockedPath(null);
      canvasRef.current?.clearHighlights();
      if (resetView) {
        canvasRef.current?.resetView();
      }
    },
    [canvasRef]
  );

  const ensureRouteLinesVisible = useCallback((route: RouteSegment[]) => {
    setActiveLines((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const segment of route) {
        if (segment.transfer) continue;
        if (!next.has(segment.line.line_id)) {
          next.add(segment.line.line_id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const handleRouteSelect = useCallback(
    (route: RouteSegment[], cityPath: string[]) => {
      ensureRouteLinesVisible(route);
      setCurrentRoute(route);
      setLockedPath(cityPath);
      canvasRef.current?.highlightPath(cityPath);
      canvasRef.current?.fitToPath(cityPath);
    },
    [canvasRef, ensureRouteLinesVisible]
  );

  useEffect(() => {
    loadData()
      .then((b) => {
        setBundle(b);
        setActiveLines(new Set(b.lines.map((l) => l.line_id))); // включить все
      })
      .catch((err) => console.error('CSV load failed', err));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearRoute(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [clearRoute]);

  if (!bundle) {
    return (
      <div className="fixed inset-0 grid place-items-center">
        <div className="text-gray-500">Загрузка данных…</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-shell__search">
        <SearchPanel
          bundle={bundle}
          onRouteSelect={handleRouteSelect}
          onReset={() => clearRoute(true)}
          hasRoute={currentRoute.length > 0}
        />
      </div>
      <div className="app-shell__map">
        <MetroCanvas
          ref={canvasRef}
          bundle={bundle}
          activeLines={activeLines}
          currentRoute={currentRoute}
        />
        <div className="zoom-controls">
          <button
            type="button"
            className="zoom-controls__btn"
            aria-label="Приблизить"
            onClick={() => canvasRef.current?.zoomIn()}
          >
            +
          </button>
          <button
            type="button"
            className="zoom-controls__btn"
            aria-label="Отдалить"
            onClick={() => canvasRef.current?.zoomOut()}
          >
            −
          </button>
        </div>
      </div>
      <div className="app-shell__legend">
        <Legend
          bundle={bundle}
          activeLines={activeLines}
          onToggle={(id) => {
            setActiveLines((prev) => {
              const next = new Set(prev);
              if (next.has(id)) {
                next.delete(id);
              } else {
                next.add(id);
              }
              return next;
            });
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
            clearRoute(false);
            setLockedPath(ids);
            canvasRef.current?.highlightPath(ids);
            canvasRef.current?.fitToPath(ids);
          }}
        />
      </div>
    </div>
  );
}
