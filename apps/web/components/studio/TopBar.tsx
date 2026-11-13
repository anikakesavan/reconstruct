"use client";
import { useEffect, useRef, useState } from "react";
import { deleteSave, listSaves, useStudio, type SavedDesign } from "@/lib/store";
import type { ViewMode } from "@/lib/types";

const VIEWS: { id: ViewMode; label: string; hint: string }[] = [
  { id: "orbit", label: "Orbit", hint: "Look at the room from outside (1)" },
  { id: "walk", label: "Walk", hint: "Stand inside the room (2)" },
  { id: "plan", label: "Plan", hint: "Look straight down (3)" },
];
const ico = { width: 18, height: 18, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

function SaveMenu({ onClose }: { onClose: () => void }) {
  const name = useStudio((s) => s.name);
  const saveAs = useStudio((s) => s.saveAs);
  const openSaved = useStudio((s) => s.openSaved);
  const openSample = useStudio((s) => s.openSample);
  const say = useStudio((s) => s.say);
  const [value, setValue] = useState(name);
  const [saves, setSaves] = useState<SavedDesign[]>([]);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { setSaves(listSaves()); }, []);
  useEffect(() => {
    const away = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) onClose(); };
    window.addEventListener("pointerdown", away, true);
    return () => window.removeEventListener("pointerdown", away, true);
  }, [onClose]);
  const exportFile = () => {
    const { room, objects } = useStudio.getState();
    const url = URL.createObjectURL(new Blob([JSON.stringify({ name: value, room, objects }, null, 1)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `${value.replace(/[^\w-]+/g, "-").toLowerCase() || "design"}.reconstruct.json`; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div ref={box} className="panel absolute left-0 top-[52px] z-30 w-[300px] p-3" role="dialog" aria-label="Save and open designs">
      <form onSubmit={(e) => { e.preventDefault(); const n = value.trim() || "Untitled"; saveAs(n); say(`Saved "${n}" in this browser.`); onClose(); }}>
        <label className="label">Design name<input className="field mt-1" value={value} maxLength={50} onChange={(e) => setValue(e.target.value)} autoFocus /></label>
        <div className="mt-2 flex gap-2"><button className="btn btn-primary flex-1">Save</button><button type="button" className="btn" onClick={exportFile}>Download file</button></div>
      </form>
      <p className="mt-2 text-[12px] leading-[1.4] text-ink-soft">Saved designs stay in this browser on this device. Download a file to keep a copy elsewhere.</p>
      <h3 className="label mt-3 border-t border-line pt-2">Open</h3>
      <ul className="mt-1 max-h-48 overflow-y-auto text-[14px]">
        <li className="flex items-center justify-between py-1"><span>Sample bedroom</span><button className="text-[13px] font-medium underline" onClick={() => { openSample(); onClose(); }}>Open</button></li>
        {saves.map((s) => (
          <li key={s.name} className="flex items-center justify-between gap-2 border-t border-line py-1">
            <span className="min-w-0 truncate">{s.name}</span>
            <span className="flex shrink-0 gap-3 text-[13px] font-medium">
              <button className="underline" onClick={() => { openSaved(s); onClose(); }}>Open</button>
              <button className="underline" onClick={() => { deleteSave(s.name); setSaves(listSaves()); }}>Delete</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TopBar({ panelOpen, onTogglePanel, onScan }: { panelOpen: boolean; onTogglePanel: () => void; onScan: () => void }) {
  const view = useStudio((s) => s.view);
  const setView = useStudio((s) => s.setView);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const name = useStudio((s) => s.name);
  const dirty = useStudio((s) => s.dirty);
  const comparing = useStudio((s) => s.comparing);
  const setComparing = useStudio((s) => s.setComparing);
  const [menu, setMenu] = useState(false);
  const iconBtn = "grid h-9 w-9 place-items-center rounded-md hover:bg-wash disabled:opacity-30";
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-wrap items-start gap-2 p-3 sm:justify-between sm:p-4">
      <div className="pointer-events-auto contents items-center gap-2 sm:flex sm:flex-wrap">
        <div className="pointer-events-auto relative">
          <div className="panel flex h-11 items-center gap-1 pl-3.5 pr-1">
            <h1 className="display text-[20px] font-extrabold leading-none">Reconstruct</h1>
            <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="dialog" title="Save, rename or open a design"
              className="ml-2 flex h-9 max-w-[210px] items-center gap-1.5 rounded-md border-l border-line pl-3 pr-2 text-[13.5px] hover:bg-wash">
              <span className="hidden truncate text-ink-soft md:inline">{name}</span>
              <span className="font-semibold">{dirty ? "Save" : "Saved"}</span>
              {dirty && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />}
            </button>
          </div>
          {menu && <SaveMenu onClose={() => setMenu(false)} />}
        </div>
        <button onClick={onTogglePanel} aria-expanded={panelOpen} aria-controls="room-panel" className="btn pointer-events-auto h-11 shadow-(--shadow-panel)">Room</button>
        <div className="panel pointer-events-auto order-last flex h-11 items-center p-1 sm:order-none">
          <button className={iconBtn} onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl or Cmd + Z)"><svg {...ico}><path d="M8 4 4 8l4 4" /><path d="M4 8h8a4 4 0 0 1 0 8h-2" /></svg></button>
          <button className={iconBtn} onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (Shift + Ctrl or Cmd + Z)"><svg {...ico}><path d="m12 4 4 4-4 4" /><path d="M16 8H8a4 4 0 0 0 0 8h2" /></svg></button>
          <button className={`${iconBtn} ${comparing ? "bg-accent-wash text-accent" : ""}`} onClick={() => setComparing(!comparing)} aria-pressed={comparing} aria-label="Before and after" title="Compare with how the room started">
            <svg {...ico}><rect x="3" y="4" width="14" height="12" rx="1.5" /><path d="M10 2.5v15" /><path d="M6 8.5 4.8 10 6 11.5M14 8.5l1.2 1.5-1.2 1.5" /></svg>
          </button>
        </div>
        <button onClick={onScan} className="btn btn-primary pointer-events-auto h-11 shadow-(--shadow-panel)"><span className="sm:hidden">Scan</span><span className="hidden sm:inline">Scan your room</span></button>
      </div>
      <div className="panel pointer-events-auto order-last flex h-11 items-center p-1 sm:order-none" role="radiogroup" aria-label="View">
        {VIEWS.map((v) => (
          <button key={v.id} role="radio" aria-checked={view === v.id} title={v.hint} onClick={() => setView(v.id)}
            className={`h-9 rounded-md px-3 text-[14px] font-medium ${view === v.id ? "bg-ink text-white" : "hover:bg-wash"}`}>{v.label}</button>
        ))}
      </div>
    </header>
  );
}
