'use client';

import { useMemo } from 'react';
import type { DataBundle } from '@/lib/types';
import type { DriverIndex } from '@/lib/driver-index';

interface Props {
  bundle: DataBundle;
  driverIndex: DriverIndex;
  onSelect: (cities: string[]) => void;
}

export default function CatalogView({ bundle, driverIndex, onSelect }: Props) {
  const cityIndex = useMemo(() => {
    const m: Record<string, string> = {};
    bundle.cities.forEach((c) => (m[c.city_id] = c.label));
    return m;
  }, [bundle.cities]);

  return (
    <div className="flex flex-col gap-2">
      {driverIndex.routeCatalog.map((route, idx) => {
        const ids = route.city_ids;
        const start = cityIndex[ids[0]] || ids[0];
        const end = cityIndex[ids[ids.length - 1]] || ids[ids.length - 1];
        return (
          <button
            key={idx}
            className="map-btn text-left"
            onClick={() => onSelect(ids)}
          >
            {route.drivers.join(', ')}: {start} → {end}
          </button>
        );
      })}
    </div>
  );
}

