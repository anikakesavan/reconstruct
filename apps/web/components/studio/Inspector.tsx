"use client";
import { AnimatePresence, motion } from "motion/react";
import { useStudio } from "@/lib/store";
import { distance, metres } from "@/lib/format";
import type { Vec3 } from "@/lib/types";

const btn = "min-h-10 border border-ink px-3 text-[14px] font-medium rounded-[2px] hover:bg-tape";
const AXES = ["Width", "Height", "Depth"] as const;

function VolumePanel({ id }: { id: string }) {
  const v = useStudio((s) => s.volumes.find((x) => x.id === id));
  const update = useStudio((s) => s.updateVolume);
  const remove = useStudio((s) => s.removeVolume);
  if (!v) return null;
  return (
    <>
      <h2 className="display text-[22px] font-bold leading-tight">{v.label}</h2>
      <p className="text-[13px] text-ink-soft">A stand-in box. Drag it across the floor.</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {AXES.map((axis, i) => (
          <label key={axis} className="text-[12px] text-ink-soft">
            {axis}, m
            <input
              type="number" inputMode="decimal" min={0.1} max={4} step={0.05} value={v.size[i]}
              onChange={(e) => {
                const n = Math.min(4, Math.max(0.1, Number(e.target.value) || 0.1));
                const size = [...v.size] as Vec3; size[i] = n; update(v.id, { size });
              }}
              className="figures mt-0.5 block h-10 w-full select-text rounded-[2px] border border-ink bg-white px-2 text-[15px] font-semibold text-ink"
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button className={btn} onClick={() => update(v.id, { quarterTurns: (v.quarterTurns + 1) % 4 })}>Turn 90°</button>
        <button className={btn} onClick={() => remove(v.id)}>Remove</button>
      </div>
      <p className="mt-3 text-[12px] leading-[1.45] text-ink-soft">
        Snaps every 5 cm and stops at the estimated walls. It does not yet stop at scanned furniture.
      </p>
    </>
  );
}

function MeasurePanel() {
  const { a, b } = useStudio((s) => s.measure);
  const clear = useStudio((s) => s.clearMeasure);
  const calibrate = useStudio((s) => s.calibrate);
  const scale = useStudio((s) => s.room?.scale.confidence);
  const uploaded = useStudio((s) => s.scan.kind === "upload");
  return (
    <>
      <h2 className="display text-[22px] font-bold leading-tight">Measure</h2>
      {a && b ? (
        <>
          <p className="figures mt-1 text-[34px] font-extrabold leading-none">{metres(distance(a, b))}</p>
          <p className="figures mt-1 text-[13px] text-ink-soft">
            {metres(Math.hypot(a[0] - b[0], a[2] - b[2]))} along the floor, {metres(Math.abs(a[1] - b[1]))} in height.
          </p>
          <p className="mt-2 text-[12px] leading-[1.45] text-ink-soft">
            {scale === "measured"
              ? "Read from the scan surface. Expect a few centimetres of error; check with a tape before buying to fit."
              : "This scan's size is a guess, so this number is too. Calibrate below to fix every length at once."}
          </p>
          {uploaded && (
            <form
              className="mt-3 border-t border-board-edge pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                const real = Number(new FormData(e.currentTarget).get("real"));
                if (real > 0) calibrate(real / distance(a, b));
              }}
            >
              <label className="text-[13px] font-medium">
                True length of this line, in metres
                <span className="mt-1 flex gap-2">
                  <input name="real" type="number" inputMode="decimal" min={0.05} max={50} step={0.001} required placeholder="e.g. 0.76"
                    className="figures h-10 w-full min-w-0 select-text rounded-[2px] border border-ink bg-white px-2 text-[15px] font-semibold" />
                  <button className={`${btn} shrink-0 bg-tape`}>Set scale</button>
                </span>
              </label>
              <p className="mt-1 text-[12px] leading-[1.45] text-ink-soft">Resizes the whole room to match. Boxes you added are cleared.</p>
            </form>
          )}
          <button className={`${btn} mt-3`} onClick={clear}>Clear</button>
        </>
      ) : (
        <p className="mt-1 text-[14px]">{a ? "Now click the second point." : "Click two points on the room."}</p>
      )}
    </>
  );
}

function InspectPanel() {
  const probe = useStudio((s) => s.probe);
  return (
    <>
      <h2 className="display text-[22px] font-bold leading-tight">Inspect</h2>
      {probe ? (
        <>
          <p className="figures mt-1 text-[34px] font-extrabold leading-none">{metres(Math.max(0, probe.point[1]))}</p>
          <p className="text-[13px] text-ink-soft">above the floor</p>
          <p className="mt-2 text-[14px]">Looks like: {probe.surface}.</p>
          <p className="mt-1 text-[12px] leading-[1.45] text-ink-soft">Guessed from which way the surface faces. Objects are not recognised yet.</p>
        </>
      ) : (
        <p className="mt-1 text-[14px]">Click any surface in the room.</p>
      )}
    </>
  );
}

export function Inspector() {
  const tool = useStudio((s) => s.tool);
  const selectedId = useStudio((s) => s.selectedId);
  const kind = tool === "measure" ? "measure" : tool === "inspect" ? "inspect" : selectedId ? "volume" : null;
  return (
    <AnimatePresence mode="wait">
      {kind && (
        <motion.aside
          key={kind} aria-label="Inspector" aria-live="polite"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.15 }}
          className="board absolute inset-x-3 bottom-[88px] z-10 p-4 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-[76px] sm:w-[300px]"
        >
          {kind === "volume" && selectedId && <VolumePanel id={selectedId} />}
          {kind === "measure" && <MeasurePanel />}
          {kind === "inspect" && <InspectPanel />}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
