import { create } from "zustand";
import { CATALOG, FLOORS, ITEM, LABEL_TO_CLS } from "./catalog";
import { clampToRoom, collision, descendants, dims, freeSpot, overlapping, snapToWall, supportAt } from "./placement";
import { SAMPLE } from "./sample";
import type { Design, Opening, Placed, Pose, Room, ScanRef, ScanResult, Tool, Vec3, ViewMode } from "./types";

const AUTOSAVE = "reconstruct:autosave:v3";
const SAVES = "reconstruct:saves:v3";
const SNAP = 0.05;
export const ROT_STEP = Math.PI / 12; // 15 degrees

export interface SavedDesign { name: string; savedAt: number; design: Design; scan: ScanRef | null }

interface Studio extends Design {
  past: Design[]; future: Design[];
  /** the design as it was first opened (sample, or as detected from a scan): the "before" in before and after */
  baseline: Design;
  selectedId: string | null;
  /** id of the piece being dragged into a position it cannot keep */
  invalidId: string | null;
  notice: string | null;
  tool: Tool; view: ViewMode;
  dragging: boolean;
  measure: { a: Vec3 | null; b: Vec3 | null };
  name: string;
  dirty: boolean;

  scan: ScanRef | null;
  scanResult: ScanResult | null;
  showScan: boolean;
  comparing: boolean;
  /** the user fixed the scan's size against a real measurement */
  calibrated: boolean;
  /** scale applied to the raw scan overlay so it stays aligned after calibration */
  scanScale: number;

  hydrate: () => void;
  commit: (next: Partial<Design>) => void;
  undo: () => void; redo: () => void;
  select: (id: string | null) => void;
  say: (text: string | null) => void;
  add: (item: string) => void;
  beginDrag: () => void;
  dragTo: (id: string, x: number, z: number) => void;
  endDrag: () => void;
  rotateTo: (id: string, rot: number) => void;
  patch: (id: string, patch: Partial<Pose>) => boolean;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  replace: (id: string, item: string) => void;
  restore: (id: string) => void;
  setRoom: (patch: Partial<Room>) => void;
  setOpening: (id: string, patch: Partial<Opening> | null) => void;
  addOpening: (kind: Opening["kind"]) => void;
  setTool: (t: Tool) => void; setView: (v: ViewMode) => void;
  addMeasurePoint: (p: Vec3) => void; clearMeasure: () => void;
  rescale: (factor: number) => void;
  setShowScan: (on: boolean) => void; setComparing: (on: boolean) => void;
  openSample: () => void;
  openScan: (scan: ScanRef, result: ScanResult) => void;
  saveAs: (name: string) => void;
  openSaved: (s: SavedDesign) => void;
}

/** pieces the dragged one already overlapped when the drag began (possible straight after a scan) */
let tolerated = new Set<string>();
let counter = 0;
const newId = () => `o${Date.now().toString(36)}${(counter++).toString(36)}`;
const snap = (n: number) => Math.round(n / SNAP) * SNAP;
const placeOf = (o: Pick<Pose, "item">) => ITEM[o.item]?.place ?? "floor";
const pose = (o: Placed): Pose => ({ item: o.item, x: o.x, z: o.z, y: o.y, rot: o.rot, scale: [...o.scale] as Vec3, colors: [...o.colors] });

export function listSaves(): SavedDesign[] {
  try { return JSON.parse(localStorage.getItem(SAVES) ?? "[]"); } catch { return []; }
}
function writeSaves(list: SavedDesign[]) { try { localStorage.setItem(SAVES, JSON.stringify(list)); } catch { /* storage full or unavailable */ } }
export function deleteSave(name: string) { writeSaves(listSaves().filter((s) => s.name !== name)); }

function autosave(s: Pick<Studio, "room" | "objects" | "name" | "scan" | "baseline">) {
  try { localStorage.setItem(AUTOSAVE, JSON.stringify({ room: s.room, objects: s.objects, name: s.name, scan: s.scan, baseline: s.baseline })); } catch { /* ignore */ }
}

