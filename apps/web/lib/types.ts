export type Vec3 = [number, number, number];

/** Every dimension from a scan carries one of these. */
export type Confidence = "measured" | "estimated" | "uncalibrated";

/** Metadata the reconstruction service writes next to a scan. */
export interface ScanMeta {
  source: { kind: "upload"; title: string; detail: string };
  scale: { confidence: Confidence; method: string; metres_per_unit: number; disagreement_between_views: number | null };
  processing: { faces: number; vertices: number; views?: number; seconds?: number; device?: string; pipeline?: string };
  /** Plain-language problems found in the capture, most serious first. */
  quality?: { level: "good" | "fair" | "poor"; issues: { severity: "warning" | "problem"; text: string }[] };
  envelope: {
    floor_found?: boolean;
    ceiling: { max_y: number };
    walls: { x_min: number; x_max: number; z_min: number; z_max: number };
    walls_found?: { x_min: boolean; x_max: boolean; z_min: boolean; z_max: boolean };
    width_m: number; depth_m: number;
  };
  bounds: { min: Vec3; max: Vec3 };
}

export interface ScanRef { id: string; title: string; glbUrl: string; metaUrl: string }

export interface Job {
  id: string; title: string; status: "queued" | "running" | "done" | "failed";
  stage: string; progress: number; message: string; error: string | null; created: number;
}

export type Tool = "select" | "measure";
export type ViewMode = "orbit" | "walk" | "plan";

/** The clean, editable room: four walls, a floor and windows, all generated from these numbers. */
export interface Room {
  width: number;  // along X, metres
  depth: number;  // along Z
  height: number;
  wallColor: string;
  floor: string;  // id in FLOORS
  /** "designed": dimensions chosen by hand. "scan": taken from a scan's fitted envelope (an estimate). */
  origin: "designed" | "scan";
}

/** One piece of furniture or decor placed in the room. Plain data, so undo, saving and AI edits stay simple. */
export interface Placed {
  id: string;
  item: string;      // id in CATALOG
  x: number; z: number;
  y: number;         // height of its base above the floor (0 for things standing on the floor)
  rot: number;       // radians about the vertical axis
  tint: string | null;   // colour multiplied over the item's own materials; null leaves it as made
  finish: string | null; // for built items: id of a wood finish
}
