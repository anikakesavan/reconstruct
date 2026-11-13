"use client";
import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import { useStudio } from "@/lib/store";

/**
 * An uploaded scan. Drawn unlit with its captured colours (they already contain the room's real light),
 * and never treated as editable furniture: it is one fused surface, used for looking and measuring.
 */
export function ScanLayer({ url }: { url: string }) {
  const gltf = useGLTF(url);
  const calibration = useStudio((s) => s.calibration);
  const ghost = useStudio((s) => s.showRoom);
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
    mat.transparent = ghost; mat.opacity = ghost ? 0.38 : 1; mat.depthWrite = !ghost; mat.needsUpdate = true;
    // while furnishing a clean room, the ghosted scan must not swallow clicks meant for furniture
    mesh.raycast = ghost && tool !== "measure" ? () => {} : acceleratedRaycast;
  }, [mesh, ghost, tool]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return;
    const s = useStudio.getState();
    if (s.tool === "measure") { e.stopPropagation(); s.addMeasurePoint([e.point.x, e.point.y, e.point.z]); }
  };
  return <primitive object={mesh} scale={calibration} onClick={onClick} />;
}
