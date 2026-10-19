import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { parseDxf } from './dxf';

describe('DXF conversion', () => {
  it('converts a closed sample polyline into real walls and estimates millimeter scale', () => {
    const model = parseDxf(fs.readFileSync('samples/simple-room.dxf', 'utf8'));
    expect(model.source).toBe('dxf');
    expect(model.walls).toHaveLength(4);
    expect(model.walls[0].start).toEqual([0, 0]);
    expect(model.walls.every(wall => wall.height === 2.8 && wall.thickness === 0.18)).toBe(true);
    expect(model.units).toBe('mm');
    expect(model.unitsInferred).toBe(true);
    expect(model.scale).toBe(0.001);
  });

  it('uses the declared DXF unit scale when INSUNITS is present', () => {
    const sample = fs.readFileSync('samples/simple-room.dxf', 'utf8');
    const withHeader = sample.replace(
      '0\nSECTION\n2\nENTITIES',
      '0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES',
    );
    const model = parseDxf(withHeader);
    expect(model.units).toBe('mm');
    expect(model.unitsInferred).toBe(false);
    expect(model.scale).toBe(0.001);
  });

  it('rejects a DXF without supported wall entities', () => {
    expect(() => parseDxf('0\nSECTION\n2\nENTITIES\n0\nCIRCLE\n8\n0\n10\n0\n20\n0\n40\n3\n0\nENDSEC\n0\nEOF')).toThrow(/LINE or POLYLINE/);
  });

  it('rejects malformed input', () => {
    expect(() => parseDxf('not a dxf')).toThrow();
  });
});
