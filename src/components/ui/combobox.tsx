import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
}

export function Combobox({ value, onChange, options, placeholder }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <input
        className="w-full rounded border px-2 py-2 text-sm"
        placeholder={placeholder}
        value={selected ? selected.label : ''}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const match = options.find((o) => o.label === e.target.value);
          if (match) onChange(match.value);
        }}
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white shadow">
          {options.map((o) => (
            <li
              key={o.value}
              className={cn(
                'cursor-pointer px-2 py-1 text-sm hover:bg-gray-100',
                o.value === value && 'bg-gray-100'
              )}
              onMouseDown={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
