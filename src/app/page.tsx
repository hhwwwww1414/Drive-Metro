'use client';
import { useEffect, useState, useRef } from 'react';
import Legend from '@/components/Legend';
import MetroCanvas, { type MetroCanvasHandle } from '@/components/MetroCanvas';
import { DataBundle } from '@/lib/types';
import { loadData } from '@/lib/csv';

export default function Page() {
  const [bundle, setBundle] = useState<DataBundle | null>(null);
  const [activeLines, setActiveLines] = useState<Set<string>>(new Set());
  const canvasRef = useRef<MetroCanvasHandle>(null);
  const [lockedPath, setLockedPath] = useState<string[] | null>(null);

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
      <MetroCanvas ref={canvasRef} bundle={bundle} activeLines={activeLines} />
    </>
  );
}
