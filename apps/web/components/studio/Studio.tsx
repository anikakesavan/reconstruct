"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";
import { useStudio } from "@/lib/store";
import type { RoomMeta } from "@/lib/types";
import { TopBar } from "./TopBar";
import { ToolRail } from "./ToolRail";
import { RoomSheet } from "./RoomSheet";
import { Inspector } from "./Inspector";
import { WalkPad } from "./WalkPad";

const Viewport = dynamic(() => import("@/components/scene/Viewport"), { ssr: false });

function useShortcuts() {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
      const s = useStudio.getState();
      const sel = s.volumes.find((v) => v.id === s.selectedId);
      const k = e.key.toLowerCase();
      if (k === "v") s.setTool("select");
      else if (k === "i") s.setTool("inspect");
      else if (k === "m") s.setTool("measure");
      else if (k === "b") s.setTool("volume");
      else if (k === "1") s.setView("orbit");
      else if (k === "2") s.setView("walk");
      else if (k === "3") s.setView("plan");
      else if (k === "escape") { s.select(null); s.clearMeasure(); s.setProbe(null); }
      else if (sel && k === "r") s.updateVolume(sel.id, { quarterTurns: (sel.quarterTurns + 1) % 4 });
      else if (sel && (k === "delete" || k === "backspace")) s.removeVolume(sel.id);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
}

function Loading() {
  const { progress } = useProgress();
  const ready = useStudio((s) => s.scanReady);
  if (ready) return null;
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status">
      <div className="board px-4 py-3">
        <p className="text-[15px] font-medium">Loading the bedroom scan</p>
        <div className="mt-2 h-1.5 w-56 border border-ink bg-white">
          <div className="h-full bg-tape transition-[width]" style={{ width: `${Math.max(4, progress)}%` }} />
        </div>
        <p className="figures mt-1.5 text-[12px] text-ink-soft">{Math.round(progress)}% of about 10 MB</p>
      </div>
    </div>
  );
}

function StatusLine() {
  const fps = useStudio((s) => s.fps);
  const tris = useStudio((s) => s.triangles);
  return (
    <p className="figures pointer-events-none absolute bottom-4 left-4 hidden text-[12px] text-mat-line lg:block">
      Grid squares are 0.5 m. {fps > 0 && `${fps} fps, ${(tris / 1000).toFixed(0)}k triangles drawn.`}
    </p>
  );
}

export function Studio() {
  useShortcuts();
  const setRoom = useStudio((s) => s.setRoom);
  const view = useStudio((s) => s.view);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) setSheetOpen(true);
    fetch("/scans/redwood-bedroom/room.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((r: RoomMeta) => setRoom(r))
      .catch(() => setFailed(true));
  }, [setRoom]);

  return (
    <main className="fixed inset-0 select-none overflow-hidden bg-mat">
      <div className="absolute inset-0"><Viewport /></div>
      <Loading />
      <TopBar sheetOpen={sheetOpen} onToggleSheet={() => setSheetOpen((o) => !o)} />
      <RoomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <Inspector />
      {view === "walk" && <WalkPad />}
      <ToolRail />
      <StatusLine />
      {failed && (
        <p className="board absolute left-1/2 top-20 -translate-x-1/2 px-3 py-2 text-[14px]" role="alert">
          Room details did not load. Reload the page; the 3D scan may still appear without dimensions.
        </p>
      )}
    </main>
  );
}
