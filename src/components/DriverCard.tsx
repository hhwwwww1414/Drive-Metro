'use client';
import type { DriverInfo } from '@/lib/driver-search';

interface Props {
  driver: DriverInfo;
}

export default function DriverCard({ driver }: Props) {
  const dispatchHover = (routes: string[][] | null) => {
    window.dispatchEvent(new CustomEvent('driver:hover', { detail: routes }));
  };
  const handleSelect = () => {
    window.dispatchEvent(
      new CustomEvent('driver:select', { detail: driver.routes })
    );
  };
  return (
    <div
      className="space-y-1 rounded border p-2 text-sm"
      onMouseEnter={() => dispatchHover(driver.routes)}
      onMouseLeave={() => dispatchHover(null)}
    >
      <div className="font-medium">{driver.label}</div>
      {driver.phone && (
        <div>
          <a href={`tel:${driver.phone}`} className="text-blue-600 hover:underline">
            {driver.phone}
          </a>
        </div>
      )}
      {(driver.branches.length > 0 || driver.corridors.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {driver.branches.map((b) => (
            <span
              key={b}
              className="rounded bg-gray-200 px-1 text-xs"
            >
              {b}
            </span>
          ))}
          {driver.corridors.map((c) => (
            <span
              key={c}
              className="rounded bg-yellow-200 px-1 text-xs"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      <button
        onClick={handleSelect}
        className="mt-1 rounded bg-yellow-300 px-2 py-1 text-xs font-medium text-gray-800"
      >
        Показать на карте
      </button>
    </div>
  );
}
