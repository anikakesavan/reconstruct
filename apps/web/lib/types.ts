export type Vec3 = [number, number, number];

/** Every dimension from a scan carries one of these. */
export type Confidence = "measured" | "estimated" | "uncalibrated";

export type WallId = "back" | "front" | "left" | "right";

/** A window or door cut into a wall. `centre` is metres along the wall from its middle. */
export interface Opening {
  id: string; wall: WallId; kind: "window" | "door";
  centre: number; width: number; sill: number; height: number;
  /** 0 to 1 when detected in a scan; absent when placed by hand. */
  confidence?: number;
}

/** The room shell: four walls, a floor, openings, all generated from these numbers. */
export interface Room {
  width: number;  // along X, metres
  depth: number;  // along Z
  height: number;
  wallColor: string;
  floor: string;  // id in FLOORS
  openings: Opening[];
  /** "designed": chosen by hand. "scan": estimated from the user's photos. */
  origin: "designed" | "scan";
}

/** Where an item was when it was detected, so it can be put back. */
export interface Pose { item: string; x: number; z: number; y: number; rot: number; scale: Vec3; colors: (string | null)[] }

/** One piece of furniture or decor. Plain data, so undo, saving and AI edits stay simple. */
export interface Placed extends Pose {
  id: string;
  /** id of the piece this one sits on; it moves and turns with its parent */
  parent: string | null;
  /** set for pieces found in a scan */
  detected?: { label: string; confidence: number; views: number; original: Pose };
}

export interface Design { room: Room; objects: Placed[] }

/** What the reconstruction service returns for a scan. */
export interface ScanResult {
  title: string;
  scale: { confidence: Confidence; method: string; metres_per_unit: number; disagreement_between_views: number | null };
  quality: { level: "good" | "fair" | "poor"; issues: { severity: "warning" | "problem"; text: string }[] };
  processing: { views: number; seconds: number; device: string; pipeline: string };
  room: {
    width: number; depth: number; height: number; height_confidence: number;
    wall_color: string | null; floor_color: string | null;
    walls_found: Record<WallId, boolean>; floor_found: boolean;
    openings: (Omit<Opening, "id">)[];
  };
  objects: {
    label: string; confidence: number; views: number;
    x: number; z: number; y: number; rot: number; size: Vec3; color: string | null;
  }[];
  /** things the model saw but could not place reliably */
  skipped: { label: string; reason: string }[];
}

export interface ScanRef { id: string; title: string; glbUrl: string; sceneUrl: string }

export interface Job {
  id: string; title: string; status: "queued" | "running" | "done" | "failed";
  stage: string; progress: number; message: string; error: string | null; created: number;
}

export type Tool = "select" | "measure";
export type ViewMode = "orbit" | "walk" | "plan";
