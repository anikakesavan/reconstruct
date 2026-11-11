"use client";
import { AnimatePresence, motion } from "motion/react";
import { useStudio } from "@/lib/store";
import { metres } from "@/lib/format";
import type { Confidence } from "@/lib/types";

/** Estimated values get a dashed outline, measured values a solid fill. Used everywhere a dimension appears. */
export function ConfidenceMark({ kind }: { kind: Confidence | "stated" }) {
  const style = kind === "measured" ? "bg-ink text-board border-ink" : "border-dashed border-ink text-ink";
  return <span className={`rounded-[2px] border px-1 text-[11px] font-medium leading-4 ${style}`}>{kind}</span>;
}

function Row({ name, value, kind }: { name: string; value: string; kind: Confidence | "stated" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-board-edge py-1.5">
      <dt className="text-[13px] text-ink-soft">{name}</dt>
      <dd className="figures flex items-baseline gap-1.5 text-[15px] font-semibold">{value}<ConfidenceMark kind={kind} /></dd>
    </div>
  );
}

export function RoomSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const room = useStudio((s) => s.room);
  const gain = useStudio((s) => s.gain);
  const setGain = useStudio((s) => s.setGain);
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          id="room-sheet" aria-label="Room details"
          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="board absolute left-3 top-[68px] z-10 max-h-[calc(100dvh-170px)] w-[min(320px,calc(100vw-24px))] overflow-y-auto p-4 sm:left-4 sm:top-[76px]"
        >
          <div className="flex items-start justify-between">
            <h2 className="display text-[26px] font-bold leading-[1.05]">A real bedroom,<br />captured with a depth camera</h2>
            <button onClick={onClose} aria-label="Hide room details" className="-mr-1 -mt-1 grid h-8 w-8 place-items-center text-[20px] leading-none hover:bg-tape lg:hidden">×</button>
          </div>
          {room ? (
            <>
              <dl className="mt-3">
                <Row name="Longest side" value={metres(room.envelope.width_m)} kind="estimated" />
                <Row name="Shortest side" value={metres(room.envelope.depth_m)} kind="estimated" />
                <Row name="Ceiling, highest point" value={metres(room.envelope.ceiling.max_y, 1)} kind="estimated" />
                <Row name="Floor area" value={`${room.envelope.dataset_stated_floor_area_m2.toFixed(1)} m²`} kind="stated" />
              </dl>
              <p className="mt-3 text-[13px] leading-[1.45] text-ink-soft">
                Scale comes from the depth sensor, so distances are in real metres. Wall and ceiling positions are fitted
                to the mesh by software and can be off by several centimetres. The ceiling in this room slopes. Floor
                area is the figure published with the dataset.
              </p>
              <label className="mt-3 block text-[13px] font-medium">
                Scan brightness
                <input
                  type="range" min={1} max={2.5} step={0.05} value={gain} onChange={(e) => setGain(Number(e.target.value))}
                  className="mt-1 block w-full accent-ink"
                />
                <span className="text-[12px] font-normal text-ink-soft">
                  {gain === 1 ? "Exactly as captured." : "Brightened for viewing. The room was scanned in dim light."}
                </span>
              </label>
              <p className="figures mt-3 border-t border-ink pt-2 text-[12px] leading-[1.45] text-ink-soft">
                Showing {(room.processing.faces / 1000).toFixed(0)}k of the original{" "}
                {(room.processing.original_faces / 1e6).toFixed(1)}M triangles. Source: {room.source.dataset}, Park, Zhou
                and Koltun (ICCV 2017). {room.source.license}.
              </p>
            </>
          ) : (
            <p className="mt-3 text-[13px] text-ink-soft">Reading room dimensions.</p>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
