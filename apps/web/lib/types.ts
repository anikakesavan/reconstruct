export type Vec3 = [number, number, number];

/** Every dimension in the app carries one of these. Never show a number without it. */
export type Confidence = "measured" | "estimated";

export interface RoomMeta {
  source: { dataset: string; citation: string; license: string; url: string; sensor: string };
  units: "metres";
  processing: {
    original_faces: number; faces: number; vertices: number; removed_speck_faces: number;
    camera_height_m_mean: number; colour_transfer_residual: { median_m: number; p95_m: number };
  };
  envelope: {
    confidence: Confidence; note: string; floor_y: number;
    ceiling: { kind: string; lowest_horizontal_plane_y: number; max_y: number };
    walls: { x_min: number; x_max: number; z_min: number; z_max: number };
    width_m: number; depth_m: number; dataset_stated_floor_area_m2: number;
  };
  bounds: { min: Vec3; max: Vec3 };
}

export type Tool = "select" | "inspect" | "measure" | "volume";
export type ViewMode = "orbit" | "walk" | "plan";

/** A block-out volume: a dimensioned box standing in for furniture until the Phase 3 catalogue exists. */
export interface Volume {
  id: string;
  label: string;
  size: Vec3; // width (x), height (y), depth (z) in metres
  x: number;
  z: number;
  quarterTurns: number; // rotation about Y in 90 degree steps
}

export interface Probe { point: Vec3; surface: "floor" | "wall" | "ceiling or underside" | "sloped or furniture" }
