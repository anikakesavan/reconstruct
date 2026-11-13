import type { Placed, Room } from "./types";

/** The example bedroom. A designed room made from catalogue pieces: NOT a scan of a real room. */
export const SAMPLE_ROOM: Room = { width: 4.6, depth: 3.8, height: 2.6, wallColor: "#f3efe6", floor: "laminate_floor_02", origin: "designed" };

const p = (item: string, x: number, z: number, rotDeg = 0, y = 0, extra: Partial<Placed> = {}): Placed => ({
  id: "", item, x, z, y, rot: (rotDeg * Math.PI) / 180, tint: null, finish: null, ...extra,
});

export const SAMPLE_OBJECTS: Placed[] = [
  p("rug_large", -0.35, 0.45),
  p("bed_double", -1.2, 0.35, 90, 0, { finish: "oak_veneer_01" }),
  p("side_table_01", -1.98, -0.72, 90),
  p("side_table_01", -1.98, 1.42, 90),
  p("ceramic_vase_01", -2.0, -0.72, 0, 0.55),
  p("book_encyclopedia_set_01", -1.98, 1.42, 90, 0.55),
  p("print", -2.28, 0.35, 90, 1.25, { finish: "oak_veneer_01" }),
  p("desk", 1.2, -1.52, 0, 0, { finish: "oak_veneer_01" }),
  p("chair", 1.15, -1.0, 180, 0, { finish: "oak_veneer_01" }),
  p("desk_lamp_arm_01", 1.65, -1.6, -30, 0.74),
  p("potted_plant_04", 0.75, -1.62, 0, 0.74),
  p("standing_picture_frame_01", 1.05, -1.7, 0, 0.74),
  p("wooden_display_shelves_01", -0.75, -1.68, 0),
  p("potted_plant_02", -0.75, -1.66, 0, 1.56),
  p("potted_plant_01", 0.12, -1.5, 0),
  p("modern_arm_chair_01", 1.6, 1.0, -105),
  p("wicker_basket_02", 1.75, -0.15, 0),
].map((o, i) => ({ ...o, id: `s${i + 1}` }));
