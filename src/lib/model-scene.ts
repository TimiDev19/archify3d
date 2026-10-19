import * as THREE from 'three';
import type { ModelData, Opening, Wall } from '@/lib/types';
import { resolveWallJunctions, uniqueWalls } from '@/lib/wall-geometry';

export function createModelScene(data: ModelData, scale: number, wireframe = false) {
  const group = new THREE.Group();
  const walls = resolveWallJunctions(uniqueWalls(data.walls, scale), scale);
  const wallMeshes = new Map<string, THREE.Mesh[]>();
  const box = (name: string, size: [number, number, number], position: [number, number, number], color: string, wall?: Wall) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color, roughness: .78, wireframe, ...(name.includes('Glass') ? { transparent: true, opacity: .48, metalness: .15, roughness: .2 } : {}) }));
    mesh.name = name;
    if (wall) {
      mesh.userData.sidebarWallId = wall.id.replace(/:part\d+$/, '');
      mesh.userData.wallIds = wall.sourceWallIds ?? [wall.id];
      for (const id of mesh.userData.wallIds as string[]) wallMeshes.set(id, [...(wallMeshes.get(id) ?? []), mesh]);
    }
    mesh.position.set(...position);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  for (const wall of walls) {
    const dx = (wall.end[0] - wall.start[0]) * scale, dz = (wall.end[1] - wall.start[1]) * scale;
    const length = Math.hypot(dx, dz), cx = ((wall.start[0] + wall.end[0]) / 2) * scale, cz = ((wall.start[1] + wall.end[1]) / 2) * scale;
    const aliases = wall.sourceWallIds ?? [wall.id];
    const openings = (data.openings ?? []).filter(o => aliases.includes(o.wallId)).flatMap(o => {
      const original = data.walls.find(candidate => candidate.id === o.wallId || candidate.sourceWallIds?.includes(o.wallId));
      if (!original) return [];
      const ox=(original.end[0]-original.start[0])*scale, oz=(original.end[1]-original.start[1])*scale, originalLength=Math.hypot(ox,oz);
      if (!originalLength) return [];
      const ux=ox/originalLength, uz=oz/originalLength;
      const distance=(point:[number,number]) => ((point[0]-original.start[0])*scale)*ux+((point[1]-original.start[1])*scale)*uz;
      const from=distance(wall.start), to=distance(wall.end), target=o.position*originalLength;
      const center=to>=from?target-from:from-target;
      const width=Math.min(o.width,length);
      return center+width/2>0 && center-width/2<length ? [{...o,center,width}] : [];
    });
    const xs = Array.from(new Set([0, length, ...openings.flatMap(o => [Math.max(0, o.center - o.width / 2), Math.min(length, o.center + o.width / 2)])])).sort((a,b) => a-b);
    const ys = Array.from(new Set([0, wall.height, ...openings.flatMap(o => [Math.max(0, o.sillHeight), Math.min(wall.height, o.sillHeight + o.height)])])).sort((a,b) => a-b);
    for (let xi = 0; xi < xs.length - 1; xi++) for (let yi = 0; yi < ys.length - 1; yi++) {
      const x0=xs[xi], x1=xs[xi+1], y0=ys[yi], y1=ys[yi+1], mx=(x0+x1)/2, my=(y0+y1)/2;
      if (openings.some(o => mx > o.center-o.width/2 && mx < o.center+o.width/2 && my > o.sillHeight && my < o.sillHeight+o.height)) continue;
      const mesh = box(wall.id, [x1-x0,y1-y0,wall.thickness], [cx+(mx-length/2)*Math.cos(Math.atan2(dz,dx)), (y0+y1)/2, cz+(mx-length/2)*Math.sin(Math.atan2(dz,dx))], wall.color ?? '#cbd5e1', wall);
      mesh.rotation.y = -Math.atan2(dz,dx);
    }
    for (const opening of openings) {
      const w = opening.width, h = opening.height, sill = opening.sillHeight;
      const center = opening.center;
      const alongX = cx+(center-length/2)*Math.cos(Math.atan2(dz,dx)), alongZ = cz+(center-length/2)*Math.sin(Math.atan2(dz,dx));
      if (opening.kind === 'door') {
        const leaf = box(`Door ${opening.id}`, [Math.max(.04,w-.06),Math.max(.1,h-.04),.035], [alongX,sill+h/2,alongZ], opening.color ?? '#8b5e3c');
        leaf.rotation.y=-Math.atan2(dz,dx);
      } else {
        const frame='#f8fafc', t=.06, zOffset=wall.thickness/2+.012;
        const pane=box(`Window Glass ${opening.id}`,[Math.max(.03,w-2*t),Math.max(.03,h-2*t),.025],[alongX,sill+h/2,alongZ],opening.color??'#93c5fd'); pane.rotation.y=-Math.atan2(dz,dx);
        for(const [name,ww,hh,xx,yy] of [['Window frame',w,t,0,sill+h/2-h/2+t/2],['Window frame',w,t,0,sill+h/2+h/2-t/2],['Window frame',t,h,-w/2+t/2,sill+h/2],['Window frame',t,h,w/2-t/2,sill+h/2]] as const){
          const fx=alongX+xx*Math.cos(Math.atan2(dz,dx)), fz=alongZ+xx*Math.sin(Math.atan2(dz,dx)); const m=box(`${name} ${opening.id}`,[ww,hh,.06],[fx,yy,fz],frame);m.rotation.y=-Math.atan2(dz,dx);
        }
      }
    }
  }
  const points = walls.flatMap(w => [w.start,w.end]);
  const xs=points.map(p=>p[0]*scale), zs=points.map(p=>p[1]*scale);
  const minX=xs.length?Math.min(...xs):-2,maxX=xs.length?Math.max(...xs):2,minZ=zs.length?Math.min(...zs):-2,maxZ=zs.length?Math.max(...zs):2;
  const floor=box('Floor slab',[Math.max(1,maxX-minX+.6),data.floorThickness,Math.max(1,maxZ-minZ+.6)],[(minX+maxX)/2,-data.floorThickness/2-.005,(minZ+maxZ)/2],data.floorColor??'#e2e8f0');
  floor.receiveShadow=true;
  if (data.roof?.enabled) box('Flat roof',[Math.max(1,maxX-minX+.6+data.roof.overhang*2),data.roof.thickness,Math.max(1,maxZ-minZ+.6+data.roof.overhang*2)],[(minX+maxX)/2,Math.max(2.8,...walls.map(w=>w.height))+data.roof.thickness/2,(minZ+maxZ)/2],data.roof.color);
  return { group, walls, wallMeshes };
}
