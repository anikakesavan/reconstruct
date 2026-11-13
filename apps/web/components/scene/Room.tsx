"use client";
import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { FLOORS } from "@/lib/catalog";
import { WALLS, wallFrame } from "@/lib/placement";
import { useStudio } from "@/lib/store";
import type { Opening, Room as RoomData, WallId } from "@/lib/types";
import { usePBR } from "./materials";

const TRIM = "#fbfaf7";

function onSurfaceClick(e: ThreeEvent<MouseEvent>) {
  if (e.delta > 4) return;
  const s = useStudio.getState();
  if (s.tool === "measure") { e.stopPropagation(); s.addMeasurePoint([e.point.x, e.point.y, e.point.z]); }
  else s.select(null);
}

/** Window or door, drawn in the wall's own frame: x along the wall, y up, z into the room. */
function OpeningParts({ o }: { o: Opening }) {
  const f = 0.05, d = 0.09, cy = o.sill + o.height / 2;
  const trim = <meshStandardMaterial color={TRIM} roughness={0.55} />;
  if (o.kind === "door") {
    return (
      <group position={[o.centre, cy, 0]}>
        <mesh position={[0, 0, 0.012]} castShadow><boxGeometry args={[o.width - 0.02, o.height - 0.02, 0.04]} /><meshStandardMaterial color="#f6f4ee" roughness={0.5} /></mesh>
        <mesh position={[o.width / 2 - 0.09, -0.05, 0.05]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.011, 0.011, 0.12, 12]} /><meshStandardMaterial color="#8d8a84" metalness={0.9} roughness={0.35} /></mesh>
        {[[-o.width / 2, 0, f, o.height + f], [o.width / 2, 0, f, o.height + f], [0, o.height / 2, o.width + f, f]].map(([px, py, w, h], i) => (
          <mesh key={i} position={[px, py, 0.02]} castShadow><boxGeometry args={[w, h, d]} />{trim}</mesh>
        ))}
      </group>
    );
  }
  return (
    <group position={[o.centre, cy, 0]}>
      {/* daylight seen through the glass: a plain bright panel, not an image of a real view */}
      <mesh position={[0, 0, -0.25]}><planeGeometry args={[o.width + 0.5, o.height + 0.5]} /><meshBasicMaterial color="#f4f8fb" toneMapped={false} /></mesh>
      <mesh position={[0, 0, 0.01]}><planeGeometry args={[o.width, o.height]} /><meshPhysicalMaterial color="#ffffff" transparent opacity={0.1} roughness={0.02} /></mesh>
      {[[-o.width / 2, 0, f, o.height + f], [o.width / 2, 0, f, o.height + f], [0, o.height / 2, o.width + f, f], [0, -o.height / 2, o.width + f, f], [0, 0, 0.035, o.height]].map(([px, py, w, h], i) => (
        <mesh key={i} position={[px, py, 0.02]} castShadow><boxGeometry args={[w, h, d]} />{trim}</mesh>
      ))}
      <mesh position={[0, -o.height / 2 - 0.02, 0.09]} castShadow><boxGeometry args={[o.width + 0.16, 0.035, 0.2]} />{trim}</mesh>
    </group>
  );
}

function Wall({ id, room, length, height, color, openings }: { id: WallId; room: RoomData; length: number; height: number; color: string; openings: Opening[] }) {
  const f = wallFrame(id, room);
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-length / 2, 0); shape.lineTo(length / 2, 0); shape.lineTo(length / 2, height); shape.lineTo(-length / 2, height); shape.closePath();
    openings.forEach((o) => {
      const y0 = Math.max(0.002, o.sill), y1 = Math.min(height - 0.02, o.sill + o.height);
      const hole = new THREE.Path();
      hole.moveTo(o.centre - o.width / 2, y0); hole.lineTo(o.centre + o.width / 2, y0); hole.lineTo(o.centre + o.width / 2, y1); hole.lineTo(o.centre - o.width / 2, y1); hole.closePath();
      shape.holes.push(hole);
    });
    return new THREE.ShapeGeometry(shape);
  }, [length, height, openings]);
  // Doors and window frames are solid, so hide them along with their wall when the camera is behind it.
  const solid = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (!solid.current) return;
    const nx = Math.sin(f.rot), nz = Math.cos(f.rot);
    solid.current.visible = (camera.position.x - f.origin[0]) * nx + (camera.position.z - f.origin[1]) * nz > 0;
  });
  const SK = 0.09;
  // skirting runs between doors
  const doors = openings.filter((o) => o.kind === "door").sort((a, b) => a.centre - b.centre);
  const runs: [number, number][] = []; let from = -length / 2;
  doors.forEach((dr) => { runs.push([from, dr.centre - dr.width / 2 - 0.03]); from = dr.centre + dr.width / 2 + 0.03; }); runs.push([from, length / 2]);
  return (
    <group position={[f.origin[0], 0, f.origin[1]]} rotation={[0, f.rot, 0]}>
      {/* single-sided and facing inward, so the walls nearest the camera disappear and you can see in.
          A little self-light stands in for the light that bounces between real walls. */}
      <mesh geometry={geometry} receiveShadow onClick={onSurfaceClick}><meshStandardMaterial color={color} roughness={0.92} emissive={color} emissiveIntensity={0.22} /></mesh>
      {runs.filter(([a, b]) => b - a > 0.05).map(([a, b]) => (
        <mesh key={a} position={[(a + b) / 2, SK / 2, 0.008]}><planeGeometry args={[b - a, SK]} /><meshStandardMaterial color={TRIM} roughness={0.6} /></mesh>
      ))}
      <group ref={solid}>{openings.map((o) => <OpeningParts key={o.id} o={o} />)}</group>
    </group>
  );
}

/** Walls, floor, windows, doors and skirting generated from the room's numbers. Every part is its own mesh. */
export function Room({ room: given }: { room?: RoomData }) {
  const live = useStudio((s) => s.room);
  const room = given ?? live;
  const walk = useStudio((s) => s.view === "walk");
  const { width: w, depth: d, height: h } = room;
  const floorDef = FLOORS.find((f) => f.id === room.floor) ?? FLOORS[0];
  const floor = usePBR(floorDef.id, w / floorDef.repeat, d / floorDef.repeat);
  return (
    <group>
      <mesh position={[0, -0.06, 0]} receiveShadow onClick={onSurfaceClick}>
        <boxGeometry args={[w + 0.02, 0.12, d + 0.02]} />
        <meshStandardMaterial attach="material-0" color="#d9d6cf" /><meshStandardMaterial attach="material-1" color="#d9d6cf" />
        <meshStandardMaterial attach="material-2" {...floor} roughness={0.85} envMapIntensity={0.6} />
        <meshStandardMaterial attach="material-3" color="#d9d6cf" /><meshStandardMaterial attach="material-4" color="#d9d6cf" />
        <meshStandardMaterial attach="material-5" color="#d9d6cf" />
      </mesh>
      {WALLS.map((id) => (
        <Wall key={id} id={id} room={room} length={id === "back" || id === "front" ? w : d} height={h} color={room.wallColor} openings={room.openings.filter((o) => o.wall === id)} />
      ))}
      {walk && (
        <mesh position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[w, d]} /><meshStandardMaterial color="#fbfaf7" roughness={1} emissive="#fbfaf7" emissiveIntensity={0.55} /></mesh>
      )}
    </group>
  );
}