/** Move a piece and everything standing on it. */
function moveWithChildren(objects: Placed[], id: string, dx: number, dz: number): Placed[] {
  const ids = new Set([id, ...descendants(id, objects).map((o) => o.id)]);
  return objects.map((o) => (ids.has(o.id) ? { ...o, x: o.x + dx, z: o.z + dz } : o));
}
/** Turn a piece and carry everything standing on it around its centre. */
function rotateWithChildren(objects: Placed[], id: string, dRot: number): Placed[] {
  const pivot = objects.find((o) => o.id === id); if (!pivot) return objects;
  const kids = new Set(descendants(id, objects).map((o) => o.id));
  const c = Math.cos(dRot), s = Math.sin(dRot);
  return objects.map((o) => {
    if (o.id === id) return { ...o, rot: o.rot + dRot };
    if (!kids.has(o.id)) return o;
    const dx = o.x - pivot.x, dz = o.z - pivot.z;
    return { ...o, x: pivot.x + dx * c + dz * s, z: pivot.z - dx * s + dz * c, rot: o.rot + dRot };
  });
}

/** Choose the catalogue piece that best fits a detected object, and how to stretch it. */
export function matchItem(label: string, size: Vec3): { item: string; scale: Vec3 } | null {
  const cls = LABEL_TO_CLS[label]; if (!cls) return null;
  const options = CATALOG.filter((i) => i.cls === cls);
  if (!options.length) return null;
  let best = options[0], bestErr = Infinity;
  for (const i of options) {
    const err = Math.abs(Math.log(size[0] / i.size[0])) + Math.abs(Math.log(size[2] / i.size[2])) + 0.5 * Math.abs(Math.log(size[1] / i.size[1]));
    if (err < bestErr) { best = i; bestErr = err; }
  }
  // stretch toward the detected size, but not so far that the piece stops looking like itself
  const lim = (n: number) => Math.min(1.35, Math.max(0.72, n));
  return { item: best.id, scale: [lim(size[0] / best.size[0]), lim(size[1] / best.size[1]), lim(size[2] / best.size[2])] };
}

const hexDist = (a: string, b: string) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

/** Turn the service's findings into an editable design. Nothing is added that the scan did not report. */
export function designFromScan(r: ScanResult): Design {
  const floor = r.room.floor_color ? [...FLOORS].sort((a, b) => hexDist(a.color, r.room.floor_color!) - hexDist(b.color, r.room.floor_color!))[0].id : FLOORS[0].id;
  const room: Room = {
    width: r.room.width, depth: r.room.depth, height: r.room.height, wallColor: r.room.wall_color ?? "#f3efe6", floor, origin: "scan",
    openings: r.room.openings.map((o, i) => ({ ...o, id: `op${i}` })),
  };
  const objects: Placed[] = [];
  for (const d of r.objects) {
    const m = matchItem(d.label, d.size); if (!m) continue;
    const def = ITEM[m.item];
    const colors = def.parts.map((_, i) => (i === 0 ? d.color : null));
    let o: Placed = { id: newId(), item: m.item, x: d.x, z: d.z, y: def.place === "floor" || def.place === "rug" ? 0 : d.y, rot: d.rot, scale: m.scale, colors, parent: null };
    o = def.place === "wall" ? snapToWall(o, room) : clampToRoom(o, room);
    o.detected = { label: d.label, confidence: d.confidence, views: d.views, original: pose(o) };
    objects.push(o);
  }
  // seat detected small things on whatever is under them
  return { room, objects: objects.map((o) => {
    if (placeOf(o) !== "surface") return o;
    const s = supportAt(o.x, o.z, objects, new Set([o.id]));
    return s ? { ...o, parent: s.parent.id, y: s.y } : { ...o, y: 0 };
  }) };
}

