"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CATALOG, CATEGORIES, thumbUrl, type Category } from "@/lib/catalog";
import { useStudio } from "@/lib/store";

const ico = { width: 20, height: 20, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const, "aria-hidden": true };

function Catalog({ onClose }: { onClose: () => void }) {
  const add = useStudio((s) => s.add);
  const [cat, setCat] = useState<Category>("Beds");
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.16 }}
      className="panel pointer-events-auto w-[min(720px,100%)] p-3" role="dialog" aria-label="Add furniture">
      <div className="flex items-start gap-1 pb-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" role="tablist">
          {CATEGORIES.map((c) => (
            <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)}
              className={`h-8 shrink-0 rounded-full px-3 text-[13.5px] font-medium ${cat === c ? "bg-ink text-white" : "hover:bg-wash"}`}>{c}</button>
          ))}
        </div>
        <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[20px] leading-none hover:bg-wash">×</button>
      </div>
      <ul className="grid max-h-[44dvh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
        {CATALOG.filter((i) => i.category === cat).map((i) => (
          <li key={i.id}>
            <button onClick={() => add(i.id)} className="group w-full rounded-lg border border-line p-1.5 text-left hover:border-accent hover:bg-accent-wash">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbUrl(i.id)} alt="" width={160} height={160} className="aspect-square w-full rounded-md bg-wash object-cover" />
              <span className="mt-1.5 block text-[12.5px] font-medium leading-tight">{i.name}</span>
              <span className="figures block text-[11.5px] text-ink-soft">{(i.size[0] * 100).toFixed(0)} × {(i.size[2] * 100).toFixed(0)} × {(i.size[1] * 100).toFixed(0)} cm</span>
            </button>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

export function ToolBar() {
  const tool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const view = useStudio((s) => s.view);
  const comparing = useStudio((s) => s.comparing);
  const [catalog, setCatalog] = useState(false);
  const canEdit = view !== "walk" && !comparing;
  const item = "flex h-12 min-w-[76px] flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[12px] font-medium disabled:opacity-35";
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[25] flex flex-col items-center gap-2 p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:p-4">
      <AnimatePresence>{catalog && canEdit && <Catalog onClose={() => setCatalog(false)} />}</AnimatePresence>
      <nav className="panel pointer-events-auto flex p-1" aria-label="Tools">
        <button className={`${item} ${tool === "select" ? "bg-accent-wash text-accent" : "hover:bg-wash"}`} aria-pressed={tool === "select"} onClick={() => setTool("select")} title="Pick up and move furniture (V)">
          <svg {...ico}><path d="M4 3l11 6-5 1.5L8 16z" /></svg>Move
        </button>
        <button className={`${item} ${tool === "measure" ? "bg-accent-wash text-accent" : "hover:bg-wash"}`} aria-pressed={tool === "measure"} onClick={() => { setTool("measure"); setCatalog(false); }} title="Measure between two points (M)">
          <svg {...ico}><path d="M2 13L13 2l5 5L7 18z" /><path d="M6 12l1.5 1.5M9 9l1.5 1.5M12 6l1.5 1.5" /></svg>Measure
        </button>
        <button className={`${item} ${catalog && canEdit ? "bg-accent-wash text-accent" : "hover:bg-wash"}`} aria-expanded={catalog} disabled={!canEdit}
          title={canEdit ? "Add furniture and decor" : "Switch to Orbit or Plan, and leave compare, to add furniture"}
          onClick={() => { setCatalog((c) => !c); setTool("select"); }}>
          <svg {...ico}><path d="M10 4v12M4 10h12" /></svg>Add furniture
        </button>
      </nav>
    </div>
  );
}
