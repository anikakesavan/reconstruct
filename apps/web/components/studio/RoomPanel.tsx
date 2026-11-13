"use client";
import { AnimatePresence, motion } from "motion/react";
import { asset, FLOORS, WALL_COLORS } from "@/lib/catalog";
import { scaledEnvelope, useStudio } from "@/lib/store";
import { metres } from "@/lib/format";
import type { Confidence, ScanMeta } from "@/lib/types";

export function ConfidenceMark({ kind }: { kind: Confidence }) {
  const style = kind === "measured" ? "bg-ink text-white" : kind === "uncalibrated" ? "bg-[#fde9c8] text-[#6b4a08]" : "border border-dashed border-ink-soft text-ink-soft";
  return <span className={`rounded px-1.5 text-[11px] font-medium leading-[18px] ${style}`}>{kind}</span>;
}

function Dim({ name, value, kind }: { name: string; value: string; kind: Confidence }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5">
      <dt className="text-[13px] text-ink-soft">{name}</dt>
      <dd className="figures flex items-baseline gap-1.5 text-[15px] font-semibold">{value}<ConfidenceMark kind={kind} /></dd>
    </div>
  );
}

function ScanSection({ meta }: { meta: ScanMeta | null }) {
  const scan = useStudio((s) => s.scan)!;
  const k = useStudio((s) => s.calibration);
  const showScan = useStudio((s) => s.showScan);
  const showRoom = useStudio((s) => s.showRoom);
  const setLayer = useStudio((s) => s.setLayer);
  const roomFromScan = useStudio((s) => s.roomFromScan);
  const closeScan = useStudio((s) => s.closeScan);
  if (!meta) return <p className="text-[13px] text-ink-soft">Reading the scan.</p>;
  const env = scaledEnvelope(meta, k);
  const scale: Confidence = k !== 1 ? "measured" : meta.scale.confidence;
  const dim: Confidence = scale === "uncalibrated" ? "uncalibrated" : "estimated";
  const q = meta.quality;
  return (
    <section>
      <h2 className="display text-[22px] font-bold leading-tight">{scan.title}</h2>
      <p className="mt-0.5 text-[12.5px] text-ink-soft">A scan from your photos. One fused surface: you can look and measure, but its furniture cannot be moved.</p>
      {q && (
        <div className={`mt-3 rounded-lg p-2.5 text-[13px] leading-[1.45] ${q.level === "good" ? "bg-accent-wash" : "bg-[#fdf1dc]"}`}>
          <p className="font-semibold">{q.level === "good" ? "Capture looks good" : q.level === "fair" ? "Capture is usable, with problems" : "Capture is poor"}</p>
          {q.issues.length > 0 && <ul className="mt-1 list-disc space-y-0.5 pl-4">{q.issues.map((i) => <li key={i.text}>{i.text}</li>)}</ul>}
        </div>
      )}
      <dl className="mt-2">
        <Dim name="Longest side" value={metres(env.width)} kind={dim} />
        <Dim name="Shortest side" value={metres(env.depth)} kind={dim} />
        <Dim name="Highest point" value={metres(env.height, 1)} kind={dim} />
        <Dim name="Real-world scale" value={scale === "measured" ? "Set by you" : scale === "estimated" ? "A guess" : "Unknown"} kind={scale} />
      </dl>
      {scale !== "measured" && (
        <p className="mt-2 text-[12.5px] leading-[1.45] text-ink-soft">
          To fix the size, choose Measure, click both ends of something you can check with a tape (a door works), and enter its true length.
        </p>
      )}
      <button className="btn btn-primary mt-3 w-full" onClick={roomFromScan}>{showRoom ? "Resize the clean room to this scan" : "Make a clean room this size"}</button>
      <p className="mt-1.5 text-[12.5px] leading-[1.45] text-ink-soft">
        Builds straight walls and a floor at the scan&apos;s estimated size, empty and ready to furnish from the catalogue. The scan stays as a faint guide.
      </p>
      <div className="mt-3 flex gap-4 text-[13.5px]">
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-(--color-accent)" checked={showScan} onChange={(e) => setLayer("showScan", e.target.checked)} />Show scan</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-(--color-accent)" checked={showRoom} onChange={(e) => setLayer("showRoom", e.target.checked)} />Show clean room</label>
      </div>
      <button className="mt-3 text-[13px] font-medium underline" onClick={closeScan}>Close this scan</button>
    </section>
  );
}

