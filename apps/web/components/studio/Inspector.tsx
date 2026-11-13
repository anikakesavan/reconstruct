"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CATALOG, ITEM, PALETTES, thumbUrl, type PartKind } from "@/lib/catalog";
import { dims } from "@/lib/placement";
import { ROT_STEP, useStudio } from "@/lib/store";
import { distance, metres } from "@/lib/format";
import type { Vec3 } from "@/lib/types";
import { Sureness } from "./RoomPanel";

const GROUPS: { id: PartKind | "leather"; name: string }[] = [
  { id: "fabric", name: "Fabric" }, { id: "leather", name: "Leather" }, { id: "wood", name: "Wood" }, { id: "metal", name: "Metal" }, { id: "paint", name: "Paint" },
];

function PartColour({ id, index }: { id: string; index: number }) {
  const o = useStudio((s) => s.objects.find((x) => x.id === id))!;
  const patch = useStudio((s) => s.patch);
  const part = ITEM[o.item].parts[index];
  const [group, setGroup] = useState<PartKind | "leather">(part.kind);
  const current = o.colors[index];
  const set = (hex: string | null) => patch(o.id, { colors: o.colors.map((c, i) => (i === index ? hex : c)) });
  return (
    <div className="mt-2 rounded-lg border border-line p-2">
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-6 w-6 shrink-0 rounded-full border border-line" style={{ background: current ?? part.color }} />
        <span className="text-[13px] font-medium">Part {index + 1}<span className="font-normal text-ink-soft"> · {Math.round(part.share * 100)}% of the surface</span></span>
        {current && <button className="ml-auto text-[12px] font-medium underline" onClick={() => set(null)}>Original</button>}
      </div>
      <div className="mt-2 flex gap-1" role="tablist" aria-label={`Material family for part ${index + 1}`}>
        {GROUPS.map((g) => (
          <button key={g.id} role="tab" aria-selected={group === g.id} onClick={() => setGroup(g.id)}
            className={`h-6 rounded-full px-2 text-[11.5px] font-medium ${group === g.id ? "bg-ink text-white" : "text-ink-soft hover:bg-wash"}`}>{g.name}</button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Colour for part ${index + 1}`}>
        {PALETTES[group].map((c) => (
          <button key={c.hex} role="radio" aria-checked={current === c.hex} aria-label={`${c.name} ${group}`} title={c.name} onClick={() => set(c.hex)}
            className={`h-7 w-7 rounded-full border ${current === c.hex ? "border-accent ring-2 ring-accent ring-offset-1" : "border-line"}`} style={{ background: c.hex }} />
        ))}
        <label className="relative grid h-7 w-7 cursor-pointer place-items-center rounded-full border border-dashed border-ink-soft text-[14px]" title="Any colour">
          +<input type="color" aria-label={`Custom colour for part ${index + 1}`} value={current ?? part.color} onChange={(e) => set(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>
    </div>
  );
}

function ObjectPanel({ id }: { id: string }) {
  const o = useStudio((s) => s.objects.find((x) => x.id === id));
  const patch = useStudio((s) => s.patch);
  const remove = useStudio((s) => s.remove);
  const duplicate = useStudio((s) => s.duplicate);
  const replace = useStudio((s) => s.replace);
  const restore = useStudio((s) => s.restore);
  const parentName = useStudio((s) => { const p = s.objects.find((x) => x.id === o?.parent); return p ? ITEM[p.item].name : null; });
  const [showAll, setShowAll] = useState(false);
  if (!o) return null;
  const def = ITEM[o.item];
  const same = CATALOG.filter((i) => i.cls === def.cls && i.id !== def.id);
  const others = CATALOG.filter((i) => i.category === def.category && i.cls !== def.cls && i.place === def.place);
  const size = dims(o);
  const deg = Math.round((((o.rot * 180) / Math.PI) % 360 + 360) % 360);
  const moved = o.detected && JSON.stringify({ ...o.detected.original }) !== JSON.stringify({ item: o.item, x: o.x, z: o.z, y: o.y, rot: o.rot, scale: o.scale, colors: o.colors });
  const setDim = (axis: 0 | 1 | 2, cm: number) => {
    if (!(cm >= 5 && cm <= 400)) return;
    const scale = [...o.scale] as Vec3; scale[axis] = cm / 100 / def.size[axis]; patch(o.id, { scale });
  };
  return (
    <>
      <p className="label">{def.category}</p>
      <h2 className="display pr-14 text-[22px] font-bold leading-tight sm:pr-0">{def.name}</h2>
      {o.detected && (
        <div className="mt-2 rounded-lg bg-wash p-2 text-[12.5px] leading-[1.45]">
          <p className="flex items-center justify-between gap-2"><span>Found in your scan as “{o.detected.label}”, in {o.detected.views} {o.detected.views === 1 ? "photo" : "photos"}.</span><Sureness value={o.detected.confidence} /></p>
          {o.detected.confidence < 0.5 && <p className="mt-1 text-ink-soft">Low confidence: check its position and size.</p>}
          {moved && <button className="mt-1.5 font-medium underline" onClick={() => restore(o.id)}>Put back as it was found</button>}
        </div>
      )}
      {parentName && <p className="mt-2 text-[12.5px] text-ink-soft">Sitting on the {parentName.toLowerCase()}; it moves with it.</p>}

      {def.parts.length > 0 && (
        <>
          <h3 className="label mt-4">Materials and colour</h3>
          {def.parts.map((_, i) => <PartColour key={`${o.item}-${i}`} id={o.id} index={i} />)}
        </>
      )}

      <h3 className="label mt-4">Size, in cm</h3>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {(["Width", "Height", "Depth"] as const).map((label, i) => (
          <label key={label} className="text-[12px] text-ink-soft">{label}
            <input type="number" inputMode="numeric" min={5} max={400} step={1} value={Math.round(size[i] * 100)} onChange={(e) => setDim(i as 0 | 1 | 2, Number(e.target.value))}
              className="field figures mt-0.5 !h-9 font-semibold text-ink" />
          </label>
        ))}
      </div>
      {o.scale.some((s) => Math.abs(s - 1) > 0.005) && <button className="mt-1 text-[12.5px] font-medium underline" onClick={() => patch(o.id, { scale: [1, 1, 1] })}>Back to the piece&apos;s real size</button>}

      {def.place !== "wall" && (
        <>
          <h3 className="label mt-4">Turn</h3>
          <div className="mt-1.5 flex items-center gap-2">
            <button className="btn" onClick={() => patch(o.id, { rot: o.rot + ROT_STEP })} aria-label="Turn left 15 degrees">⟲ 15°</button>
            <button className="btn" onClick={() => patch(o.id, { rot: o.rot - ROT_STEP })} aria-label="Turn right 15 degrees">15° ⟳</button>
            <span className="figures ml-auto text-[13px] text-ink-soft">{deg}°. Or drag the round handle.</span>
          </div>
        </>
      )}
      {def.place === "wall" && (
        <label className="label mt-4 block">Height on the wall, cm
          <input type="number" min={0} max={350} step={5} value={Math.round(o.y * 100)} onChange={(e) => { const n = Number(e.target.value); if (n >= 0 && n <= 350) patch(o.id, { y: n / 100 }); }} className="field figures mt-1 font-semibold text-ink" />
        </label>
      )}

      {(same.length > 0 || others.length > 0) && (
        <>
          <h3 className="label mt-4">Swap for</h3>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {[...same, ...(showAll ? others : [])].map((a) => (
              <button key={a.id} onClick={() => replace(o.id, a.id)} title={a.name} aria-label={`Swap for ${a.name}`} className="overflow-hidden rounded-md border border-line hover:border-accent">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbUrl(a.id)} alt="" width={80} height={80} className="aspect-square w-full bg-wash object-cover" />
              </button>
            ))}
          </div>
          {others.length > 0 && !showAll && <button className="mt-1 text-[12.5px] font-medium underline" onClick={() => setShowAll(true)}>More in {def.category.toLowerCase()}</button>}
        </>
      )}

      <div className="mt-4 flex gap-2 border-t border-line pt-3">
        <button className="btn flex-1" onClick={() => duplicate(o.id)}>Duplicate</button>
        <button className="btn flex-1" onClick={() => remove(o.id)}>Remove</button>
      </div>
    </>
  );
}

function MeasurePanel() {
  const { a, b } = useStudio((s) => s.measure);
  const clear = useStudio((s) => s.clearMeasure);
  const rescale = useStudio((s) => s.rescale);
  const fromScan = useStudio((s) => s.room.origin === "scan");
  const calibrated = useStudio((s) => s.calibrated);
  return (
    <>
      <h2 className="display text-[22px] font-bold leading-tight">Measure</h2>
      {a && b ? (
        <>
          <p className="figures mt-1 text-[34px] font-extrabold leading-none">{metres(distance(a, b))}</p>
          <p className="figures mt-1 text-[13px] text-ink-soft">{metres(Math.hypot(a[0] - b[0], a[2] - b[2]))} along the floor, {metres(Math.abs(a[1] - b[1]))} in height.</p>
          {fromScan && (
            <form className="mt-3 border-t border-line pt-3" onSubmit={(e) => { e.preventDefault(); const real = Number(new FormData(e.currentTarget).get("real")); if (real > 0) rescale(real / distance(a, b)); }}>
              <p className="text-[12.5px] leading-[1.45] text-ink-soft">{calibrated ? "Sizes follow the measurement you entered." : "This room's size is a guess from your photos, so this number is too."}</p>
              <label className="label mt-2 block">
                True length of this line, in metres
                <span className="mt-1 flex gap-2">
                  <input name="real" type="number" inputMode="decimal" min={0.05} max={50} step={0.001} required placeholder="e.g. 0.76" className="field figures min-w-0 font-semibold text-ink" />
                  <button className="btn btn-primary shrink-0">Set scale</button>
                </span>
              </label>
              <p className="mt-1 text-[12px] text-ink-soft">Resizes the room and everything in it to match.</p>
            </form>
          )}
          <button className="btn mt-3" onClick={clear}>Clear</button>
        </>
      ) : (
        <p className="mt-1 text-[14px]">{a ? "Now click the second point." : "Click two points: on the floor, a wall or a piece of furniture."}</p>
      )}
    </>
  );
}

export function Inspector() {
  const [folded, setFolded] = useState(false);
  const tool = useStudio((s) => s.tool);
  const selectedId = useStudio((s) => s.selectedId);
  const kind = tool === "measure" ? "measure" : selectedId ? "object" : null;
  return (
    <AnimatePresence mode="wait">
      {kind && (
        <motion.aside key={kind + (selectedId ?? "")} aria-label="Inspector"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.14 }}
          className={`panel absolute inset-x-3 bottom-[84px] z-20 overflow-y-auto p-4 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-[76px] sm:!max-h-[calc(100dvh-176px)] sm:w-[310px] ${folded ? "max-h-[76px] overflow-hidden" : "max-h-[40dvh]"}`}>
          {/* on a phone the sheet can be folded down so the room stays in view while dragging */}
          <button onClick={() => setFolded((f) => !f)} aria-expanded={!folded} className="btn absolute right-2 top-2 !min-h-8 !px-2.5 !text-[12.5px] sm:hidden">{folded ? "Edit" : "Fold"}</button>
          {kind === "object" && selectedId && <ObjectPanel id={selectedId} />}
          {kind === "measure" && <MeasurePanel />}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
