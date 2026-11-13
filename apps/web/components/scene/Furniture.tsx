"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { ITEM, modelUrl, sizes } from "@/lib/catalog";
import { useStudio } from "@/lib/store";
import type { Placed, Vec3 } from "@/lib/types";
import { Bed, Chair, Desk, Print, Rug } from "./Built";
import { ACCENT } from "./materials";

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();

/** A catalogue model, re-centred so its footprint sits on the origin and its base on y = 0. */
function Model({ item, tint, onSize }: { item: string; tint: string | null; onSize: (s: Vec3) => void }) {
  const { scene } = useGLTF(modelUrl(item));
  const yaw = ITEM[item]?.yaw ?? 0;
  const { holder, size } = useMemo(() => {
    const root = scene.clone(true);
    root.rotation.y = yaw; root.scale.setScalar(ITEM[item]?.scale ?? 1); root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const s = box.getSize(new THREE.Vector3());
    root.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = true;
      const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => {
        const c = (x as THREE.MeshStandardMaterial).clone();
        c.userData.base = c.color.clone(); c.envMapIntensity = 0.8;
        return c;
      });
      m.material = Array.isArray(m.material) ? mats : mats[0];
    });
    const g = new THREE.Group(); g.add(root);
    return { holder: g, size: [s.x, s.y, s.z] as Vec3 };
  }, [scene, yaw]);

  useEffect(() => { sizes.set(item, size); onSize(size); }, [item, size, onSize]);
  useEffect(() => {
    holder.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => {
        const mat = x as THREE.MeshStandardMaterial;
        mat.color.copy(mat.userData.base);
        if (tint) mat.color.multiply(new THREE.Color(tint));
      });
    });
  }, [holder, tint]);
  return <primitive object={holder} />;
}

function Frame({ size }: { size: Vec3 }) {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(size[0] + 0.04, size[1] + 0.04, size[2] + 0.04)), [size]);
  return (
    <lineSegments geometry={geo} position={[0, size[1] / 2, 0]} renderOrder={5} raycast={() => null}>
      <lineBasicMaterial color={ACCENT} depthTest={false} transparent opacity={0.95} />
    </lineSegments>
  );
}

export function PlacedObject({ o }: { o: Placed }) {
  const def = ITEM[o.item];
  const selected = useStudio((s) => s.selectedId === o.id);
  const grab = useRef<{ dx: number; dz: number } | null>(null);
  const sizeRef = useRef<Vec3 | null>(def?.size ?? sizes.get(o.item) ?? null);
  const [, redraw] = useState(0); // re-render the selection frame once a model reports its size
  if (!def) return null;

  const down = (e: ThreeEvent<PointerEvent>) => {
    const s = useStudio.getState();
    if (s.tool !== "select" || s.view === "walk") return;
    e.stopPropagation();
    s.select(o.id);
    if (!e.ray.intersectPlane(floorPlane, hit)) return;
    grab.current = { dx: o.x - hit.x, dz: o.z - hit.z };
    (e.target as Element).setPointerCapture(e.pointerId);
    s.beginDrag();
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!grab.current || !e.ray.intersectPlane(floorPlane, hit)) return;
    e.stopPropagation();
    useStudio.getState().nudge(o.id, hit.x + grab.current.dx, hit.z + grab.current.dz);
  };
  const up = (e: ThreeEvent<PointerEvent>) => {
    if (!grab.current) return;
    grab.current = null;
    (e.target as Element).releasePointerCapture(e.pointerId);
    useStudio.getState().endDrag();
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    const s = useStudio.getState();
    if (s.tool === "measure" && e.delta <= 4) { e.stopPropagation(); s.addMeasurePoint([e.point.x, e.point.y, e.point.z]); }
    else e.stopPropagation();
  };

  const fabric = o.tint ?? def.fabric ?? "#f4f1ea";
  const finish = o.finish ?? "oak_veneer_01";
  return (
    <group position={[o.x, o.y, o.z]} rotation={[0, o.rot, 0]} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={click}>
      <Suspense fallback={null}>
        {def.kind === "model" && <Model item={o.item} tint={o.tint} onSize={(s) => { if (!sizeRef.current) { sizeRef.current = s; redraw((n) => n + 1); } else sizeRef.current = s; }} />}
        {def.kind === "built" && def.category === "Beds" && <Bed size={def.size!} finish={finish} fabric={fabric} />}
        {def.kind === "built" && def.id === "desk" && <Desk size={def.size!} finish={finish} />}
        {def.kind === "built" && def.category === "Rugs" && <Rug size={def.size!} fabric={fabric} />}
        {def.kind === "built" && def.id === "chair" && <Chair size={def.size!} finish={finish} fabric={fabric} />}
        {def.kind === "built" && def.id === "print" && <Print size={def.size!} finish={finish} fabric={fabric} />}
      </Suspense>
      {selected && (sizes.get(o.item) ?? sizeRef.current) && <Frame size={(sizes.get(o.item) ?? sizeRef.current)!} />}
    </group>
  );
}

export function Furniture() {
  const objects = useStudio((s) => s.objects);
  return <>{objects.map((o) => <PlacedObject key={o.id} o={o} />)}</>;
}
