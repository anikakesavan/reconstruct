export type Vec3 = [number, number, number];

/** Every dimension in the app carries one of these. Never show a number without it. */
export type Confidence = "measured" | "estimated" | "uncalibrated";

export interface RoomMeta {
  source: { kind: "dataset" | "upload"; title: string; detail: string; license: string | null; url: string | null };
  units: "metres";
  /** Where real-world size comes from. "measured": depth sensor or user calibration. */
  scale: { confidence: Confidence; method: string; metres_per_unit: number; disagreement_between_views: number | null };
  processing: {
    faces: number; vertices: number; faces_before_reduction?: number; pipeline?: string; views?: number;
    seconds?: number; device?: string; skipped_files?: string[];
  };
  envelope: {
    confidence: Confidence; note: string; floor_y: number; floor_found?: boolean;
    ceiling: { max_y: number; kind?: string };
    walls: { x_min: number; x_max: number; z_min: number; z_max: number };
    walls_found?: { x_min: boolean; x_max: boolean; z_min: boolean; z_max: boolean };
    width_m: number; depth_m: number; stated_floor_area_m2?: number;
  };
  bounds: { min: Vec3; max: Vec3 };
}

/** A scan the viewer can open: the bundled demo or a finished reconstruction. */
export interface ScanRef { id: string; title: string; kind: "dataset" | "upload"; glbUrl: string; roomUrl: string }

export interface Job {
  id: string; title: string; status: "queued" | "running" | "done" | "failed";
  stage: string; progress: number; message: string; error: string | null; created: number;
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
