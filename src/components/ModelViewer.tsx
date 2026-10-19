'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ModelData } from '@/lib/types';
import { createModelScene } from '@/lib/model-scene';

type ModelViewerProps = {
  data: ModelData;
  scale: number;
  wireframe?: boolean;
  resetKey?: number;
  selectedWallId?: string | null;
  onWallSelect?: (id: string) => void;
};

export default function ModelViewer({ data, scale, wireframe = false, resetKey = 0, selectedWallId = null, onWallSelect }: ModelViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wallMeshesRef = useRef(new Map<string, THREE.Mesh[]>());
  const selectedWallIdRef = useRef(selectedWallId);
  const onWallSelectRef = useRef(onWallSelect);

  useEffect(() => { selectedWallIdRef.current = selectedWallId; }, [selectedWallId]);
  useEffect(() => { onWallSelectRef.current = onWallSelect; }, [onWallSelect]);

  useEffect(() => {
    wallMeshesRef.current.forEach((meshes, id) => {
      meshes.forEach(mesh => {
        const selected = (mesh.userData.wallIds as string[] | undefined)?.includes(selectedWallId ?? '') ?? id === selectedWallId;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach(material => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.emissive.set(selected ? '#3730a3' : '#000000');
          material.emissiveIntensity = selected ? 0.32 : 0;
        }
      });
      });
    });
  }, [selectedWallId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      host.dataset.viewerError = 'true';
      host.textContent = 'WebGL is unavailable in this browser, so the 3D viewport could not start.';
      return;
    }

    host.removeAttribute('data-viewer-error');
    host.textContent = '';
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e9eef7');
    const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 10000);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight('#ffffff', 1.7));
    const keyLight = new THREE.DirectionalLight('#ffffff', 2.2);
    keyLight.position.set(8, 12, 6);
    keyLight.castShadow = true;
    keyLight.shadow.bias = -0.0001;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);
    scene.add(new THREE.GridHelper(100, 100, '#8793a8', '#c7cfdd'));
    scene.add(new THREE.AxesHelper(2));

    const { group: modelGroup, wallMeshes } = createModelScene(data, scale, wireframe);
    wallMeshes.forEach((meshes, id) => { for (const mesh of meshes) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      const selected = (mesh.userData.wallIds as string[] | undefined)?.includes(selectedWallIdRef.current ?? '') ?? id === selectedWallIdRef.current;
      material.emissive.set(selected ? '#3730a3' : '#000000');
      material.emissiveIntensity = selected ? 0.32 : 0;
      mesh.receiveShadow = false;
    } });
    wallMeshesRef.current = wallMeshes;
    scene.add(modelGroup);

    const bounds = new THREE.Box3().setFromObject(modelGroup);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z, 1);
    const distance = maxDimension * 1.65;
    camera.position.set(center.x + distance * 0.85, center.y + distance * 0.7, center.z + distance);
    camera.near = Math.max(0.01, maxDimension / 1000);
    camera.far = Math.max(1000, maxDimension * 100);
    camera.lookAt(center);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pickWall = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const pickableMeshes = Array.from(new Set(Array.from(wallMeshes.values()).flat()));
      const hit = raycaster.intersectObjects(pickableMeshes, false)[0];
      const sidebarWallId = hit?.object.userData.sidebarWallId as string | undefined;
      if (sidebarWallId) onWallSelectRef.current?.(sidebarWallId);
    };
    renderer.domElement.addEventListener('click', pickWall);

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    let frame = 0;
    const render = () => {
      frame = requestAnimationFrame(render);
      controls.update();
      renderer.render(scene, camera);
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('click', pickWall);
      wallMeshesRef.current = new Map();
      modelGroup.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [data, scale, wireframe, resetKey]);

  return <div
    ref={hostRef}
    className="model-viewer-canvas"
    role="img"
    aria-label="Interactive 3D model. Drag to orbit, scroll to zoom, and right-drag to pan."
  />;
}
