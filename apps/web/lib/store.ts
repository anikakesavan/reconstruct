import { create } from "zustand";
import type { Probe, RoomMeta, Tool, Vec3, ViewMode, Volume } from "./types";

export const VOLUME_PRESETS: { label: string; size: Vec3 }[] = [
  { label: "Double bed", size: [1.4, 0.5, 2.0] },
  { label: "Desk", size: [1.2, 0.75, 0.6] },
  { label: "Wardrobe", size: [1.0, 2.0, 0.6] },
  { label: "Bookshelf", size: [0.8, 1.8, 0.3] },
];

interface Studio {
  room: RoomMeta | null;
  scanReady: boolean;
  tool: Tool;
  view: ViewMode;
  volumes: Volume[];
  selectedId: string | null;
  measure: { a: Vec3 | null; b: Vec3 | null };
  probe: Probe | null;
  fps: number;
  triangles: number;
  dragging: boolean;
  /** Display-only multiplier on the captured colours. 1 is exactly as captured. */
  gain: number;
  setGain: (g: number) => void;
  setRoom: (r: RoomMeta) => void;
  setScanReady: () => void;
  setTool: (t: Tool) => void;
  setView: (v: ViewMode) => void;
  addVolume: (preset: number) => void;
  updateVolume: (id: string, patch: Partial<Volume>) => void;
  removeVolume: (id: string) => void;
  select: (id: string | null) => void;
  addMeasurePoint: (p: Vec3) => void;
  clearMeasure: () => void;
  setProbe: (p: Probe | null) => void;
  setStats: (fps: number, triangles: number) => void;
  setDragging: (d: boolean) => void;
}

/** Half extents of a volume's footprint after its quarter-turn rotation. */
export function footprint(v: Pick<Volume, "size" | "quarterTurns">): [number, number] {
  const turned = v.quarterTurns % 2 !== 0;
  return turned ? [v.size[2] / 2, v.size[0] / 2] : [v.size[0] / 2, v.size[2] / 2];
}

/** Keep a volume inside the ESTIMATED wall planes. Approximate by construction. */
export function clampToRoom(v: Volume, room: RoomMeta | null): Volume {
  if (!room) return v;
  const [hx, hz] = footprint(v);
  const w = room.envelope.walls;
  const cl = (n: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, n)));
  return { ...v, x: cl(v.x, w.x_min + hx, w.x_max - hx), z: cl(v.z, w.z_min + hz, w.z_max - hz) };
}

let counter = 0;

export const useStudio = create<Studio>((set, get) => ({
  room: null, scanReady: false, tool: "select", view: "orbit", volumes: [], selectedId: null,
  measure: { a: null, b: null }, probe: null, fps: 0, triangles: 0, dragging: false, gain: 1.5,
  setGain: (gain) => set({ gain }),
  setRoom: (room) => set({ room }),
  setScanReady: () => set({ scanReady: true }),
  setTool: (tool) => set({ tool, probe: tool === "inspect" ? get().probe : null }),
  setView: (view) => set({ view }),
  addVolume: (preset) => {
    const p = VOLUME_PRESETS[preset];
    const id = `v${++counter}`;
    const v = clampToRoom({ id, label: p.label, size: [...p.size] as Vec3, x: 0, z: 0, quarterTurns: 0 }, get().room);
    set({ volumes: [...get().volumes, v], selectedId: id, tool: "select" });
  },
  updateVolume: (id, patch) =>
    set({ volumes: get().volumes.map((v) => (v.id === id ? clampToRoom({ ...v, ...patch }, get().room) : v)) }),
  removeVolume: (id) => set({ volumes: get().volumes.filter((v) => v.id !== id), selectedId: null }),
  select: (selectedId) => set({ selectedId }),
  addMeasurePoint: (p) => {
    const { a, b } = get().measure;
    set({ measure: !a || b ? { a: p, b: null } : { a, b: p } });
  },
  clearMeasure: () => set({ measure: { a: null, b: null } }),
  setProbe: (probe) => set({ probe }),
  setStats: (fps, triangles) => set({ fps, triangles }),
  setDragging: (dragging) => set({ dragging }),
}));

/** Shared, non-reactive input for walk mode so keys and the touch pad drive the same controller. */
export const walkInput = { forward: 0, strafe: 0 };
