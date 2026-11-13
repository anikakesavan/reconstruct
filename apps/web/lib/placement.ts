import { ITEM } from "./catalog";
import type { Placed, Pose, Room, Vec3, WallId } from "./types";

/** Width, height, depth of a placed piece in metres. */
export function dims(o: Pick<Pose, "item" | "scale">): Vec3 {
  const s = ITEM[o.item]?.size ?? [0.5, 0.5, 0.5];
  return [s[0] * o.scale[0], s[1] * o.scale[1], s[2] * o.scale[2]];
}

/** Footprint corners on the floor, counter-clockwise. */
export function corners(o: Pick<Pose, "item" | "scale" | "x" | "z" | "rot">): [number, number][] {
  const [w, , d] = dims(o); const c = Math.cos(o.rot), s = Math.sin(o.rot);
  return ([[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]] as [number, number][])
    .map(([lx, lz]) => [o.x + lx * c + lz * s, o.z - lx * s + lz * c]);
}

/** Half extents of the axis-aligned box around the rotated footprint. */
export function halfExtents(o: Pick<Pose, "item" | "scale" | "rot">): [number, number] {
  const [w, , d] = dims(o); const c = Math.abs(Math.cos(o.rot)), s = Math.abs(Math.sin(o.rot));
  return [(w * c + d * s) / 2, (w * s + d * c) / 2];
}

/** Separating-axis test for two rotated rectangles, with a small allowance so touching pieces are fine. */
function footprintsOverlap(a: [number, number][], b: [number, number][], slack = 0.02): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % 4];
      const nx = z2 - z1, nz = -(x2 - x1); const len = Math.hypot(nx, nz) || 1;
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const [x, z] of a) { const p = (x * nx + z * nz) / len; minA = Math.min(minA, p); maxA = Math.max(maxA, p); }
      for (const [x, z] of b) { const p = (x * nx + z * nz) / len; minB = Math.min(minB, p); maxB = Math.max(maxB, p); }
      if (maxA - slack <= minB || maxB - slack <= minA) return false;
    }
  }
  return true;
}

const place = (o: Pick<Pose, "item">) => ITEM[o.item]?.place ?? "floor";
const cls = (o: Pick<Pose, "item">) => ITEM[o.item]?.cls ?? "";
/** Seats are meant to tuck under desks and tables. */
const TUCKS = new Set(["chair|desk", "chair|table", "ottoman|desk", "ottoman|table", "chair|nightstand"]);

export function descendants(id: string, objects: Placed[]): Placed[] {
  const out: Placed[] = []; const walk = (pid: string) => objects.forEach((o) => { if (o.parent === pid) { out.push(o); walk(o.id); } });
  walk(id); return out;
}

/** The first piece `o` is wrongly intersecting, or null. Only floor-standing furniture collides. */
export function collision(o: Placed, objects: Placed[], ignore?: Set<string>): Placed | null {
  if (place(o) !== "floor" || o.parent) return null;
  const mine = corners(o); const [, h] = dims(o);
  for (const other of objects) {
    if (other.id === o.id || ignore?.has(other.id) || place(other) !== "floor" || other.parent) continue;
    const pair = [cls(o), cls(other)];
    if (TUCKS.has(pair.join("|")) || TUCKS.has(pair.reverse().join("|"))) continue;
    const [, oh] = dims(other);
    if (o.y >= other.y + oh || other.y >= o.y + h) continue;
    if (footprintsOverlap(mine, corners(other))) return other;
  }
  return null;
}

/** Slide a piece back inside the walls. Exact for rotated pieces: the box around the footprint must fit. */
export function clampToRoom<T extends Pose>(o: T, room: Room): T {
  if (place(o) === "wall") return o;
  const [hx, hz] = halfExtents(o);
  const cl = (n: number, half: number, h: number) => (h > half ? 0 : Math.min(half - h, Math.max(-half + h, n)));
  return { ...o, x: cl(o.x, room.width / 2, hx), z: cl(o.z, room.depth / 2, hz) };
}

/** Top-most piece with a usable surface under a floor point. */
export function supportAt(x: number, z: number, objects: Placed[], exclude: Set<string>): { parent: Placed; y: number } | null {
  let best: { parent: Placed; y: number } | null = null;
  for (const o of objects) {
    const def = ITEM[o.item];
    if (exclude.has(o.id) || def?.surface === undefined || place(o) !== "floor") continue;
    const c = Math.cos(o.rot), s = Math.sin(o.rot); const dx = x - o.x, dz = z - o.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c; const [w, , d] = dims(o);
    if (Math.abs(lx) > w / 2 || Math.abs(lz) > d / 2) continue;
    const y = o.y + def.surface * o.scale[1];
    if (!best || y > best.y) best = { parent: o, y };
  }
  return best;
}

export const WALLS: WallId[] = ["back", "front", "left", "right"];
/** Position, facing and along-wall axis of each wall, looking from inside the room. */
export function wallFrame(wall: WallId, room: Room) {
  const hw = room.width / 2, hd = room.depth / 2;
  if (wall === "back") return { origin: [0, -hd] as const, rot: 0, length: room.width };
  if (wall === "front") return { origin: [0, hd] as const, rot: Math.PI, length: room.width };
  if (wall === "left") return { origin: [-hw, 0] as const, rot: Math.PI / 2, length: room.depth };
  return { origin: [hw, 0] as const, rot: -Math.PI / 2, length: room.depth };
}

/** Put a wall piece flat against whichever wall is nearest to (x, z). */
export function snapToWall<T extends Pose>(o: T, room: Room): T {
  const [w, h, d] = dims(o);
  let best: T | null = null, bestDist = Infinity;
  for (const wall of WALLS) {
    const f = wallFrame(wall, room); const c = Math.cos(f.rot), s = Math.sin(f.rot);
    // wall-local axes: u along the wall, n pointing into the room
    const ux = c, uz = -s, nx = s, nz = c;
    const rx = o.x - f.origin[0], rz = o.z - f.origin[1];
    const dist = Math.abs(rx * nx + rz * nz);
    const half = Math.max(0, f.length / 2 - w / 2);
    const u = Math.min(half, Math.max(-half, rx * ux + rz * uz));
    if (dist < bestDist) {
      bestDist = dist;
      best = { ...o, x: f.origin[0] + ux * u + nx * (d / 2 + 0.005), z: f.origin[1] + uz * u + nz * (d / 2 + 0.005), rot: f.rot,
               y: Math.min(Math.max(0, room.height - h), Math.max(0, o.y)) };
    }
  }
  return best ?? o;
}

/** A free spot for a new floor piece: the room's centre if clear, otherwise the nearest clear point on a widening ring. */
export function freeSpot(o: Placed, room: Room, objects: Placed[]): Placed {
  for (let r = 0; r <= Math.max(room.width, room.depth); r += 0.25) {
    const steps = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 0.3);
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const cand = clampToRoom({ ...o, x: Math.cos(a) * r, z: Math.sin(a) * r }, room);
      if (!collision(cand, objects)) return cand;
    }
  }
  return clampToRoom(o, room);
}

/** Pieces this one already overlaps. A scan can place neighbours slightly into each other; dragging must still be possible. */
export function overlapping(o: Placed, objects: Placed[]): Set<string> {
  const out = new Set<string>(); let hit: Placed | null;
  while ((hit = collision(o, objects, out))) out.add(hit.id);
  return out;
}
