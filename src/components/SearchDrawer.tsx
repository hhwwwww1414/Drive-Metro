'use client';

import { useState, useMemo, RefObject } from 'react';
import type { DataBundle } from '@/lib/types';
import type { DriverIndex } from '@/lib/driver-index';
import type { MetroCanvasHandle } from './MetroCanvas';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from './ui/drawer';
import CatalogView from './CatalogView';
import SearchResults from './SearchResults';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundle: DataBundle;
  driverIndex: DriverIndex;
  canvasRef: RefObject<MetroCanvasHandle>;
}

export default function SearchDrawer({
  open,
  onOpenChange,
  bundle,
  driverIndex,
  canvasRef,
}: Props) {
  const [query, setQuery] = useState('');

  const cityIndex = useMemo(() => {
    const m: Record<string, string> = {};
    bundle.cities.forEach((c) => (m[c.city_id] = c.label));
    return m;
  }, [bundle.cities]);

  const results = useMemo(() => {
    if (!query) return [] as { label: string; cities: string[] }[];
    const q = query.toLowerCase();
    const out: { label: string; cities: string[] }[] = [];
    bundle.drivers.forEach((d) => {
      if (d.name.toLowerCase().includes(q)) {
        d.variants.forEach((v) => {
          const start = cityIndex[v.city_ids[0]] || v.city_ids[0];
          const end =
            cityIndex[v.city_ids[v.city_ids.length - 1]] ||
            v.city_ids[v.city_ids.length - 1];
          out.push({ label: `${d.name}: ${start} → ${end}`, cities: v.city_ids });
        });
      }
    });
    return out;
  }, [bundle.drivers, cityIndex, query]);

  const handleSelect = (cities: string[]) => {
    canvasRef.current?.highlightPath(cities);
    canvasRef.current?.fitToPath(cities);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Поиск маршрутов</DrawerTitle>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Название перевозчика"
            className="mt-2 w-full rounded-md border px-2 py-1 text-sm"
          />
        </DrawerHeader>
        {query ? (
          <SearchResults results={results} onSelect={handleSelect} />
        ) : (
          <CatalogView
            bundle={bundle}
            driverIndex={driverIndex}
            onSelect={handleSelect}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

