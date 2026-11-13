import { create } from "zustand";
import { ITEM, sizes } from "./catalog";
import { SAMPLE_OBJECTS, SAMPLE_ROOM } from "./sample";
import type { Placed, Room, ScanMeta, ScanRef, Tool, Vec3, ViewMode } from "./types";

const SAVE_KEY = "reconstruct:design:v2";
const SNAP = 0.05;
export const ROT_STEP = Math.PI / 12; // 15 degrees

/** Everything undo/redo covers. */
interface Design { room: Room; objects: Placed[] }

interface Studio extends Design {
  past: Design[]; future: Design[];
  selectedId: string | null;
  tool: Tool; view: ViewMode;
  dragging: boolean;
  measure: { a: Vec3 | null; b: Vec3 | null };
  assetsReady: boolean;

  // an uploaded scan, shown as a reference layer
  scan: ScanRef | null;
  scanMeta: ScanMeta | null;
  calibration: number;
  showScan: boolean;
  /** false while looking at a raw scan before a clean room has been made from it */
  showRoom: boolean;

  hydrate: () => void;
  commit: (next: Partial<Design>) => void;
  undo: () => void; redo: () => void;
  select: (id: string | null) => void;
  add: (item: string) => void;
  /** live update while dragging: no history entry until endDrag */
  nudge: (id: string, x: number, z: number) => void;
  beginDrag: () => void; endDrag: () => void;
  patch: (id: string, patch: Partial<Placed>) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  replace: (id: string, item: string) => void;
  setRoom: (patch: Partial<Room>) => void;
  resetToSample: () => void;
  setTool: (t: Tool) => void; setView: (v: ViewMode) => void;
  addMeasurePoint: (p: Vec3) => void; clearMeasure: () => void;
  setAssetsReady: () => void;
  openScan: (scan: ScanRef) => void;
  setScanMeta: (m: ScanMeta) => void;
  closeScan: () => void;
  calibrate: (factor: number) => void;
  setLayer: (layer: "showScan" | "showRoom", on: boolean) => void;
  roomFromScan: () => void;
}

let counter = 0;
const newId = () => `o${Date.now().toString(36)}${(counter++).toString(36)}`;
const snap = (n: number) => Math.round(n / SNAP) * SNAP;

/** Half extents of an item's footprint on the floor after rotation (axis-aligned bound). */
export function halfFootprint(o: Pick<Placed, "item" | "rot">): [number, number] {
  const s = sizes.get(o.item) ?? [0.5, 0.5, 0.5];
  const c = Math.abs(Math.cos(o.rot)), sn = Math.abs(Math.sin(o.rot));
  return [(s[0] * c + s[2] * sn) / 2, (s[0] * sn + s[2] * c) / 2];
}

/** Keep an item inside the walls. */
export function clampToRoom(o: Placed, room: Room): Placed {
  const [hx, hz] = halfFootprint(o);
  const cl = (n: number, half: number, h: number) => (h > half ? (0) : Math.min(half - h, Math.max(-half + h, n)));
  return { ...o, x: cl(o.x, room.width / 2, hx), z: cl(o.z, room.depth / 2, hz) };
}

function save(d: Design) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ room: d.room, objects: d.objects })); } catch { /* storage unavailable */ }
}

