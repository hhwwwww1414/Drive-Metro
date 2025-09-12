'use client';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { DataBundle } from '@/lib/types';
import searchDrivers, { DriverSearchResult, DriverInfo } from '@/lib/driver-search';
import { Combobox } from '@/components/ui/combobox';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import DriverCard from '@/components/DriverCard';

type Props = {
  bundle: DataBundle;
};

export default function DriverSearchDrawer({ bundle }: Props) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [results, setResults] = useState<DriverSearchResult | null>(null);

  const cityOptions = bundle.cities.map((c) => ({
    value: c.city_id,
    label: c.label || c.city_id,
  }));
  const cityIndex = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of bundle.cities) m[c.city_id] = c.label || c.city_id;
    return m;
  }, [bundle.cities]);

  const handleSearch = useCallback(async () => {
    if (!from || !to) return;
    const res = await searchDrivers(from, to);
    setResults(res);
  }, [from, to]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Enter' && open) handleSearch();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, handleSearch]);

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
      {!open && (
        <button
          className="fixed bottom-4 right-4 rounded-full bg-yellow-300 px-4 py-2 text-sm font-medium text-gray-800 shadow"
          onClick={() => setOpen(true)}
        >
          Поиск перевозчика
        </button>
      )}
      <Drawer open={open} onOpenChange={setOpen}>
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
              <Tabs defaultValue="exact">
                <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="exact">Точный</TabsTrigger>
                  <TabsTrigger value="geozone">Геозона</TabsTrigger>
                  <TabsTrigger value="composite">Составной</TabsTrigger>
                </TabsList>
                <TabsContent value="exact">
                  {results.exact.length
                    ? renderDriverList(results.exact)
                    : 'Ничего не найдено'}
                </TabsContent>
                <TabsContent value="geozone">
                  {results.geozone.length
                    ? renderDriverList(results.geozone)
                    : 'Ничего не найдено'}
                </TabsContent>
                <TabsContent value="composite">
                  {results.composite.length
                    ? renderComposite(results.composite)
                    : 'Ничего не найдено'}
                </TabsContent>
              </Tabs>
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
