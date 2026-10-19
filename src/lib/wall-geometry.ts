import type { Wall } from './types';

/** Joins overlapping DXF segments and paired wall boundaries so their faces do not z-fight. */
export function uniqueWalls(walls: Wall[], metersPerUnit = 1): Wall[] {
  const merged: Wall[] = [];

  for (const source of walls) {
    let current: Wall = {
      ...source,
      start: [...source.start],
      end: [...source.end],
      sourceWallIds: source.sourceWallIds ?? [source.id],
    };

    // Re-check after every merge because the longer segment may now overlap another segment.
    let found = true;
    while (found) {
      found = false;
      for (let index = 0; index < merged.length; index += 1) {
        const existing = merged[index];
        const result = mergePair(existing, current, metersPerUnit);
        if (!result) continue;
        current = result;
        merged.splice(index, 1);
        found = true;
        break;
      }
    }
    merged.push(current);
  }
  return merged;
}

/** Removes coplanar cap overlap at perpendicular T, L, and crossing junctions. */
export function resolveWallJunctions(walls: Wall[], metersPerUnit: number): Wall[] {
  const directions = walls.map(wall => {
    const dx = (wall.end[0] - wall.start[0]) * metersPerUnit;
    const dy = (wall.end[1] - wall.start[1]) * metersPerUnit;
    const length = Math.hypot(dx, dy);
    return { length, ux: dx / length, uy: dy / length, low: 0, high: length, cuts: [] as Array<[number, number]> };
  });
  const clearance = 0.001;

  for (let i = 0; i < walls.length; i += 1) {
    for (let j = i + 1; j < walls.length; j += 1) {
      const a = walls[i];
      const b = walls[j];
      const da = directions[i];
      const db = directions[j];
      const cross = da.ux * db.uy - da.uy * db.ux;
      if (Math.abs(cross) < 1e-5) continue;

      const dx = (b.start[0] - a.start[0]) * metersPerUnit;
      const dy = (b.start[1] - a.start[1]) * metersPerUnit;
      const tA = (dx * db.uy - dy * db.ux) / cross;
      const tB = (dx * da.uy - dy * da.ux) / cross;
      const halfA = a.thickness / 2;
      const halfB = b.thickness / 2;
      if (tA < -halfB - clearance || tA > da.length + halfB + clearance || tB < -halfA - clearance || tB > db.length + halfA + clearance) continue;

      const aAtEnd = tA <= halfA + clearance || tA >= da.length - halfA - clearance;
      const bAtEnd = tB <= halfB + clearance || tB >= db.length - halfB - clearance;
      if (!aAtEnd && !bAtEnd) {
        // Keep the longer wall continuous and cut a clearance-sized slot from the crossing wall.
        const hostIndex = da.length >= db.length ? i : j;
        const branchIndex = hostIndex === i ? j : i;
        const host = walls[hostIndex];
        const branchDirection = directions[branchIndex];
        const branchT = branchIndex === i ? tA : tB;
        const radius = host.thickness / 2 + clearance;
        branchDirection.cuts.push([branchT - radius, branchT + radius]);
        continue;
      }

      if (aAtEnd && bAtEnd) {
        // At an L corner, extend one wall through the joint and stop the other at its face.
        const hostIndex = da.length >= db.length ? i : j;
        const branchIndex = hostIndex === i ? j : i;
        const hostDirection = directions[hostIndex];
        const branchDirection = directions[branchIndex];
        const hostT = hostIndex === i ? tA : tB;
        const branchT = branchIndex === i ? tA : tB;
        const branchWidth = walls[branchIndex].thickness;
        const hostWidth = walls[hostIndex].thickness;
        if (hostT <= hostWidth / 2 + clearance) hostDirection.low = Math.min(hostDirection.low, hostT - branchWidth / 2);
        else hostDirection.high = Math.max(hostDirection.high, hostT + branchWidth / 2);
        if (branchT <= branchWidth / 2 + clearance) branchDirection.low = Math.max(branchDirection.low, branchT + hostWidth / 2 + clearance);
        else branchDirection.high = Math.min(branchDirection.high, branchT - hostWidth / 2 - clearance);
        continue;
      }

      // At a T joint, stop the end wall just shy of the continuous wall's face.
      const branchIndex = aAtEnd ? i : j;
      const hostIndex = branchIndex === i ? j : i;
      const branchDirection = directions[branchIndex];
      const hostHalfWidth = walls[hostIndex].thickness / 2;
      const branchT = branchIndex === i ? tA : tB;
      if (branchT <= walls[branchIndex].thickness / 2 + clearance) branchDirection.low = Math.max(branchDirection.low, branchT + hostHalfWidth + clearance);
      else branchDirection.high = Math.min(branchDirection.high, branchT - hostHalfWidth - clearance);
    }
  }

  const result: Wall[] = [];
  walls.forEach((wall, index) => {
    const direction = directions[index];
    const intervals: Array<[number, number]> = [[direction.low, direction.high]];
    for (const [cutLow, cutHigh] of direction.cuts) {
      const next: Array<[number, number]> = [];
      for (const [low, high] of intervals) {
        if (cutHigh <= low || cutLow >= high) next.push([low, high]);
        else {
          if (cutLow - low > 0.01) next.push([low, cutLow]);
          if (high - cutHigh > 0.01) next.push([cutHigh, high]);
        }
      }
      intervals.splice(0, intervals.length, ...next);
    }
    intervals.forEach(([low, high], part) => {
      if (high - low <= 0.01) return;
      const toPoint = (t: number): [number, number] => [wall.start[0] + direction.ux * t / metersPerUnit, wall.start[1] + direction.uy * t / metersPerUnit];
      result.push({ ...wall, id: part === 0 ? wall.id : `${wall.id}:part${part + 1}`, start: toPoint(low), end: toPoint(high) });
    });
  });
  return result;
}