export const useStudio = create<Studio>((set, get) => ({
  room: SAMPLE_ROOM, objects: SAMPLE_OBJECTS, past: [], future: [],
  selectedId: null, tool: "select", view: "orbit", dragging: false,
  measure: { a: null, b: null }, assetsReady: false,
  scan: null, scanMeta: null, calibration: 1, showScan: true, showRoom: true,

  hydrate: () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Design;
      if (d?.room?.width && Array.isArray(d.objects)) set({ room: d.room, objects: d.objects.filter((o) => ITEM[o.item]) });
    } catch { /* ignore a corrupt save */ }
  },

  commit: (next) => {
    const { room, objects, past } = get();
    const d = { room: next.room ?? room, objects: next.objects ?? objects };
    set({ ...d, past: [...past.slice(-79), { room, objects }], future: [] });
    save(d);
  },
  undo: () => {
    const { past, future, room, objects, selectedId } = get();
    const prev = past[past.length - 1];
    if (!prev) return;
    set({ ...prev, past: past.slice(0, -1), future: [{ room, objects }, ...future],
          selectedId: prev.objects.some((o) => o.id === selectedId) ? selectedId : null });
    save(prev);
  },
  redo: () => {
    const { past, future, room, objects } = get();
    const next = future[0];
    if (!next) return;
    set({ ...next, past: [...past, { room, objects }], future: future.slice(1) });
    save(next);
  },

  select: (selectedId) => set({ selectedId }),
  add: (item) => {
    const def = ITEM[item]; if (!def) return;
    const { room, objects } = get();
    const o = clampToRoom({ id: newId(), item, x: 0, z: 0, y: def.tabletop ? 0.74 : def.wall ? 1.4 : 0, rot: 0, tint: null,
                            finish: def.wood ? "oak_veneer_01" : null }, room);
    get().commit({ objects: [...objects, o] });
    set({ selectedId: o.id, tool: "select" });
  },
  beginDrag: () => { const { room, objects, past } = get(); set({ dragging: true, past: [...past.slice(-79), { room, objects }], future: [] }); },
  nudge: (id, x, z) => {
    const { room, objects } = get();
    set({ objects: objects.map((o) => (o.id === id ? clampToRoom({ ...o, x: snap(x), z: snap(z) }, room) : o)) });
  },
  endDrag: () => {
    const { room, objects, past } = get();
    const before = past[past.length - 1];
    // a click without movement should not leave an empty undo step
    const moved = before && JSON.stringify(before.objects) !== JSON.stringify(objects);
    set({ dragging: false, past: moved ? past : past.slice(0, -1) });
    if (moved) save({ room, objects });
  },
  patch: (id, patch) => {
    const { room, objects } = get();
    get().commit({ objects: objects.map((o) => (o.id === id ? clampToRoom({ ...o, ...patch }, room) : o)) });
  },
  remove: (id) => { get().commit({ objects: get().objects.filter((o) => o.id !== id) }); set({ selectedId: null }); },
  duplicate: (id) => {
    const { room, objects } = get();
    const src = objects.find((o) => o.id === id); if (!src) return;
    const copy = clampToRoom({ ...src, id: newId(), x: src.x + 0.4, z: src.z + 0.4 }, room);
    get().commit({ objects: [...objects, copy] });
    set({ selectedId: copy.id });
  },
  replace: (id, item) => {
    const { room, objects } = get();
    const def = ITEM[item]; if (!def) return;
    get().commit({ objects: objects.map((o) => (o.id === id
      ? clampToRoom({ ...o, item, tint: null, finish: def.wood ? o.finish ?? "oak_veneer_01" : null }, room) : o)) });
  },
  setRoom: (patch) => {
    const room = { ...get().room, ...patch };
    get().commit({ room, objects: get().objects.map((o) => clampToRoom(o, room)) });
  },
  resetToSample: () => { get().commit({ room: SAMPLE_ROOM, objects: SAMPLE_OBJECTS }); set({ selectedId: null, showRoom: true }); },

  setTool: (tool) => set({ tool, measure: { a: null, b: null } }),
  setView: (view) => set({ view }),
  addMeasurePoint: (p) => { const { a, b } = get().measure; set({ measure: !a || b ? { a: p, b: null } : { a, b: p } }); },
  clearMeasure: () => set({ measure: { a: null, b: null } }),
  setAssetsReady: () => set({ assetsReady: true }),

  openScan: (scan) => {
    let k = 1;
    try { k = Number(localStorage.getItem(`reconstruct:calibration:${scan.id}`)) || 1; } catch { /* storage unavailable */ }
    set({ scan, scanMeta: null, calibration: k, showScan: true, showRoom: false, selectedId: null, view: "orbit", tool: "select",
          measure: { a: null, b: null } });
  },
  setScanMeta: (scanMeta) => set({ scanMeta }),
  closeScan: () => set({ scan: null, scanMeta: null, calibration: 1, showRoom: true, measure: { a: null, b: null } }),
  calibrate: (factor) => {
    const { calibration, scan } = get();
    if (!scan || !(factor > 0)) return;
    const k = calibration * factor;
    try { localStorage.setItem(`reconstruct:calibration:${scan.id}`, String(k)); } catch { /* storage unavailable */ }
    set({ calibration: k, measure: { a: null, b: null } });
  },
  setLayer: (layer, on) => set({ [layer]: on } as Pick<Studio, "showScan" | "showRoom">),
  roomFromScan: () => {
    const { scanMeta, calibration, room } = get();
    if (!scanMeta) return;
    const r2 = (n: number) => Math.round(n * 20) / 20;
    const e = scanMeta.envelope;
    get().commit({
      room: { ...room, origin: "scan", width: r2(Math.max(1.8, e.width_m * calibration)), depth: r2(Math.max(1.8, e.depth_m * calibration)),
              height: r2(Math.min(3.6, Math.max(2.2, e.ceiling.max_y * calibration))) },
      objects: [],
    });
    set({ showRoom: true, selectedId: null });
  },
}));

/** Scan envelope with the user's calibration applied. */
export function scaledEnvelope(meta: ScanMeta, k: number) {
  return { width: meta.envelope.width_m * k, depth: meta.envelope.depth_m * k, height: meta.envelope.ceiling.max_y * k };
}

if (typeof window !== "undefined") (window as unknown as { __studio: typeof useStudio }).__studio = useStudio; // read by tests/editor.py

/** Shared, non-reactive input for walk mode so keys and the touch pad drive the same controller. */
export const walkInput = { forward: 0, strafe: 0 };
