import { ITEM } from "./catalog";
import { snapToWall } from "./placement";
import type { Design, Placed, Room } from "./types";

/** The example bedroom. A designed room made from catalogue pieces: NOT a scan of a real room. */
const room: Room = {
  width: 4.6, depth: 3.8, height: 2.6, wallColor: "#f3efe6", floor: "laminate_floor_02", origin: "designed",
  openings: [
    { id: "w1", wall: "back", kind: "window", centre: -1.2, width: 1.2, sill: 0.92, height: 1.35 },
    { id: "w2", wall: "back", kind: "window", centre: 1.2, width: 1.2, sill: 0.92, height: 1.35 },
    { id: "d1", wall: "front", kind: "door", centre: 0.2, width: 0.82, sill: 0, height: 2.03 },
  ],
};

type Spec = [key: string, item: string, x: number, z: number, rotDeg: number, on?: string, y?: number];
const SPECS: Spec[] = [
  ["rug", "B07HSHPHW2", 0.15, 0.3, 0],
  ["bed", "B075X2LMTC", -1.19, 0.3, 90],
  ["ns1", "B07QD6TXWS", -2.06, -0.83, 90],
  ["ns2", "B07QD6TXWS", -2.06, 1.43, 90],
  ["lamp1", "B0825CP3NS", -2.06, -0.83, 0, "ns1"],
  ["vase", "ceramic_vase_01", -2.06, 1.43, 0, "ns2"],
  ["desk", "B08C2NYN5Y", 1.2, -1.57, 0],
  ["chair", "B075YMXWZM", 1.2, -1.02, 180],
  ["desklamp", "desk_lamp_arm_01", 1.62, -1.68, -30, "desk"],
  ["succulent", "potted_plant_04", 0.78, -1.66, 0, "desk"],
  ["books", "book_encyclopedia_set_01", 1.15, -1.74, 0, "desk"],
  ["shelf", "B07HSCNKCT", 0, -1.72, 0],
  ["leafy", "potted_plant_02", 0, -1.72, 0, "shelf"],
  ["tall", "potted_plant_01", -1.92, -1.52, 0],
  ["dresser", "B07HSL4TS1", 2.05, -0.3, -90],
  ["mirror", "B084HTZ2C6", 2.3, -0.3, 0, undefined, 1.25],
  ["vase2", "ceramic_vase_03", 2.05, -0.05, 0, "dresser"],
  ["armchair", "B071W5VJFK", 1.55, 1.2, -120],
  ["floorlamp", "B07DTLF7DN", 2.02, 0.45, -90],
];

function build(): Placed[] {
  const byKey = new Map<string, Placed>();
  for (const [key, item, x, z, rotDeg, on, y] of SPECS) {
    const def = ITEM[item];
    let o: Placed = { id: `s-${key}`, item, x, z, y: y ?? 0, rot: (rotDeg * Math.PI) / 180, scale: [1, 1, 1], colors: def.parts.map(() => null), parent: null };
    const host = on ? byKey.get(on) : undefined;
    if (host) o = { ...o, parent: host.id, y: host.y + (ITEM[host.item].surface ?? 0) };
    if (def.place === "wall") o = snapToWall(o, room);
    byKey.set(key, o);
  }
  return [...byKey.values()];
}

export const SAMPLE: Design = { room, objects: build() };
