import { describe, it, expect } from 'vitest';
import { placeLabels } from '../src/lib/label-placer';
import { boxesIntersect, getTextBoundingBox } from '../src/lib/geometry';
import { METRO_CONFIG } from '../src/lib/metro-config';
import type { City } from '../src/lib/types';

describe('placeLabels alternative placements', () => {
  it('avoids overlaps in dense layout', () => {
    const cities: City[] = [];
    for (let i = 0; i < 10; i++) {
      cities.push({
        city_id: `C${i}`,
        label: `C${i}`,
        x: 100,
        y: 100,
        is_hub: 0,
        is_corridor_hub: 0,
      });
    }

    const placements = placeLabels(cities, 2);
    expect(placements.length).toBe(cities.length);

    const boxes = placements.map((p) => {
      const city = cities.find((c) => c.city_id === p.city_id)!;
      const fontSize = city.is_hub
        ? METRO_CONFIG.FONT_SIZE_HUB
        : METRO_CONFIG.FONT_SIZE_NORMAL;
      return {
        ...getTextBoundingBox(city.label, p.x, p.y, fontSize),
        city_id: city.city_id,
      };
    });

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const overlap = boxesIntersect(boxes[i], boxes[j], 2);
        expect(overlap).toBe(false);
      }
    }
  });
});
