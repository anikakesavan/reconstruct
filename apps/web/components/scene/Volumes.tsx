"use client";
import { useRef } from "react";
import { Edges } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useStudio } from "@/lib/store";
import type { Volume } from "@/lib/types";

const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
const SNAP = 0.05;

function VolumeBox({ v }: { v: Volume }) {
  const selected = useStudio((s) => s.selectedId === v.id);
  const grab = useRef<{ dx: number; dz: number } | null>(null);

  const down = (e: ThreeEvent<PointerEvent>) => {
    const s = useStudio.getState();
    if (s.tool !== "select" || s.view === "walk") return;
    e.stopPropagation();
    s.select(v.id);
    if (!e.ray.intersectPlane(floor, hit)) return;
    grab.current = { dx: v.x - hit.x, dz: v.z - hit.z };
    (e.target as Element).setPointerCapture(e.pointerId);
    s.setDragging(true);
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!grab.current || !e.ray.intersectPlane(floor, hit)) return;
    e.stopPropagation();
    const snap = (n: number) => Math.round(n / SNAP) * SNAP;
    useStudio.getState().updateVolume(v.id, { x: snap(hit.x + grab.current.dx), z: snap(hit.z + grab.current.dz) });
  };
  const up = (e: ThreeEvent<PointerEvent>) => {
    if (!grab.current) return;
    grab.current = null;
    (e.target as Element).releasePointerCapture(e.pointerId);
    useStudio.getState().setDragging(false);
  };

  return (
    <mesh
      position={[v.x, v.size[1] / 2 + 0.005, v.z]}
      rotation={[0, (v.quarterTurns * Math.PI) / 2, 0]}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      onClick={(e) => e.stopPropagation()}
    >
      <boxGeometry args={v.size} />
      <meshBasicMaterial color={selected ? "#f2c230" : "#f3f5f4"} transparent opacity={selected ? 0.82 : 0.9} toneMapped={false} />
      <Edges color="#12211d" lineWidth={selected ? 2 : 1} />
    </mesh>
  );
}

export function Volumes() {
  const volumes = useStudio((s) => s.volumes);
  return <>{volumes.map((v) => <VolumeBox key={v.id} v={v} />)}</>;
}
