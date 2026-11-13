"use client";
import { AnimatePresence, motion } from "motion/react";
import { CATALOG, ITEM, TINTS, WOODS, asset } from "@/lib/catalog";
import { ROT_STEP, useStudio } from "@/lib/store";
import { distance, metres } from "@/lib/format";

function ObjectPanel({ id }: { id: string }) {
  const o = useStudio((s) => s.objects.find((x) => x.id === id));
  const patch = useStudio((s) => s.patch);
  const remove = useStudio((s) => s.remove);
  const duplicate = useStudio((s) => s.duplicate);
  const replace = useStudio((s) => s.replace);
  if (!o) return null;
  const def = ITEM[o.item];
  const alternatives = CATALOG.filter((i) => i.category === def.category && i.id !== def.id);
  const deg = Math.round((((o.rot * 180) / Math.PI) % 360 + 360) % 360);
  return (
    <>
      <p className="label">{def.category}</p>
      <h2 className="display text-[22px] font-bold leading-tight">{def.name}</h2>

      <h3 className="label mt-4">{def.kind === "built" ? "Fabric colour" : "Colour"}</h3>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Colour">
        <button role="radio" aria-checked={o.tint === null} onClick={() => patch(o.id, { tint: null })} title="As made"
          className={`grid h-8 w-8 place-items-center rounded-full border text-[11px] ${o.tint === null ? "border-accent ring-2 ring-accent ring-offset-1" : "border-line"}`}>
          <span aria-hidden className="h-[1.5px] w-5 -rotate-45 bg-ink-soft" /><span className="sr-only">As made</span>
        </button>
        {TINTS.map((t) => (
          <button key={t.hex} role="radio" aria-checked={o.tint === t.hex} aria-label={t.name} title={t.name} onClick={() => patch(o.id, { tint: t.hex })}
            className={`h-8 w-8 rounded-full border ${o.tint === t.hex ? "border-accent ring-2 ring-accent ring-offset-1" : "border-line"}`} style={{ background: t.hex }} />
        ))}
      </div>
      {def.kind === "model" && <p className="mt-1 text-[12px] text-ink-soft">Tints the piece&apos;s own materials, so dark pieces stay dark.</p>}

      {def.wood && (
        <>
          <h3 className="label mt-4">Wood</h3>
          <div className="mt-1.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Wood finish">
            {WOODS.map((w) => (
              <button key={w.id} role="radio" aria-checked={(o.finish ?? WOODS[0].id) === w.id} onClick={() => patch(o.id, { finish: w.id })}
                className={`overflow-hidden rounded-lg border text-left ${(o.finish ?? WOODS[0].id) === w.id ? "border-accent ring-2 ring-accent ring-offset-1" : "border-line"}`}>
                <span className="block h-9 bg-cover bg-center" style={{ backgroundImage: `url(${asset(`/textures/${w.id}/diff.webp`)})` }} />
                <span className="block px-1.5 py-1 text-[12px] font-medium">{w.name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <h3 className="label mt-4">Turn</h3>
      <div className="mt-1.5 flex items-center gap-2">
        <button className="btn" onClick={() => patch(o.id, { rot: o.rot + ROT_STEP })} aria-label="Turn left 15 degrees">⟲ 15°</button>
        <button className="btn" onClick={() => patch(o.id, { rot: o.rot - ROT_STEP })} aria-label="Turn right 15 degrees">15° ⟳</button>
        <span className="figures ml-auto text-[13px] text-ink-soft">{deg}°</span>
      </div>

      <label className="label mt-4 block">
        Height off the floor, m
        <input type="number" inputMode="decimal" className="field figures mt-1 font-semibold text-ink" min={0} max={3} step={0.01} value={Number(o.y.toFixed(2))}
          onChange={(e) => { const n = Number(e.target.value); if (n >= 0 && n <= 3) patch(o.id, { y: n }); }} />
      </label>

      {alternatives.length > 0 && (
        <>
          <h3 className="label mt-4">Swap for</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {alternatives.map((a) => <button key={a.id} className="btn !min-h-8 !px-2.5 !text-[13px]" onClick={() => replace(o.id, a.id)}>{a.name}</button>)}
          </div>
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
  const calibrate = useStudio((s) => s.calibrate);
  const scan = useStudio((s) => s.scan);
  const showRoom = useStudio((s) => s.showRoom);
  const calibrated = useStudio((s) => s.calibration !== 1);
  return (
    <>
      <h2 className="display text-[22px] font-bold leading-tight">Measure</h2>
      {a && b ? (
        <>
          <p className="figures mt-1 text-[34px] font-extrabold leading-none">{metres(distance(a, b))}</p>
          <p className="figures mt-1 text-[13px] text-ink-soft">{metres(Math.hypot(a[0] - b[0], a[2] - b[2]))} along the floor, {metres(Math.abs(a[1] - b[1]))} in height.</p>
          {scan && !showRoom && (
            <>
              <p className="mt-2 text-[12.5px] leading-[1.45] text-ink-soft">
                {calibrated ? "Based on the scale you set. Expect a few centimetres of error." : "This scan's size is a guess, so this number is too."}
              </p>
              <form className="mt-3 border-t border-line pt-3" onSubmit={(e) => { e.preventDefault(); const real = Number(new FormData(e.currentTarget).get("real")); if (real > 0) calibrate(real / distance(a, b)); }}>
                <label className="label">
                  True length of this line, in metres
                  <span className="mt-1 flex gap-2">
                    <input name="real" type="number" inputMode="decimal" min={0.05} max={50} step={0.001} required placeholder="e.g. 0.76" className="field figures min-w-0 font-semibold text-ink" />
                    <button className="btn btn-primary shrink-0">Set scale</button>
                  </span>
                </label>
                <p className="mt-1 text-[12px] text-ink-soft">Resizes the whole scan to match.</p>
              </form>
            </>
          )}
          <button className="btn mt-3" onClick={clear}>Clear</button>
        </>
      ) : (
        <p className="mt-1 text-[14px]">{a ? "Now click the second point." : "Click two points: on the floor, a wall, furniture or a scan."}</p>
      )}
    </>
  );
}

export function Inspector() {
  const tool = useStudio((s) => s.tool);
  const selectedId = useStudio((s) => s.selectedId);
  const kind = tool === "measure" ? "measure" : selectedId ? "object" : null;
  return (
    <AnimatePresence mode="wait">
      {kind && (
        <motion.aside key={kind + (selectedId ?? "")} aria-label="Inspector"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.14 }}
          className="panel absolute inset-x-3 bottom-[84px] z-20 max-h-[46dvh] overflow-y-auto p-4 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-[76px] sm:max-h-[calc(100dvh-176px)] sm:w-[300px]">
          {kind === "object" && selectedId && <ObjectPanel id={selectedId} />}
          {kind === "measure" && <MeasurePanel />}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
