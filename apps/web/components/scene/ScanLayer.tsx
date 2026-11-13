"use client";
import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import { useStudio } from "@/lib/store";

/**
 * The raw surface fused from the user's photos, shown half-transparent over the editable room so the two can be compared.
 * Drawn unlit with its captured colours (they already contain the room's real light).
 */
export function ScanLayer({ url, scale = 1 }: { url: string; scale?: number }) {
  const gltf = useGLTF(url);
  const tool = useStudio((s) => s.tool);

  const mesh = useMemo(() => {
    let found: THREE.Mesh | null = null;
    gltf.scene.traverse((o) => { if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh; });
    if (!found) throw new Error("Scan file contains no mesh");
    const src = (found as THREE.Mesh).geometry;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", src.getAttribute("position"));
    geometry.setIndex(src.getIndex());
    const c = src.getAttribute("color"); // stored as sRGB bytes; three wants linear
    const linear = new Float32Array(c.count * 3); const col = new THREE.Color();
    for (let i = 0; i < c.count; i++) {
      col.setRGB(c.getX(i), c.getY(i), c.getZ(i), THREE.SRGBColorSpace);
      linear[i * 3] = col.r; linear[i * 3 + 1] = col.g; linear[i * 3 + 2] = col.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(linear, 3));
    (geometry as unknown as { boundsTree: MeshBVH }).boundsTree = new MeshBVH(geometry);
    return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  }, [gltf]);

  useEffect(() => {
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.transparent = true; mat.opacity = 0.5; mat.depthWrite = false; mat.needsUpdate = true;
    // the overlay must not swallow clicks meant for furniture
    mesh.raycast = tool === "measure" ? acceleratedRaycast : () => {};
  }, [mesh, tool]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return;
    const s = useStudio.getState();
    if (s.tool === "measure") { e.stopPropagation(); s.addMeasurePoint([e.point.x, e.point.y, e.point.z]); }
  };
  return <primitive object={mesh} scale={scale} onClick={onClick} />;
}
