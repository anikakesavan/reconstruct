"use client";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { ITEM, modelUrl } from "@/lib/catalog";
import { dims } from "@/lib/placement";
import { ROT_STEP, useStudio } from "@/lib/store";
import type { Placed, Vec3 } from "@/lib/types";
import { ACCENT } from "./materials";
import { recolour } from "./recolor";

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
const BAD = "#c2412d";

/** A catalogue model, re-centred so its footprint sits on the origin and its base on y = 0, facing +Z. */
export function Model({ item, colors }: { item: string; colors: (string | null)[] }) {
  const def = ITEM[item];
  const { scene } = useGLTF(modelUrl(item));
  const invalidate = useThree((s) => s.invalidate);
  const holder = useMemo(() => {
    const root = scene.clone(true);
    root.rotation.y = (def.yaw * Math.PI) / 180; root.scale.setScalar(def.scale); root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    root.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    root.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = def.place !== "rug" ? true : true;
      const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => {
        const c = (x as THREE.MeshStandardMaterial).clone(); c.userData.baseMap = c.map; c.envMapIntensity = 0.8; return c;
      });
      m.material = Array.isArray(m.material) ? mats : mats[0];
    });
    const g = new THREE.Group(); g.add(root); return g;
  }, [scene, def]);

  const key = colors.join(",");
  useEffect(() => {
    let stale = false;
    holder.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => {
        const mat = x as THREE.MeshStandardMaterial; const base = mat.userData.baseMap as THREE.Texture | null;
        if (!base || (def.partsMaterial && mat.name && mat.name !== def.partsMaterial)) return;
        recolour(def, base, colors).then((tex) => { if (!stale) { mat.map = tex; mat.needsUpdate = true; invalidate(); } }).catch(() => { /* keep the original */ });
      });
    });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holder, key]);
  return <primitive object={holder} />;
}

/** Selection box with a handle at the front for turning. */
function Frame({ o, size, bad }: { o: Placed; size: Vec3; bad: boolean }) {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(size[0] + 0.04, size[1] + 0.04, size[2] + 0.04)), [size]);
  const turning = useRef(false);
  const canTurn = ITEM[o.item]?.place !== "wall";
  const color = bad ? BAD : ACCENT;
  const down = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation(); turning.current = true;
    (e.target as Element).setPointerCapture(e.pointerId); useStudio.getState().beginDrag();
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!turning.current || !e.ray.intersectPlane(floorPlane, hit)) return;
    e.stopPropagation();
    // the handle sits on the piece's +Z side, so point +Z at the pointer
    const angle = Math.atan2(hit.x - o.x, hit.z - o.z);
    useStudio.getState().rotateTo(o.id, Math.round(angle / ROT_STEP) * ROT_STEP);
  };
  const up = (e: ThreeEvent<PointerEvent>) => {
    if (!turning.current) return; turning.current = false;
    (e.target as Element).releasePointerCapture(e.pointerId); useStudio.getState().endDrag();
  };
  const reach = size[2] / 2 + 0.28;
  return (
    <>
      <lineSegments geometry={geo} position={[0, size[1] / 2, 0]} renderOrder={5} raycast={() => null}>
        <lineBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
      </lineSegments>
      {canTurn && (
        <group position={[0, 0.02 - o.y, 0]}>
          <mesh position={[0, 0, (size[2] / 2 + reach) / 2]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={6} raycast={() => null}>
            <planeGeometry args={[0.015, reach - size[2] / 2]} /><meshBasicMaterial color={color} depthTest={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, reach]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={7}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={(e) => e.stopPropagation()}>
            <circleGeometry args={[0.1, 28]} /><meshBasicMaterial color={color} depthTest={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.001, reach]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={8} raycast={() => null}>
            <ringGeometry args={[0.035, 0.055, 24, 1, 0.6, 5]} /><meshBasicMaterial color="#ffffff" depthTest={false} toneMapped={false} />
          </mesh>
        </group>
      )}
    </>
  );
}

export function PlacedObject({ o }: { o: Placed }) {
  const def = ITEM[o.item];
  const selected = useStudio((s) => s.selectedId === o.id);
  const bad = useStudio((s) => s.invalidId === o.id);
  const grab = useRef<{ dx: number; dz: number } | null>(null);
  const group = useRef<THREE.Group>(null);
  // things hung on a wall hide with that wall when the camera is behind it
  useFrame(({ camera }) => {
    if (!group.current || def?.place !== "wall") return;
    group.current.visible = (camera.position.x - o.x) * Math.sin(o.rot) + (camera.position.z - o.z) * Math.cos(o.rot) > 0;
  });
  if (!def) return null;
  const size = dims(o);

  const down = (e: ThreeEvent<PointerEvent>) => {
    const s = useStudio.getState();
    if (s.tool !== "select" || s.view === "walk" || s.comparing) return;
    e.stopPropagation(); s.select(o.id);
    if (!e.ray.intersectPlane(floorPlane, hit)) return;
    grab.current = { dx: o.x - hit.x, dz: o.z - hit.z };
    (e.target as Element).setPointerCapture(e.pointerId); s.beginDrag();
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!grab.current || !e.ray.intersectPlane(floorPlane, hit)) return;
    e.stopPropagation();
    useStudio.getState().dragTo(o.id, hit.x + grab.current.dx, hit.z + grab.current.dz);
  };
  const up = (e: ThreeEvent<PointerEvent>) => {
    if (!grab.current) return; grab.current = null;
    (e.target as Element).releasePointerCapture(e.pointerId); useStudio.getState().endDrag();
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    const s = useStudio.getState();
    if (s.tool === "measure" && e.delta <= 4) s.addMeasurePoint([e.point.x, e.point.y, e.point.z]);
    e.stopPropagation();
  };
  return (
    <group ref={group} position={[o.x, o.y, o.z]} rotation={[0, o.rot, 0]}>
      <group scale={o.scale} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={click}>
        <Suspense fallback={<mesh position={[0, def.size[1] / 2, 0]}><boxGeometry args={def.size} /><meshStandardMaterial color="#e9ebe7" transparent opacity={0.6} /></mesh>}>
          <Model item={o.item} colors={o.colors} />
        </Suspense>
      </group>
      {(selected || bad) && <Frame o={o} size={size} bad={bad} />}
    </group>
  );
}

export function Furniture({ objects }: { objects?: Placed[] }) {
  const live = useStudio((s) => s.objects);
  return <>{(objects ?? live).map((o) => <PlacedObject key={o.id} o={o} />)}</>;
}
