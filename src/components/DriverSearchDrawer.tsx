'use client';
import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { DataBundle } from '@/lib/types';
import { DriverSearchResult, DriverInfo } from '@/lib/driver-search';
import { normalize } from '@/lib/drivers';
import { Combobox } from '@/components/ui/combobox';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import DriverCard from '@/components/DriverCard';
import { ArrowLeftRight } from 'lucide-react';

type Props = {
  bundle: DataBundle;
};

export default function DriverSearchDrawer({ bundle }: Props) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [baseResults, setBaseResults] = useState<DriverSearchResult | null>(null);
  const [corridors, setCorridors] = useState<Set<string>>(
    () => new Set(bundle.corridors.map((c) => c.corridor_id))
  );
  const [maxOneTransfer, setMaxOneTransfer] = useState(false);
  const [onlyPhone, setOnlyPhone] = useState(false);
  const [shortFirst, setShortFirst] = useState(false);

  const cityOptions = bundle.cities.map((c) => ({
    value: c.city_id,
    label: c.label || c.city_id,
  }));
  const cityIndex = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of bundle.cities) m[c.city_id] = c.label || c.city_id;
    return m;
  }, [bundle.cities]);
  const labelIndex = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of bundle.cities) m[normalize(c.city_id)] = c.city_id;
    return m;
  }, [bundle.cities]);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/driverSearchWorker.ts', import.meta.url)
    );
    workerRef.current = worker;
    worker.onmessage = (
      e: MessageEvent<{ type: string; result?: DriverSearchResult }>
    ) => {
      const { type } = e.data;
      if (type === 'result') {
        const res: DriverSearchResult = e.data.result!;
        const mapRoute = (r: string[]) => r.map((c) => labelIndex[c] || c);
        const mapDriver = (d: DriverInfo): DriverInfo => ({
          ...d,
          routes: d.routes.map(mapRoute),
        });
        const mapped: DriverSearchResult = {
          exact: res.exact.map(mapDriver),
          geozone: res.geozone.map(mapDriver),
          composite: res.composite.map((r) => ({
            path: r.path.map((c) => labelIndex[c] || c),
            drivers: r.drivers.map(mapDriver),
          })),
        };
        setBaseResults(mapped);
      }
    };
    worker.postMessage({ type: 'load' });
    return () => worker.terminate();
  }, [labelIndex]);

  const handleSearch = useCallback(() => {
    if (!from || !to) return;
    workerRef.current?.postMessage({ type: 'search', from, to });
  }, [from, to]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Enter' && open) handleSearch();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, handleSearch]);

  const results = useMemo(() => {
    if (!baseResults) return null;
    let { exact, geozone, composite } = baseResults;

    const byCorridor = (d: DriverInfo) =>
      corridors.size === 0 || d.corridors.some((c) => corridors.has(c));

    exact = exact.filter(byCorridor);
    geozone = geozone.filter(byCorridor);
    composite = composite.filter((r) => r.drivers.every(byCorridor));

    if (onlyPhone) {
      exact = exact.filter((d) => !!d.phone);
      geozone = geozone.filter((d) => !!d.phone);
      composite = composite.filter((r) => r.drivers.every((d) => !!d.phone));
    }

    if (maxOneTransfer) {
      composite = composite.filter((r) => r.drivers.length <= 2);
    }

    const minLen = (d: DriverInfo) => Math.min(...d.routes.map((r) => r.length));

    if (shortFirst) {
      exact = [...exact].sort((a, b) => minLen(a) - minLen(b));
      geozone = [...geozone].sort((a, b) => minLen(a) - minLen(b));
      composite = [...composite].sort((a, b) => a.path.length - b.path.length);
    }

    return { exact, geozone, composite };
  }, [baseResults, corridors, onlyPhone, maxOneTransfer, shortFirst]);

  const renderDriverList = (list: DriverInfo[]) => (
    <ul className="space-y-1 text-sm">
      {list.map((d) => (
        <li key={d.id}>
          <DriverCard driver={d} />
        </li>
      ))}
    </ul>
  );

  const renderComposite = (list: { path: string[]; drivers: DriverInfo[] }[]) => (
    <ul className="space-y-2 text-sm">
      {list.map((r, idx) => (
        <li key={idx} className="space-y-1 rounded border p-2">
          {r.drivers.map((d, i) => (
            <div key={d.id} className="space-y-1">
              <DriverCard driver={d} />
              {i < r.path.length - 2 && (
                <div className="px-2 text-xs text-gray-500">
                  Пересадка: {cityIndex[r.path[i + 1]] || r.path[i + 1]}
                </div>
              )}
            </div>
          ))}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <button
        className="fixed top-4 right-4 z-50 rounded-full bg-white p-2 shadow"
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle driver search"
      >
        <ArrowLeftRight className="h-5 w-5" />
      </button>
      <Drawer open={open}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Поиск перевозчика</DrawerTitle>
            <DrawerDescription>Выберите города</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3">
            <Combobox
              value={from}
              onChange={setFrom}
              options={cityOptions}
              placeholder="Откуда"
            />
            <Combobox
              value={to}
              onChange={setTo}
              options={cityOptions}
              placeholder="Куда"
            />
            <button
              onClick={handleSearch}
              className="w-full rounded bg-yellow-300 px-4 py-2 text-sm font-medium text-gray-800"
            >
              Найти перевозчика
            </button>
          </div>
          {results && (
            <DrawerFooter>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <div className="mb-2 font-medium">Точный</div>
                  {results.exact.length
                    ? renderDriverList(results.exact)
                    : 'Ничего не найдено'}
                </div>
                <div>
                  <div className="mb-2 font-medium">Геозона</div>
                  {results.geozone.length
                    ? renderDriverList(results.geozone)
                    : 'Ничего не найдено'}
                </div>
                <div>
                  <div className="mb-2 font-medium">Составной</div>
                  {results.composite.length
                    ? renderComposite(results.composite)
                    : 'Ничего не найдено'}
                </div>
              </div>
            </DrawerFooter>
          )}
          <div className="mt-4 border-t pt-4 text-sm">
            <div className="mb-2 font-medium">Коридоры</div>
            <div className="flex flex-wrap gap-2">
              {bundle.corridors.map((c) => (
                <label key={c.corridor_id} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={corridors.has(c.corridor_id)}
                    onChange={(e) => {
                      setCorridors((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(c.corridor_id);
                        else next.delete(c.corridor_id);
                        return next;
                      });
                    }}
                  />
                  {c.name}
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-1">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={maxOneTransfer}
                  onChange={(e) => setMaxOneTransfer(e.target.checked)}
                />
                ≤1 пересадки
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={onlyPhone}
                  onChange={(e) => setOnlyPhone(e.target.checked)}
                />
                Только с телефоном
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={shortFirst}
                  onChange={(e) => setShortFirst(e.target.checked)}
                />
                Сначала короткие
              </label>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
