"use client";
import { useStudio } from "@/lib/store";
import type { ViewMode } from "@/lib/types";

const VIEWS: { id: ViewMode; label: string; hint: string }[] = [
  { id: "orbit", label: "Orbit", hint: "Look at the room from outside (1)" },
  { id: "walk", label: "Walk", hint: "Stand inside the room (2)" },
  { id: "plan", label: "Plan", hint: "Look straight down (3)" },
];
const ico = { width: 18, height: 18, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export function TopBar({ panelOpen, onTogglePanel, onScan }: { panelOpen: boolean; onTogglePanel: () => void; onScan: () => void }) {
  const view = useStudio((s) => s.view);
  const setView = useStudio((s) => s.setView);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const scan = useStudio((s) => s.scan);
  const origin = useStudio((s) => s.room.origin);
  const label = scan ? scan.title : origin === "scan" ? "Room sized from a scan" : "Sample bedroom";
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3 sm:p-4">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2">
        <div className="panel flex h-11 items-center gap-3 px-3.5">
          <h1 className="display text-[20px] font-extrabold leading-none">Reconstruct</h1>
          <span className="hidden max-w-[200px] truncate border-l border-line pl-3 text-[13.5px] text-ink-soft md:inline">{label}</span>
        </div>
        <button onClick={onTogglePanel} aria-expanded={panelOpen} aria-controls="room-panel" className="btn h-11 shadow-(--shadow-panel)">Room</button>
        <div className="panel flex h-11 items-center p-1">
          <button className="grid h-9 w-9 place-items-center rounded-md hover:bg-wash disabled:opacity-30" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl or Cmd + Z)"><svg {...ico}><path d="M8 4 4 8l4 4" /><path d="M4 8h8a4 4 0 0 1 0 8h-2" /></svg></button>
          <button className="grid h-9 w-9 place-items-center rounded-md hover:bg-wash disabled:opacity-30" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (Shift + Ctrl or Cmd + Z)"><svg {...ico}><path d="m12 4 4 4-4 4" /><path d="M16 8H8a4 4 0 0 0 0 8h2" /></svg></button>
        </div>
        <button onClick={onScan} className="btn btn-primary h-11 shadow-(--shadow-panel)"><span className="sm:hidden">Scan</span><span className="hidden sm:inline">Scan your room</span></button>
      </div>
      <div className="panel pointer-events-auto flex h-11 items-center p-1" role="radiogroup" aria-label="View">
        {VIEWS.map((v) => (
          <button key={v.id} role="radio" aria-checked={view === v.id} title={v.hint} onClick={() => setView(v.id)}
            className={`h-9 rounded-md px-3 text-[14px] font-medium ${view === v.id ? "bg-ink text-white" : "hover:bg-wash"}`}>{v.label}</button>
        ))}
      </div>
    </header>
  );
}
