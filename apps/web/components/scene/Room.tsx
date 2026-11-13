"use client";
import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { FLOORS } from "@/lib/catalog";
import { useStudio } from "@/lib/store";
import { usePBR } from "./materials";

const WIN = { width: 1.2, height: 1.35, sill: 0.92 };
const TRIM = "#fbfaf7";

/** Window centres along the back wall for a given room width. */
export function windowCentres(width: number): number[] {
  if (width < 2.6) return [0];
  const off = Math.min(width / 2 - WIN.width / 2 - 0.45, width * 0.26);
  return [-off, off];
}

function onSurfaceClick(e: ThreeEvent<MouseEvent>) {
  if (e.delta > 4) return;
  const s = useStudio.getState();
  if (s.tool === "measure") { e.stopPropagation(); s.addMeasurePoint([e.point.x, e.point.y, e.point.z]); }
  else s.select(null);
}

function Window({ x, z, height }: { x: number; z: number; height: number }) {
  const h = Math.min(WIN.height, height - WIN.sill - 0.25);
  const cy = WIN.sill + h / 2, f = 0.05, d = 0.09;
  return (
    <group position={[x, cy, z]}>
      {/* daylight seen through the glass: a plain bright panel, not an image of a real view */}
      <mesh position={[0, 0, -0.25]}><planeGeometry args={[WIN.width + 0.5, h + 0.5]} /><meshBasicMaterial color="#f4f8fb" toneMapped={false} /></mesh>
      <mesh position={[0, 0, 0.01]}><planeGeometry args={[WIN.width, h]} /><meshPhysicalMaterial color="#ffffff" transparent opacity={0.1} roughness={0.02} metalness={0} /></mesh>
      {[[-WIN.width / 2, 0, f, h + f], [WIN.width / 2, 0, f, h + f], [0, h / 2, WIN.width + f, f], [0, -h / 2, WIN.width + f, f], [0, 0, 0.035, h]].map(([px, py, w, hh], i) => (
        <mesh key={i} position={[px, py, 0.02]} castShadow><boxGeometry args={[w, hh, d]} /><meshStandardMaterial color={TRIM} roughness={0.55} /></mesh>
      ))}
      <mesh position={[0, -h / 2 - 0.02, 0.09]} castShadow><boxGeometry args={[WIN.width + 0.16, 0.035, 0.2]} /><meshStandardMaterial color={TRIM} roughness={0.5} /></mesh>
    </group>
  );
}

/** Four walls, a floor, windows and skirting, all generated from the room's numbers. Every part is its own mesh. */
export function Room() {
  const room = useStudio((s) => s.room);
  const walk = useStudio((s) => s.view === "walk");
  const { width: w, depth: d, height: h } = room;
  const floorDef = FLOORS.find((f) => f.id === room.floor) ?? FLOORS[0];
  const floor = usePBR(floorDef.id, w / floorDef.repeat, d / floorDef.repeat);
  const centres = useMemo(() => windowCentres(w), [w]);

  const backWall = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h); shape.lineTo(-w / 2, h); shape.closePath();
    const wh = Math.min(WIN.height, h - WIN.sill - 0.25);
    centres.forEach((cx) => {
      const hole = new THREE.Path();
      hole.moveTo(cx - WIN.width / 2, WIN.sill); hole.lineTo(cx + WIN.width / 2, WIN.sill);
      hole.lineTo(cx + WIN.width / 2, WIN.sill + wh); hole.lineTo(cx - WIN.width / 2, WIN.sill + wh); hole.closePath();
      shape.holes.push(hole);
    });
    return new THREE.ShapeGeometry(shape);
  }, [w, h, centres]);

  // a little self-light stands in for the light that bounces between real walls, which this renderer does not simulate
  const wall = <meshStandardMaterial color={room.wallColor} roughness={0.92} emissive={room.wallColor} emissiveIntensity={0.1} />;
  const skirt = <meshStandardMaterial color={TRIM} roughness={0.6} />;
  const SK = 0.09;
  return (
    <group>
      <mesh position={[0, -0.06, 0]} receiveShadow onClick={onSurfaceClick}>
        <boxGeometry args={[w + 0.02, 0.12, d + 0.02]} />
        <meshStandardMaterial attach="material-0" color="#d9d6cf" /><meshStandardMaterial attach="material-1" color="#d9d6cf" />
        <meshStandardMaterial attach="material-2" {...floor} roughness={0.85} envMapIntensity={0.6} />
        <meshStandardMaterial attach="material-3" color="#d9d6cf" /><meshStandardMaterial attach="material-4" color="#d9d6cf" />
        <meshStandardMaterial attach="material-5" color="#d9d6cf" />
      </mesh>
      {/* walls are single-sided and face inward, so the ones nearest the camera disappear and you can see in */}
      <mesh geometry={backWall} position={[0, 0, -d / 2]} receiveShadow onClick={onSurfaceClick}>{wall}</mesh>
      <mesh position={[0, h / 2, d / 2]} rotation={[0, Math.PI, 0]} receiveShadow onClick={onSurfaceClick}><planeGeometry args={[w, h]} />{wall}</mesh>
      <mesh position={[-w / 2, h / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow onClick={onSurfaceClick}><planeGeometry args={[d, h]} />{wall}</mesh>
      <mesh position={[w / 2, h / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow onClick={onSurfaceClick}><planeGeometry args={[d, h]} />{wall}</mesh>
      <mesh position={[0, SK / 2, -d / 2 + 0.008]}><planeGeometry args={[w, SK]} />{skirt}</mesh>
      <mesh position={[0, SK / 2, d / 2 - 0.008]} rotation={[0, Math.PI, 0]}><planeGeometry args={[w, SK]} />{skirt}</mesh>
      <mesh position={[-w / 2 + 0.008, SK / 2, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[d, SK]} />{skirt}</mesh>
      <mesh position={[w / 2 - 0.008, SK / 2, 0]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[d, SK]} />{skirt}</mesh>
      {centres.map((cx) => <Window key={cx} x={cx} z={-d / 2} height={h} />)}
      {walk && (
        <mesh position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[w, d]} /><meshStandardMaterial color="#fbfaf7" roughness={1} emissive="#fbfaf7" emissiveIntensity={0.55} /></mesh>
      )}
    </group>
  );
}
