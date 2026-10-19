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
  const unitCode = Number(header?.$INSUNITS);
  const declaredUnits: Record<number, { name: string; metersPerUnit: number }> = {
    1: { name: 'in', metersPerUnit: 0.0254 },
    2: { name: 'ft', metersPerUnit: 0.3048 },
    4: { name: 'mm', metersPerUnit: 0.001 },
    5: { name: 'cm', metersPerUnit: 0.01 },
    6: { name: 'm', metersPerUnit: 1 },
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

  // Many architecture DXFs omit $INSUNITS but still use millimeter coordinates.
  // Treat large plan extents as a visible, editable millimeter-scale estimate.
  const coordinates = walls.flatMap(wall => [wall.start, wall.end]);
  const xs = coordinates.map(point => point[0]);
  const ys = coordinates.map(point => point[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (span >= 250 && span <= 100_000) {
    return { walls: uniqueWalls(walls, 0.001), units: 'mm', unitsInferred: true, scale: 0.001, floorThickness: 0.15, source: 'dxf' };
  }

  return { walls: uniqueWalls(walls, 1), units: 'drawing units', unitsInferred: false, scale: 1, floorThickness: 0.15, source: 'dxf' };
}