export const useStudio = create<Studio>((set, get) => ({
  ...SAMPLE, past: [], future: [], baseline: SAMPLE,
  selectedId: null, invalidId: null, notice: null, tool: "select", view: "orbit", dragging: false,
  measure: { a: null, b: null }, name: "Sample bedroom", dirty: false,
  scan: null, scanResult: null, showScan: false, comparing: false, calibrated: false, scanScale: 1,

  hydrate: () => {
    try {
      const raw = localStorage.getItem(AUTOSAVE); if (!raw) return;
      const d = JSON.parse(raw);
      if (d?.room?.width && Array.isArray(d.objects) && Array.isArray(d.room.openings))
        set({ room: d.room, objects: d.objects.filter((o: Placed) => ITEM[o.item]), name: d.name ?? "Untitled", scan: d.scan ?? null, baseline: d.baseline ?? SAMPLE });
    } catch { /* ignore a corrupt save */ }
  },

  commit: (next) => {
    const { room, objects, past } = get();
    set({ room: next.room ?? room, objects: next.objects ?? objects, past: [...past.slice(-79), { room, objects }], future: [], dirty: true });
    autosave(get());
  },
  undo: () => {
    const { past, future, room, objects, selectedId } = get();
    const prev = past[past.length - 1]; if (!prev) return;
    set({ ...prev, past: past.slice(0, -1), future: [{ room, objects }, ...future], dirty: true,
          selectedId: prev.objects.some((o) => o.id === selectedId) ? selectedId : null });
    autosave(get());
  },
  redo: () => {
    const { past, future, room, objects } = get();
    const next = future[0]; if (!next) return;
    set({ ...next, past: [...past, { room, objects }], future: future.slice(1), dirty: true });
    autosave(get());
  },

  select: (selectedId) => set({ selectedId }),
  say: (notice) => { set({ notice }); if (notice) setTimeout(() => { if (get().notice === notice) set({ notice: null }); }, 3200); },

  add: (item) => {
    const def = ITEM[item]; if (!def) return;
    const { room, objects, selectedId } = get();
    let o: Placed = { id: newId(), item, x: 0, z: 0, y: 0, rot: 0, scale: [1, 1, 1], colors: def.parts.map(() => null), parent: null };
    if (def.place === "wall") o = snapToWall({ ...o, y: Math.max(0.9, 1.5 - def.size[1] / 2), z: -room.depth }, room);
    else if (def.place === "surface") {
      // on the selected piece if it can hold things, otherwise on the first desk, nightstand or dresser
      const sel = objects.find((x) => x.id === selectedId);
      const host = (sel && ITEM[sel.item]?.surface !== undefined && sel) || objects.find((x) => ["desk", "nightstand", "dresser", "table"].includes(ITEM[x.item]?.cls) && !x.parent);
      if (host) o = { ...o, x: host.x, z: host.z, y: host.y + ITEM[host.item].surface! * host.scale[1], parent: host.id };
      else o = clampToRoom(o, room);
    } else if (def.place === "rug") o = clampToRoom(o, room);
    else o = freeSpot(o, room, objects);
    get().commit({ objects: [...objects, o] });
    set({ selectedId: o.id, tool: "select" });
    if (def.place === "floor" && collision(o, objects)) get().say("The room is full, so this overlaps something. Move it or remove a piece.");
  },

  beginDrag: () => {
    const { room, objects, past, selectedId } = get();
    const me = objects.find((o) => o.id === selectedId);
    tolerated = me ? overlapping(me, objects) : new Set();
    set({ dragging: true, invalidId: null, past: [...past.slice(-79), { room, objects }], future: [] });
  },
  dragTo: (id, x, z) => {
    const { room, objects } = get();
    const o = objects.find((p) => p.id === id); if (!o) return;
    const kind = placeOf(o);
    if (kind === "wall") {
      const next = snapToWall({ ...o, x, z }, room);
      set({ objects: objects.map((p) => (p.id === id ? next : p)) }); return;
    }
    if (kind === "surface") {
      const skip = new Set([id, ...descendants(id, objects).map((d) => d.id)]);
      const c = clampToRoom({ ...o, x, z }, room);
      const s = supportAt(c.x, c.z, objects, skip);
      set({ objects: objects.map((p) => (p.id === id ? { ...c, y: s ? s.y : 0, parent: s ? s.parent.id : null } : p)) }); return;
    }
    const target = clampToRoom({ ...o, x: snap(x), z: snap(z) }, room);
    const moved = moveWithChildren(objects, id, target.x - o.x, target.z - o.z);
    const me = moved.find((p) => p.id === id)!;
    set({ objects: moved, invalidId: collision(me, moved, tolerated) ? id : null });
  },
  endDrag: () => {
    const { room, objects, past, invalidId } = get();
    const before = past[past.length - 1];
    if (invalidId && before) {
      // a piece cannot be left inside another: put everything back
      set({ ...before, past: past.slice(0, -1), dragging: false, invalidId: null });
      get().say("That spot is taken. The piece went back where it was."); return;
    }
    const moved = before && JSON.stringify(before.objects) !== JSON.stringify(objects);
    set({ dragging: false, invalidId: null, past: moved ? past : past.slice(0, -1), dirty: moved ? true : get().dirty });
    if (moved) autosave(get());
    void room;
  },
  rotateTo: (id, rot) => {
    const { objects, room } = get();
    const o = objects.find((p) => p.id === id); if (!o || placeOf(o) === "wall") return;
    const turned = rotateWithChildren(objects, id, rot - o.rot);
    const me = clampToRoom(turned.find((p) => p.id === id)!, room);
    const shifted = moveWithChildren(turned, id, me.x - o.x, me.z - o.z);
    set({ objects: shifted, invalidId: collision(shifted.find((p) => p.id === id)!, shifted, tolerated) ? id : null });
  },

  patch: (id, patch) => {
    const { room, objects } = get();
    const o = objects.find((p) => p.id === id); if (!o) return false;
    let list = objects;
    if (patch.rot !== undefined && patch.rot !== o.rot && placeOf(o) !== "wall") list = rotateWithChildren(list, id, patch.rot - o.rot);
    list = list.map((p) => {
      if (p.id !== id) return p;
      let n: Placed = { ...p, ...patch, rot: list.find((q) => q.id === id)!.rot };
      n = placeOf(n) === "wall" ? snapToWall(n, room) : clampToRoom(n, room);
      return n;
    });
    const me = list.find((p) => p.id === id)!;
    // children ride on the top surface, so keep them there when the piece is resized
    if (patch.scale) {
      const top = ITEM[me.item]?.surface;
      if (top !== undefined) list = list.map((p) => (p.parent === id ? { ...p, y: me.y + top * me.scale[1] } : p));
    }
    const hit = collision(me, list);
    if (hit && (patch.scale || patch.rot !== undefined)) { get().say(`No room for that: it would run into the ${ITEM[hit.item].name.toLowerCase()}.`); return false; }
    get().commit({ objects: list }); return true;
  },
  remove: (id) => {
    // anything standing on the removed piece drops to the floor
    get().commit({ objects: get().objects.filter((o) => o.id !== id).map((o) => (o.parent === id ? { ...o, parent: null, y: 0 } : o)) });
    set({ selectedId: null });
  },
  duplicate: (id) => {
    const { room, objects } = get();
    const src = objects.find((o) => o.id === id); if (!src) return;
    const [w] = dims(src);
    let copy: Placed = { ...src, id: newId(), detected: undefined };
    if (placeOf(src) === "floor" && !src.parent) copy = freeSpot({ ...copy, x: src.x + w + 0.1 }, room, objects);
    else copy = { ...copy, x: src.x + 0.25, z: src.z + 0.1 };
    const kids = descendants(id, objects).map((k) => ({ ...k, id: newId(), detected: undefined, parent: k.parent === id ? copy.id : k.parent, x: k.x + copy.x - src.x, z: k.z + copy.z - src.z }));
    get().commit({ objects: [...objects, copy, ...kids] });
    set({ selectedId: copy.id });
  },
  replace: (id, item) => {
    const { room, objects } = get();
    const def = ITEM[item]; const o = objects.find((p) => p.id === id); if (!def || !o) return;
    // keep the footprint the old piece occupied, as far as the new one allows
    const [w, h, d] = dims(o); const lim = (n: number) => Math.min(1.35, Math.max(0.72, n));
    const next = clampToRoom({ ...o, item, scale: [lim(w / def.size[0]), lim(h / def.size[1]), lim(d / def.size[2])] as Vec3, colors: def.parts.map(() => null) }, room);
    const top = def.surface;
    get().commit({ objects: objects.map((p) => (p.id === id ? next : p.parent === id ? (top !== undefined ? { ...p, y: next.y + top * next.scale[1] } : { ...p, parent: null, y: 0 }) : p)) });
  },
  restore: (id) => {
    const { objects } = get();
    const o = objects.find((p) => p.id === id); if (!o?.detected) return;
    const back = o.detected.original;
    const moved = moveWithChildren(rotateWithChildren(objects, id, back.rot - o.rot), id, back.x - o.x, back.z - o.z);
    get().commit({ objects: moved.map((p) => (p.id === id ? { ...p, ...back, scale: [...back.scale] as Vec3, colors: [...back.colors] } : p)) });
  },

  setRoom: (patch) => {
    const room = { ...get().room, ...patch };
    const half = (wall: Opening["wall"]) => (wall === "back" || wall === "front" ? room.width : room.depth) / 2;
    room.openings = room.openings.map((o) => {
      const width = Math.min(o.width, half(o.wall) * 2 - 0.2), lim = Math.max(0, half(o.wall) - width / 2 - 0.05);
      return { ...o, width, centre: Math.min(lim, Math.max(-lim, o.centre)), height: Math.min(o.height, room.height - o.sill - 0.1) };
    });
    get().commit({ room, objects: get().objects.map((o) => (placeOf(o) === "wall" ? snapToWall(o, room) : clampToRoom(o, room))) });
  },
  setOpening: (id, patch) => {
    const room = get().room;
    get().setRoom({ openings: patch === null ? room.openings.filter((o) => o.id !== id) : room.openings.map((o) => (o.id === id ? { ...o, ...patch, confidence: undefined } : o)) });
  },
  addOpening: (kind) => {
    const room = get().room;
    const o: Opening = kind === "door" ? { id: newId(), wall: "front", kind, centre: 0, width: 0.82, sill: 0, height: 2.03 }
                                       : { id: newId(), wall: "back", kind, centre: 0, width: 1.2, sill: 0.92, height: 1.3 };
    get().setRoom({ openings: [...room.openings, o] });
  },

  setTool: (tool) => set({ tool, measure: { a: null, b: null } }),
  setView: (view) => set({ view }),
  addMeasurePoint: (p) => { const { a, b } = get().measure; set({ measure: !a || b ? { a: p, b: null } : { a, b: p } }); },
  clearMeasure: () => set({ measure: { a: null, b: null } }),
  rescale: (k) => {
    if (!(k > 0.2 && k < 5)) return;
    const { room, objects, scanScale } = get();
    const v = (n: number) => Math.round(n * k * 1000) / 1000;
    get().commit({
      room: { ...room, width: v(room.width), depth: v(room.depth), height: Math.min(4, v(room.height)),
              openings: room.openings.map((o) => ({ ...o, centre: v(o.centre), width: v(o.width), sill: v(o.sill), height: v(o.height) })) },
      objects: objects.map((o) => ({ ...o, x: v(o.x), z: v(o.z), y: v(o.y), scale: o.scale.map((s) => s * k) as Vec3 })),
    });
    set({ calibrated: true, scanScale: scanScale * k, measure: { a: null, b: null } });
  },
  setShowScan: (showScan) => set({ showScan }),
  setComparing: (comparing) => set({ comparing, selectedId: null }),

  openSample: () => {
    set({ ...SAMPLE, baseline: SAMPLE, past: [], future: [], selectedId: null, name: "Sample bedroom", dirty: false, scan: null, scanResult: null, showScan: false, comparing: false, calibrated: false, scanScale: 1 });
    autosave(get());
  },
  openScan: (scan, result) => {
    const design = designFromScan(result);
    set({ ...design, baseline: design, past: [], future: [], selectedId: null, name: scan.title, dirty: true, scan, scanResult: result, showScan: false, comparing: false, calibrated: false, scanScale: 1, view: "orbit", tool: "select" });
    autosave(get());
  },
  saveAs: (name) => {
    const { room, objects, scan } = get();
    const entry: SavedDesign = { name, savedAt: Date.now(), design: { room, objects }, scan };
    writeSaves([entry, ...listSaves().filter((s) => s.name !== name)]);
    set({ name, dirty: false }); autosave(get());
  },
  openSaved: (s) => {
    set({ ...s.design, baseline: s.design, past: [], future: [], selectedId: null, name: s.name, dirty: false, scan: s.scan, scanResult: null, showScan: false, comparing: false });
    autosave(get());
  },
}));

if (typeof window !== "undefined") (window as unknown as { __studio: typeof useStudio }).__studio = useStudio; // read by the tests

/** Shared, non-reactive input for walk mode so keys and the touch pad drive the same controller. */
export const walkInput = { forward: 0, strafe: 0 };
