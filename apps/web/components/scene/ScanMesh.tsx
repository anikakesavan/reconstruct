"use client";
import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import { useStudio } from "@/lib/store";
import type { Probe } from "@/lib/types";


function classify(normalY: number): Probe["surface"] {
  if (normalY > 0.9) return "floor";
  if (normalY < -0.9) return "ceiling or underside";
  if (Math.abs(normalY) < 0.2) return "wall";
  return "sloped or furniture";
}

/**
 * The captured room. Rendered unlit with its captured vertex colours: the scan's
 * appearance already contains the real lighting, so relighting it would be a lie.
 */
export function ScanMesh({ url }: { url: string }) {
  const gltf = useGLTF(url);
  const calibration = useStudio((s) => s.calibration);
  const setScanReady = useStudio((s) => s.setScanReady);

  const mesh = useMemo(() => {
    let found: THREE.Mesh | null = null;
    gltf.scene.traverse((o) => { if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh; });
    if (!found) throw new Error("Scan file contains no mesh");
    const src = (found as THREE.Mesh).geometry;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", src.getAttribute("position"));
    geometry.setIndex(src.getIndex());
    // The file stores captured sRGB bytes; three expects linear vertex colours.
    const c = src.getAttribute("color");
    const linear = new Float32Array(c.count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < c.count; i++) {
      col.setRGB(c.getX(i), c.getY(i), c.getZ(i), THREE.SRGBColorSpace);
      linear[i * 3] = col.r; linear[i * 3 + 1] = col.g; linear[i * 3 + 2] = col.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(linear, 3));
    // drei bundles its own copy of three-mesh-bvh types, so assign through a neutral shape.
    (geometry as unknown as { boundsTree: MeshBVH }).boundsTree = new MeshBVH(geometry);
    const m = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    m.raycast = acceleratedRaycast;
    m.name = "scan";
    return m;
  }, [gltf]);

  useEffect(() => { setScanReady(); }, [mesh, setScanReady]);
  const gain = useStudio((s) => s.gain);
  useEffect(() => { (mesh.material as THREE.MeshBasicMaterial).color.setScalar(gain); }, [mesh, gain]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return; // a drag, not a click
    const { tool, addMeasurePoint, setProbe, select } = useStudio.getState();
    const p = e.point;
    if (tool === "measure") { e.stopPropagation(); addMeasurePoint([p.x, p.y, p.z]); }
    else if (tool === "inspect") {
      e.stopPropagation();
      setProbe({ point: [p.x, p.y, p.z], surface: classify(e.face?.normal.y ?? 0) });
    } else if (tool === "select") select(null);
  };

  return <primitive object={mesh} scale={calibration} onClick={onClick} />;
}
