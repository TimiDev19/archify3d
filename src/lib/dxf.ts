import DxfParser from 'dxf-parser';
import type { ModelData, Wall } from './types';
import { uniqueWalls } from './wall-geometry';
// Supported deterministic path: DXF LINE and LWPOLYLINE/POLYLINE entities on any layer become wall centerlines.
// Coordinates are retained in drawing units; user supplies a linear scale in the workspace.
export function parseDxf(text: string): ModelData {
  const doc = new DxfParser().parseSync(text);
  if (!doc?.entities?.length) throw new Error('No supported geometry found in this DXF.');
  const walls: Wall[] = [];
  for (const [index, e] of doc.entities.entries()) {
    if (e.type === 'LINE' && e.vertices?.length >= 2) {
      const a = e.vertices[0], b = e.vertices[1];
      if (a.x !== b.x || a.y !== b.y) walls.push({ id: `w${index}`, start: [a.x, a.y], end: [b.x, b.y], height: 2.8, thickness: 0.18 });
    } else if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.vertices?.length >= 2) {
      for (let i = 0; i < e.vertices.length - 1; i++) { const a=e.vertices[i], b=e.vertices[i+1]; if(a.x!==b.x||a.y!==b.y) walls.push({id:`w${index}-${i}`,start:[a.x,a.y],end:[b.x,b.y],height:2.8,thickness:0.18}); }
      if (e.shape && e.vertices.length > 2) { const a=e.vertices.at(-1)!,b=e.vertices[0]; walls.push({id:`w${index}-close`,start:[a.x,a.y],end:[b.x,b.y],height:2.8,thickness:0.18}); }
    }
  }
  if (!walls.length) throw new Error('This MVP converts DXF lines and polylines. No LINE or POLYLINE walls were found.');

  const header = (doc as typeof doc & { header?: Record<string, unknown> }).header;
  // dxf-parser versions and DXF producers vary in how the header key is exposed;
  // read the canonical group-code pair from the original HEADER section as a fallback.
  const headerPairs = text.replace(/\r/g, '').split('\n');
  let rawUnitCode = Number.NaN;
  for (let i = 0; i < headerPairs.length - 1; i++) {
    if (headerPairs[i].trim() === '9' && headerPairs[i + 1].trim().toUpperCase() === '$INSUNITS') {
      for (let j = i + 2; j < Math.min(i + 8, headerPairs.length - 1); j += 2) {
        if (headerPairs[j].trim() === '70' || headerPairs[j].trim() === '280') { rawUnitCode = Number(headerPairs[j + 1].trim()); break; }
        if (headerPairs[j].trim() === '9' || headerPairs[j].trim() === '0') break;
      }
      break;
    }
  }
  const unitCode = Number.isFinite(rawUnitCode) ? rawUnitCode : Number(header?.$INSUNITS ?? header?.INSUNITS);
  const declaredUnits: Record<number, { name: string; metersPerUnit: number }> = {
    1: { name: 'in', metersPerUnit: 0.0254 },
    2: { name: 'ft', metersPerUnit: 0.3048 },
    3: { name: 'mi', metersPerUnit: 1609.344 },
    4: { name: 'mm', metersPerUnit: 0.001 },
    5: { name: 'cm', metersPerUnit: 0.01 },
    6: { name: 'm', metersPerUnit: 1 },
    7: { name: 'km', metersPerUnit: 1000 },
    8: { name: 'µin', metersPerUnit: 0.0000000254 },
    9: { name: 'mil', metersPerUnit: 0.0000254 },
    10: { name: 'yd', metersPerUnit: 0.9144 },
    13: { name: 'µm', metersPerUnit: 0.000001 },
    14: { name: 'dm', metersPerUnit: 0.1 },
    15: { name: 'dam', metersPerUnit: 10 },
    16: { name: 'hm', metersPerUnit: 100 },
    17: { name: 'gm', metersPerUnit: 1_000_000 },
  };

  const declared = declaredUnits[unitCode];
  if (declared) {
    return {
      walls: uniqueWalls(walls, declared.metersPerUnit),
      units: declared.name,
      unitsInferred: false,
      scale: declared.metersPerUnit,
      floorThickness: 0.15,
      source: 'dxf',
    };
  }

  // Without unit metadata there is no mathematically reliable way to infer scale.
  // Offer a practical starting guess based on typical plan extents, clearly marked
  // as inferred, and let the student choose units or calibrate scale in the UI.
  const coordinates = walls.flatMap(wall => [wall.start, wall.end]);
  const xs = coordinates.map(point => point[0]);
  const ys = coordinates.map(point => point[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const guess = span >= 250 ? declaredUnits[4] : span >= 12 ? declaredUnits[2] : declaredUnits[6];
  return { walls: uniqueWalls(walls, guess.metersPerUnit), units: guess.name, unitsInferred: true, scale: guess.metersPerUnit, floorThickness: 0.15, source: 'dxf' };
}
