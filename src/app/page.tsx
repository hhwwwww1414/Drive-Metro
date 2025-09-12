'use client';
import { useEffect, useState } from 'react';
import Legend from '@/components/Legend';
import MetroCanvas from '@/components/MetroCanvas';
import { DataBundle } from '@/lib/types';
import { loadData } from '@/lib/csv';

export default function Page() {
  const [bundle, setBundle] = useState<DataBundle | null>(null);
  const [activeLines, setActiveLines] = useState<Set<string>>(new Set());

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
      />
      <MetroCanvas bundle={bundle} activeLines={activeLines} />
    </>
  );
}