function DesignSection() {
  const room = useStudio((s) => s.room);
  const setRoom = useStudio((s) => s.setRoom);
  const reset = useStudio((s) => s.resetToSample);
  const count = useStudio((s) => s.objects.length);
  const num = (key: "width" | "depth" | "height", label: string, min: number, max: number) => (
    <label className="label">
      {label}
      <input type="number" inputMode="decimal" className="field figures mt-1 font-semibold text-ink" min={min} max={max} step={0.05} value={room[key]}
        onChange={(e) => { const n = Number(e.target.value); if (n >= min && n <= max) setRoom({ [key]: n }); }} />
    </label>
  );
  return (
    <section>
      <h2 className="display text-[22px] font-bold leading-tight">Room</h2>
      <p className="mt-0.5 text-[12.5px] text-ink-soft">
        {room.origin === "scan" ? "Sized from your scan. The numbers are estimates until you check them."
          : "A sample bedroom designed for this app. It is not a scan of a real room."}
      </p>
      <h3 className="label mt-4">Walls</h3>
      <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Wall colour">
        {WALL_COLORS.map((c) => (
          <button key={c.hex} role="radio" aria-checked={room.wallColor === c.hex} aria-label={c.name} title={c.name} onClick={() => setRoom({ wallColor: c.hex })}
            className={`h-9 w-9 rounded-full border ${room.wallColor === c.hex ? "border-accent ring-2 ring-accent ring-offset-2" : "border-line"}`} style={{ background: c.hex }} />
        ))}
      </div>
      <h3 className="label mt-4">Floor</h3>
      <div className="mt-1.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Flooring">
        {FLOORS.map((f) => (
          <button key={f.id} role="radio" aria-checked={room.floor === f.id} onClick={() => setRoom({ floor: f.id })}
            className={`overflow-hidden rounded-lg border text-left ${room.floor === f.id ? "border-accent ring-2 ring-accent ring-offset-1" : "border-line"}`}>
            <span className="block h-12 bg-cover bg-center" style={{ backgroundImage: `url(${asset(`/textures/${f.id}/diff.webp`)})` }} />
            <span className="block px-1.5 py-1 text-[12px] font-medium leading-tight">{f.name}</span>
          </button>
        ))}
      </div>
      <h3 className="label mt-4">Size, in metres</h3>
      <div className="mt-1.5 grid grid-cols-3 gap-2">{num("width", "Width", 1.8, 10)}{num("depth", "Depth", 1.8, 10)}{num("height", "Height", 2.2, 3.6)}</div>
      <p className="figures mt-3 border-t border-line pt-2 text-[12.5px] text-ink-soft">
        {(room.width * room.depth).toFixed(1)} m² of floor, {count} {count === 1 ? "piece" : "pieces"}. Changes save in this browser.
      </p>
      <button className="mt-2 text-[13px] font-medium underline" onClick={reset}>Start again from the sample bedroom</button>
    </section>
  );
}

export function RoomPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scan = useStudio((s) => s.scan);
  const meta = useStudio((s) => s.scanMeta);
  const showRoom = useStudio((s) => s.showRoom);
  return (
    <AnimatePresence>
      {open && (
        <motion.aside id="room-panel" aria-label="Room"
          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18, ease: "easeOut" }}
          className="panel absolute left-3 top-[120px] z-20 max-h-[calc(100dvh-220px)] w-[min(320px,calc(100vw-24px))] overflow-y-auto p-4 sm:left-4 sm:top-[76px] sm:max-h-[calc(100dvh-176px)]">
          <button onClick={onClose} aria-label="Close room panel" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-md text-[20px] leading-none hover:bg-wash lg:hidden">×</button>
          {scan && <ScanSection meta={meta} />}
          {scan && showRoom && <hr className="my-4 border-line" />}
          {showRoom && <DesignSection />}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
