"use client";
import { useStudio } from "@/lib/store";
import type { ViewMode } from "@/lib/types";

const VIEWS: { id: ViewMode; label: string; hint: string }[] = [
  { id: "orbit", label: "Orbit", hint: "Look at the room from outside (1)" },
  { id: "walk", label: "Walk", hint: "Stand inside the room (2)" },
  { id: "plan", label: "Plan", hint: "Look straight down (3)" },
];

export function TopBar({ sheetOpen, onToggleSheet }: { sheetOpen: boolean; onToggleSheet: () => void }) {
  const view = useStudio((s) => s.view);
  const setView = useStudio((s) => s.setView);
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
      <div className="pointer-events-auto flex items-stretch">
        <div className="board flex items-baseline gap-3 px-3 py-2">
          <h1 className="display text-[22px] font-extrabold leading-none">Reconstruct</h1>
          <span className="hidden text-[14px] text-ink-soft sm:inline">Bedroom, Redwood scan</span>
        </div>
        <button
          onClick={onToggleSheet} aria-label={sheetOpen ? "Hide details" : "Room details"} aria-expanded={sheetOpen} aria-controls="room-sheet"
          className="board -ml-px px-3 text-[14px] font-medium hover:bg-tape"
        >
          {sheetOpen ? "Hide" : "Room"}<span className="hidden sm:inline"> details</span>
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