function mergePair(a: Wall, b: Wall, metersPerUnit: number): Wall | null {
  if (Math.abs(a.height - b.height) > 0.001 || Math.abs(a.thickness - b.thickness) > 0.03) return null;
  const ax = (a.end[0] - a.start[0]) * metersPerUnit;
  const ay = (a.end[1] - a.start[1]) * metersPerUnit;
  const lengthA = Math.hypot(ax, ay);
  const lengthB = Math.hypot((b.end[0] - b.start[0]) * metersPerUnit, (b.end[1] - b.start[1]) * metersPerUnit);
  if (lengthA < 1e-8 || lengthB < 1e-8) return null;
  const ux = ax / lengthA;
  const uy = ay / lengthA;
  const bx = (b.end[0] - b.start[0]) * metersPerUnit / lengthB;
  const by = (b.end[1] - b.start[1]) * metersPerUnit / lengthB;
  if (Math.abs(ux * bx + uy * by) < 0.999999) return null;

  const dx = (b.start[0] - a.start[0]) * metersPerUnit;
  const dy = (b.start[1] - a.start[1]) * metersPerUnit;
  const offset = ux * dy - uy * dx;

  const bStart = dx * ux + dy * uy;
  const bEndDx = (b.end[0] - a.start[0]) * metersPerUnit;
  const bEndDy = (b.end[1] - a.start[1]) * metersPerUnit;
  const bEnd = bEndDx * ux + bEndDy * uy;
  const bLow = Math.min(bStart, bEnd);
  const bHigh = Math.max(bStart, bEnd);
  const overlap = Math.max(0, Math.min(lengthA, bHigh) - Math.max(0, bLow));
  const isSameCenterline = Math.abs(offset) <= 0.0001;
  const tolerance = 0.0001;
  const bInsideA = bLow >= -tolerance && bHigh <= lengthA + tolerance;
  const aInsideB = bLow <= tolerance && bHigh >= lengthA - tolerance;
  const combinedHalfThickness = (a.thickness + b.thickness) / 2;
  const lengthRatio = Math.min(lengthA, lengthB) / Math.max(lengthA, lengthB);
  if (lengthRatio < 0.8 && Math.abs(offset) <= combinedHalfThickness + tolerance && (bInsideA || aInsideB)) {
    const primary = lengthB > lengthA ? b : a;
    return {
      ...primary,
      sourceWallIds: Array.from(new Set([...(a.sourceWallIds ?? [a.id]), ...(b.sourceWallIds ?? [b.id])])),
    };
  }

  if (!isSameCenterline) {
    const shorterLength = Math.min(lengthA, lengthB);
    const overlapRatio = overlap / shorterLength;
    const maxBoundarySpacing = Math.max(a.thickness, b.thickness) * 1.5;
    // Parallel lines are treated as the two faces of one wall only when their
    // spans closely match. This avoids collapsing nearby, distinct partitions.
    if (Math.abs(offset) > maxBoundarySpacing || lengthRatio < 0.8 || overlapRatio < 0.8) return null;
  }

  const low = Math.min(0, bLow);
  const high = Math.max(lengthA, bHigh);
  const centerOffset = offset / 2;
  const normalX = -uy;
  const normalY = ux;
  const worldPerDrawingUnit = metersPerUnit || 1;
  const start: [number, number] = [a.start[0] + (ux * low + normalX * centerOffset) / worldPerDrawingUnit, a.start[1] + (uy * low + normalY * centerOffset) / worldPerDrawingUnit];
  const end: [number, number] = [a.start[0] + (ux * high + normalX * centerOffset) / worldPerDrawingUnit, a.start[1] + (uy * high + normalY * centerOffset) / worldPerDrawingUnit];
  const primary = lengthB > lengthA ? b : a;
  const sourceWallIds = Array.from(new Set([...(a.sourceWallIds ?? [a.id]), ...(b.sourceWallIds ?? [b.id])]));
  return { ...primary, start, end, thickness: Math.abs(offset), sourceWallIds };
}
