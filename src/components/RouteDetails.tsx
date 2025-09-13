'use client';

interface Props {
  driver: string;
  cities: string[];
}

export default function RouteDetails({ driver, cities }: Props) {
  return (
    <div>
      <h3 className="text-lg font-semibold">{driver}</h3>
      <div className="mt-2 text-sm text-gray-700">
        {cities.join(' → ')}
      </div>
    </div>
  );
}

