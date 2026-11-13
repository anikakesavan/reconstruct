"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";
import { ROT_STEP, useStudio } from "@/lib/store";
import type { ScanMeta } from "@/lib/types";
import { TopBar } from "./TopBar";
import { ToolBar } from "./ToolBar";
import { RoomPanel } from "./RoomPanel";
import { Inspector } from "./Inspector";
import { WalkPad } from "./WalkPad";
import { UploadDialog } from "./UploadDialog";

const Viewport = dynamic(() => import("@/components/scene/Viewport"), { ssr: false });

function useShortcuts() {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const s = useStudio.getState();
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "z") { e.preventDefault(); if (e.shiftKey) s.redo(); else s.undo(); return; }
      if ((e.metaKey || e.ctrlKey) && k === "d" && s.selectedId) { e.preventDefault(); s.duplicate(s.selectedId); return; }
      if (e.metaKey || e.ctrlKey) return;
      const sel = s.objects.find((o) => o.id === s.selectedId);
      if (k === "v") s.setTool("select");
      else if (k === "m") s.setTool("measure");
      else if (k === "1") s.setView("orbit");
      else if (k === "2") s.setView("walk");
      else if (k === "3") s.setView("plan");
      else if (k === "escape") { s.select(null); s.clearMeasure(); }
      else if (sel && k === "r") s.patch(sel.id, { rot: sel.rot + (e.shiftKey ? -ROT_STEP : ROT_STEP) });
      else if (sel && (k === "delete" || k === "backspace")) s.remove(sel.id);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
}

function Loading() {
  const { active, progress } = useProgress();
  const [seen, setSeen] = useState(false);
  useEffect(() => { if (!active && progress >= 100) setSeen(true); }, [active, progress]);
  if (seen && !active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status">
      <div className="panel px-5 py-4">
        <p className="text-[15px] font-medium">Setting up the room</p>
        <div className="mt-2 h-1.5 w-56 overflow-hidden rounded-full bg-wash"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.max(4, progress)}%` }} /></div>
      </div>
    </div>
  );
}

export function Studio() {
  useShortcuts();
  const view = useStudio((s) => s.view);
  const scan = useStudio((s) => s.scan);
  const setScanMeta = useStudio((s) => s.setScanMeta);
  const hydrate = useStudio((s) => s.hydrate);
  const [panelOpen, setPanelOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [metaFailed, setMetaFailed] = useState(false);

  useEffect(() => {
    hydrate();
    if (window.matchMedia("(min-width: 1024px)").matches) setPanelOpen(true);
  }, [hydrate]);

  useEffect(() => {
    if (!scan) return;
    let stale = false;
    setMetaFailed(false); setPanelOpen(true);
    fetch(scan.metaUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((m: ScanMeta) => { if (!stale) setScanMeta(m); })
      .catch(() => { if (!stale) setMetaFailed(true); });
    return () => { stale = true; };
  }, [scan, setScanMeta]);

  return (
    <main className="fixed inset-0 select-none overflow-hidden bg-studio">
      <div className="absolute inset-0"><Viewport /></div>
      <Loading />
      <TopBar panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((o) => !o)} onScan={() => setUploadOpen(true)} />
      <RoomPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
      <Inspector />
      {view === "walk" && <WalkPad />}
      <ToolBar />
      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
      {metaFailed && (
        <p className="panel absolute left-1/2 top-20 -translate-x-1/2 px-3 py-2 text-[14px]" role="alert">
          The scan&apos;s details did not load. Check that the reconstruction service is still running.
        </p>
      )}
    </main>
  );
}
