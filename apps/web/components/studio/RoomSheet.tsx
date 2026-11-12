"use client";
import { AnimatePresence, motion } from "motion/react";
import { useStudio } from "@/lib/store";
import { metres } from "@/lib/format";
import type { Confidence, RoomMeta } from "@/lib/types";

/** Estimated values get a dashed outline, measured values a solid fill. Used everywhere a dimension appears. */
export function ConfidenceMark({ kind }: { kind: Confidence | "stated" }) {
  const style = kind === "measured" ? "bg-ink text-board border-ink" : kind === "uncalibrated" ? "border-ink bg-tape text-ink" : "border-dashed border-ink text-ink";
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

const SCALE_WORD: Record<Confidence, string> = { measured: "Known", estimated: "A guess", uncalibrated: "Unknown" };

function explain(room: RoomMeta): string {
  const walls = room.envelope.walls_found;
  const missing = walls ? Object.values(walls).filter((f) => !f).length : 0;
  const fit = "Wall and ceiling positions are fitted to the surface by software and can be off by several centimetres.";
  if (room.source.kind === "dataset")
    return `Scale comes from the depth sensor, so distances are in real metres. ${fit} The ceiling in this room slopes. Floor area is the figure published with the dataset.`;
  const parts = [
    room.scale.confidence === "measured"
      ? "You set the scale from a real measurement, so sizes follow that measurement."
      : room.scale.confidence === "estimated"
        ? "Depth was predicted from your photos by a model, and the overall size is that model's guess. Expect sizes to be off by 10% or more until you calibrate."
        : "The overall size could not be estimated, so every length here is a placeholder until you calibrate.",
    fit,
  ];
  if (room.envelope.floor_found === false) parts.push("No floor was visible, so heights are measured from the lowest point captured.");
  if (missing > 0) parts.push(`${missing} of 4 walls were not clearly visible; those sides use the edge of what was captured.`);
  parts.push("Anything the camera did not see is left empty.");
  return parts.join(" ");
}

export function RoomSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const room = useStudio((s) => s.room);
  const gain = useStudio((s) => s.gain);
  const setGain = useStudio((s) => s.setGain);
  const scan = useStudio((s) => s.scan);
  const dimKind: Confidence = room?.scale.confidence === "uncalibrated" ? "uncalibrated" : "estimated";
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          id="room-sheet" aria-label="Room details"
          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="board absolute left-3 top-[112px] z-10 max-h-[calc(100dvh-214px)] sm:max-h-[calc(100dvh-170px)] w-[min(320px,calc(100vw-24px))] overflow-y-auto p-4 sm:left-4 sm:top-[76px]"
        >
          <div className="flex items-start justify-between gap-2">
            <h2 className="display text-[26px] font-bold leading-[1.05]">
              {scan.kind === "dataset" ? "A real bedroom, captured with a depth camera" : scan.title}
            </h2>
            <button onClick={onClose} aria-label="Hide room details" className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center text-[20px] leading-none hover:bg-tape lg:hidden">×</button>
          </div>
          {room ? (
            <>
              <dl className="mt-3">
                <Row name="Longest side" value={metres(room.envelope.width_m)} kind={dimKind} />
                <Row name="Shortest side" value={metres(room.envelope.depth_m)} kind={dimKind} />
                <Row name="Highest point" value={metres(room.envelope.ceiling.max_y, 1)} kind={dimKind} />
                {room.envelope.stated_floor_area_m2 != null && (
                  <Row name="Floor area" value={`${room.envelope.stated_floor_area_m2.toFixed(1)} m²`} kind="stated" />
                )}
                <Row name="Real-world scale" value={SCALE_WORD[room.scale.confidence]} kind={room.scale.confidence} />
              </dl>
              <p className="mt-3 text-[13px] leading-[1.45] text-ink-soft">{explain(room)}</p>
              {room.scale.confidence !== "measured" && (
                <p className="mt-2 border-l-4 border-tape pl-2 text-[13px] leading-[1.45]">
                  To get real sizes: choose Measure, click the two ends of something you can measure with a tape
                  (a door is good), then enter its true length.
                </p>
              )}
              {scan.kind === "dataset" && (
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
              )}
              <p className="figures mt-3 border-t border-ink pt-2 text-[12px] leading-[1.45] text-ink-soft">
                {(room.processing.faces / 1000).toFixed(0)}k triangles
                {room.processing.views
                  ? `, built in ${Math.round(room.processing.seconds ?? 0)} s from ${room.processing.views} views (${room.source.detail}).`
                  : `. ${room.source.detail}. ${room.source.license ?? ""}`}
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
