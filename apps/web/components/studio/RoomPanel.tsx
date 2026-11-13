"use client";
import { AnimatePresence, motion } from "motion/react";
import { asset, FLOORS, ITEM, WALL_COLORS } from "@/lib/catalog";
import { useStudio } from "@/lib/store";
import type { Confidence, Opening, WallId } from "@/lib/types";

export function ConfidenceMark({ kind }: { kind: Confidence }) {
  const style = kind === "measured" ? "bg-ink text-white" : kind === "uncalibrated" ? "bg-[#fde9c8] text-[#6b4a08]" : "border border-dashed border-ink-soft text-ink-soft";
  return <span className={`rounded px-1.5 text-[11px] font-medium leading-[18px] ${style}`}>{kind}</span>;
}
/** How sure the detector was, as a small bar. */
export function Sureness({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span className="inline-flex items-center gap-1.5" title={`${pct}% sure`}>
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-wash"><span className={`block h-full ${value < 0.5 ? "bg-[#d99a2b]" : "bg-accent"}`} style={{ width: `${pct}%` }} /></span>
      <span className="figures text-[11.5px] text-ink-soft">{pct}%</span>
    </span>
  );
}

const WALL_NAME: Record<WallId, string> = { back: "Back wall", front: "Front wall", left: "Left wall", right: "Right wall" };

function ScanSection() {
  const r = useStudio((s) => s.scanResult)!;
  const objects = useStudio((s) => s.objects);
  const select = useStudio((s) => s.select);
  const calibrated = useStudio((s) => s.calibrated);
  const showScan = useStudio((s) => s.showScan);
  const setShowScan = useStudio((s) => s.setShowScan);
  const found = objects.filter((o) => o.detected);
  const scale: Confidence = calibrated ? "measured" : r.scale.confidence;
  return (
    <section>
      <h2 className="display text-[22px] font-bold leading-tight">From your scan</h2>
      <p className="mt-0.5 text-[12.5px] leading-[1.45] text-ink-soft">
        The walls and each piece below were located in your photos and replaced with the closest catalogue match. Sizes and positions are estimates; fix anything that is off.
      </p>
      <div className={`mt-3 rounded-lg p-2.5 text-[13px] leading-[1.45] ${r.quality.level === "good" ? "bg-accent-wash" : "bg-[#fdf1dc]"}`}>
        <p className="font-semibold">{r.quality.level === "good" ? "Capture looks good" : r.quality.level === "fair" ? "Capture is usable, with problems" : "Capture is poor: add more photos"}</p>
        {r.quality.issues.length > 0 && <ul className="mt-1 list-disc space-y-0.5 pl-4">{r.quality.issues.map((i) => <li key={i.text}>{i.text}</li>)}</ul>}
      </div>
      <h3 className="label mt-3">Found ({found.length})</h3>
      {found.length === 0 && <p className="text-[13px]">No furniture could be placed with enough confidence. Add pieces from the catalogue, or scan again with more views.</p>}
      <ul>
        {found.map((o) => (
          <li key={o.id}>
            <button onClick={() => select(o.id)} className="flex w-full items-center justify-between gap-2 border-b border-line py-1.5 text-left text-[13.5px] hover:bg-wash">
              <span className="min-w-0 truncate"><span className="font-medium capitalize">{o.detected!.label}</span> <span className="text-ink-soft">as {ITEM[o.item].name.toLowerCase()}</span></span>
              <Sureness value={o.detected!.confidence} />
            </button>
          </li>
        ))}
      </ul>
      {r.skipped.length > 0 && (
        <details className="mt-2 text-[12.5px] text-ink-soft">
          <summary className="cursor-pointer font-medium">Seen but not placed ({r.skipped.length})</summary>
          <ul className="mt-1 list-disc pl-4">{r.skipped.map((s, i) => <li key={i}><span className="capitalize">{s.label}</span>: {s.reason}</li>)}</ul>
        </details>
      )}
      <div className="mt-3 flex items-center justify-between text-[13px]">
        <span className="text-ink-soft">Real-world size</span>
        <span className="flex items-center gap-1.5 font-semibold">{scale === "measured" ? "Set by you" : scale === "estimated" ? "A guess" : "Unknown"}<ConfidenceMark kind={scale} /></span>
      </div>
      {scale !== "measured" && <p className="mt-1 text-[12.5px] leading-[1.45] text-ink-soft">To fix it, choose Measure, click both ends of something you can check with a tape, and enter its true length.</p>}
      <label className="mt-3 flex items-center gap-2 text-[13.5px]"><input type="checkbox" className="h-4 w-4 accent-(--color-accent)" checked={showScan} onChange={(e) => setShowScan(e.target.checked)} />Overlay the raw scan to check the match</label>
    </section>
  );
}

function OpeningRow({ o }: { o: Opening }) {
  const room = useStudio((s) => s.room);
  const setOpening = useStudio((s) => s.setOpening);
  const length = o.wall === "back" || o.wall === "front" ? room.width : room.depth;
  const lim = Math.max(0, length / 2 - o.width / 2 - 0.05);
  return (
    <li className="border-b border-line py-2">
      <div className="flex items-center gap-2">
        <span className="w-[58px] text-[13.5px] font-medium capitalize">{o.kind}</span>
        <select aria-label={`${o.kind} wall`} value={o.wall} onChange={(e) => setOpening(o.id, { wall: e.target.value as WallId, centre: 0 })} className="h-8 min-w-0 flex-1 rounded-md border border-line bg-white px-1.5 text-[13px]">
          {(Object.keys(WALL_NAME) as WallId[]).map((w) => <option key={w} value={w}>{WALL_NAME[w]}</option>)}
        </select>
        {o.confidence !== undefined && <Sureness value={o.confidence} />}
        <button aria-label={`Remove ${o.kind}`} onClick={() => setOpening(o.id, null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[18px] leading-none hover:bg-wash">×</button>
      </div>
      <div className="mt-1.5 grid grid-cols-[1fr_84px] items-center gap-2">
        <input type="range" aria-label={`${o.kind} position along the wall`} min={-lim} max={lim} step={0.05} value={Math.min(lim, Math.max(-lim, o.centre))} onChange={(e) => setOpening(o.id, { centre: Number(e.target.value) })} className="w-full accent-(--color-accent)" />
        <label className="flex items-center gap-1 text-[12px] text-ink-soft">wide
          <input type="number" min={0.4} max={3} step={0.05} value={Number(o.width.toFixed(2))} onChange={(e) => { const n = Number(e.target.value); if (n >= 0.4 && n <= 3) setOpening(o.id, { width: n }); }} className="figures h-8 w-full select-text rounded-md border border-line bg-white px-1.5 text-[13px] text-ink" />
        </label>
      </div>
    </li>
  );
}

function DesignSection() {
  const room = useStudio((s) => s.room);
  const setRoom = useStudio((s) => s.setRoom);
  const addOpening = useStudio((s) => s.addOpening);
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
      {room.origin === "designed" && <p className="mt-0.5 text-[12.5px] text-ink-soft">A sample bedroom designed for this app. It is not a scan of a real room.</p>}
      <h3 className="label mt-3">Walls</h3>
      <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Wall colour">
        {WALL_COLORS.map((c) => (
          <button key={c.hex} role="radio" aria-checked={room.wallColor === c.hex} aria-label={c.name} title={c.name} onClick={() => setRoom({ wallColor: c.hex })}
            className={`h-8 w-8 rounded-full border ${room.wallColor === c.hex ? "border-accent ring-2 ring-accent ring-offset-2" : "border-line"}`} style={{ background: c.hex }} />
        ))}
        <label className="relative grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-dashed border-ink-soft text-[15px]" title="Any colour">
          +<input type="color" aria-label="Custom wall colour" value={room.wallColor} onChange={(e) => setRoom({ wallColor: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>
      <h3 className="label mt-4">Floor</h3>
      <div className="mt-1.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Flooring">
        {FLOORS.map((f) => (
          <button key={f.id} role="radio" aria-checked={room.floor === f.id} onClick={() => setRoom({ floor: f.id })}
            className={`overflow-hidden rounded-lg border text-left ${room.floor === f.id ? "border-accent ring-2 ring-accent ring-offset-1" : "border-line"}`}>
            <span className="block h-11 bg-cover bg-center" style={{ backgroundImage: `url(${asset(`/textures/${f.id}/diff.webp`)})` }} />
            <span className="block px-1.5 py-1 text-[12px] font-medium leading-tight">{f.name}</span>
          </button>
        ))}
      </div>
      <h3 className="label mt-4">Size, in metres{room.origin === "scan" && <span className="ml-1.5"><ConfidenceMark kind="estimated" /></span>}</h3>
      <div className="mt-1.5 grid grid-cols-3 gap-2">{num("width", "Width", 1.8, 12)}{num("depth", "Depth", 1.8, 12)}{num("height", "Height", 2.0, 4)}</div>
      <h3 className="label mt-4">Windows and doors</h3>
      <ul>{room.openings.map((o) => <OpeningRow key={o.id} o={o} />)}</ul>
      <div className="mt-2 flex gap-2"><button className="btn !min-h-9 flex-1 !text-[13px]" onClick={() => addOpening("window")}>Add window</button><button className="btn !min-h-9 flex-1 !text-[13px]" onClick={() => addOpening("door")}>Add door</button></div>
      <p className="figures mt-3 border-t border-line pt-2 text-[12.5px] text-ink-soft">{(room.width * room.depth).toFixed(1)} m² of floor, {count} {count === 1 ? "piece" : "pieces"}.</p>
    </section>
  );
}

export function RoomPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fromScan = useStudio((s) => s.scanResult !== null);
  return (
    <AnimatePresence>
      {open && (
        <motion.aside id="room-panel" aria-label="Room"
          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18, ease: "easeOut" }}
          className="panel absolute left-3 top-[124px] z-20 max-h-[calc(100dvh-224px)] w-[min(330px,calc(100vw-24px))] overflow-y-auto p-4 sm:left-4 sm:top-[76px] sm:max-h-[calc(100dvh-176px)]">
          <button onClick={onClose} aria-label="Close room panel" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-md text-[20px] leading-none hover:bg-wash lg:hidden">×</button>
          {fromScan && <><ScanSection /><hr className="my-4 border-line" /></>}
          <DesignSection />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
