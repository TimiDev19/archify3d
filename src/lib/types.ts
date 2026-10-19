export type Wall = { id: string; start: [number, number]; end: [number, number]; height: number; thickness: number; color?: string; sourceWallIds?: string[] };
export type Opening = { id: string; wallId: string; kind: 'door' | 'window'; position: number; width: number; height: number; sillHeight: number; color?: string };
export type Roof = { enabled: boolean; color: string; thickness: number; overhang: number };
export type ModelData = { walls: Wall[]; openings?: Opening[]; roof?: Roof; units: string; unitsInferred?: boolean; floorThickness: number; floorColor?: string; source: 'dxf' | 'manual'; scale?: number; displayUnit?: string };
export type Project = { id: string; name: string; description?: string | null; status: string; source_file_path?: string | null; source_format?: string | null; model_data?: ModelData | null; created_at: string; updated_at: string };
