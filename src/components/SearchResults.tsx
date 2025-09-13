'use client';

interface Result {
  label: string;
  cities: string[];
}

interface Props {
  results: Result[];
  onSelect: (cities: string[]) => void;
}

export default function SearchResults({ results, onSelect }: Props) {
  if (!results.length) {
    return <div className="text-sm text-gray-500">Ничего не найдено</div>;
  }
  return (
    <div className="flex flex-col gap-2">
      {results.map((r, idx) => (
        <button
          key={idx}
          className="map-btn text-left"
          onClick={() => onSelect(r.cities)}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

