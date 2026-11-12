"use client";
import { useStudio } from "@/lib/store";
import type { ViewMode } from "@/lib/types";

const VIEWS: { id: ViewMode; label: string; hint: string }[] = [
  { id: "orbit", label: "Orbit", hint: "Look at the room from outside (1)" },
  { id: "walk", label: "Walk", hint: "Stand inside the room (2)" },
  { id: "plan", label: "Plan", hint: "Look straight down (3)" },
];

export function TopBar({ sheetOpen, onToggleSheet, onScan }: { sheetOpen: boolean; onToggleSheet: () => void; onScan: () => void }) {
  const title = useStudio((s) => s.scan.title);
  const view = useStudio((s) => s.view);
  const setView = useStudio((s) => s.setView);
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3 sm:p-4">
      <div className="pointer-events-auto flex items-stretch">
        <div className="board flex items-baseline gap-3 px-3 py-2">
          <h1 className="display text-[19px] font-extrabold leading-none sm:text-[22px]">Reconstruct</h1>
          <span className="hidden max-w-[220px] truncate text-[14px] text-ink-soft md:inline">{title}</span>
        </div>
        <button
          onClick={onToggleSheet} aria-label={sheetOpen ? "Hide details" : "Room details"} aria-expanded={sheetOpen} aria-controls="room-sheet"
          className="board -ml-px px-3 text-[14px] font-medium hover:bg-tape"
        >
          {sheetOpen ? "Hide" : "Room"}<span className="hidden sm:inline"> details</span>
        </button>
        <button onClick={onScan} className="board board-tape -ml-px px-3 text-[14px] font-semibold">
          <span className="sm:hidden">Scan</span><span className="hidden sm:inline">Scan your room</span>
        </button>
      </div>
      <div className="board pointer-events-auto flex p-0.5" role="radiogroup" aria-label="View">
        {VIEWS.map((v) => (
          <button
            key={v.id} role="radio" aria-checked={view === v.id} title={v.hint} onClick={() => setView(v.id)}
            className={`min-h-9 rounded-[2px] px-3 text-[14px] font-medium ${view === v.id ? "bg-ink text-board" : "hover:bg-board-edge"}`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </header>
  );
}
