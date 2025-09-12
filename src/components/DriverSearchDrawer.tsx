'use client';
import { useCallback, useEffect, useState } from 'react';
import { DataBundle } from '@/lib/types';
import searchDrivers, { DriverSearchResult } from '@/lib/driver-search';
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

  const renderDriverList = (list: { id: string; label: string }[]) => (
    <ul className="space-y-1 text-sm">
      {list.map((d) => (
        <li key={d.id} className="rounded border px-2 py-1">
          {d.label}
        </li>
      ))}
    </ul>
  );

  const renderComposite = (
    list: { path: string[]; drivers: { id: string; label: string }[] }[]
  ) => (
    <ul className="space-y-1 text-sm">
      {list.map((r, idx) => (
        <li key={idx} className="rounded border px-2 py-1">
          {r.path.join(' → ')}
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
