"use client";
import { AnimatePresence, motion } from "motion/react";
import { useStudio, VOLUME_PRESETS } from "@/lib/store";
import type { Tool } from "@/lib/types";

const icon = { width: 20, height: 20, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const, "aria-hidden": true };
const TOOLS: { id: Tool; label: string; key: string; hint: string; glyph: React.ReactNode }[] = [
  { id: "select", label: "Move", key: "V", hint: "Pick up and move volumes", glyph: <svg {...icon}><path d="M4 3l11 6-5 1.5L8 16z" /></svg> },
  { id: "inspect", label: "Inspect", key: "I", hint: "Read the height of any point", glyph: <svg {...icon}><circle cx="10" cy="10" r="2" /><path d="M10 2v4M10 14v4M2 10h4M14 10h4" /></svg> },
  { id: "measure", label: "Measure", key: "M", hint: "Measure between two points", glyph: <svg {...icon}><path d="M2 13L13 2l5 5L7 18z" /><path d="M6 12l1.5 1.5M9 9l1.5 1.5M12 6l1.5 1.5" /></svg> },
  { id: "volume", label: "Block out", key: "B", hint: "Add a furniture-sized box", glyph: <svg {...icon}><path d="M10 2l7 4v8l-7 4-7-4V6z" /><path d="M3 6l7 4 7-4M10 10v8" /></svg> },
];

export function ToolRail() {
  const tool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const addVolume = useStudio((s) => s.addVolume);
  const view = useStudio((s) => s.view);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:p-4">
      <AnimatePresence>
        {tool === "volume" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.15 }}
            className="board pointer-events-auto grid w-[min(420px,100%)] grid-cols-2 gap-px bg-ink p-0" role="menu" aria-label="Add a volume"
          >
            {VOLUME_PRESETS.map((p, i) => (
              <button key={p.label} role="menuitem" onClick={() => addVolume(i)} className="bg-board px-3 py-2 text-left hover:bg-tape">
                <span className="block text-[14px] font-semibold">{p.label}</span>
                <span className="figures block text-[12px] text-ink-soft">{p.size.map((n) => n.toFixed(1)).join(" × ")} m, typical size</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <nav className="board pointer-events-auto flex p-0.5" aria-label="Tools">
        {TOOLS.map((t) => {
          const off = view === "walk" && (t.id === "select" || t.id === "volume");
          return (
            <button
              key={t.id} onClick={() => setTool(t.id)} aria-pressed={tool === t.id} disabled={off}
              title={off ? "Switch to Orbit or Plan to move things" : `${t.hint} (${t.key})`}
              className={`flex min-h-12 min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-[2px] px-2 text-[12px] font-medium disabled:opacity-35 ${tool === t.id ? "bg-tape" : "hover:bg-board-edge"}`}
            >
              {t.glyph}
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
