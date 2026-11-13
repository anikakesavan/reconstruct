"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { asset, CATALOG, CATEGORIES, sizes, type Category } from "@/lib/catalog";
import { useStudio } from "@/lib/store";

const ico = { width: 20, height: 20, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const, "aria-hidden": true };

function BuiltIcon({ category }: { category: Category }) {
  const s = { ...ico, width: 56, height: 56, strokeWidth: 1.1 };
  if (category === "Beds") return <svg {...s}><path d="M2.5 15V6.5M2.5 12h15v3M17.5 12V9.5a1.5 1.5 0 0 0-1.5-1.5H8v4M4 10.2h2.5" /></svg>;
  if (category === "Rugs") return <svg {...s}><rect x="2.5" y="6" width="15" height="8" rx="1" /><path d="M5 6v8M15 6v8" /></svg>;
  if (category === "Seating") return <svg {...s}><path d="M6 3v8h8M6 11v6M14 11v6M5.5 5.5h1" /></svg>;
  if (category === "Decor") return <svg {...s}><rect x="5" y="3" width="10" height="14" rx="0.5" /><rect x="7.5" y="9" width="5" height="5" /><circle cx="11" cy="6.5" r="1.3" /></svg>;
  return <svg {...s}><path d="M2.5 7h15M4 7v8M16 7v8M4 9.5h12" /></svg>;
}

function Catalog({ onClose }: { onClose: () => void }) {
  const add = useStudio((s) => s.add);
  const [cat, setCat] = useState<Category>("Beds");
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.16 }}
      className="panel pointer-events-auto w-[min(640px,100%)] p-3" role="dialog" aria-label="Add furniture">
      <div className="flex items-start gap-1 pb-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" role="tablist">
        {CATEGORIES.map((c) => (
          <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)}
            className={`h-8 shrink-0 rounded-full px-3 text-[13.5px] font-medium ${cat === c ? "bg-ink text-white" : "hover:bg-wash"}`}>{c}</button>
        ))}
        </div>
        <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[20px] leading-none hover:bg-wash">×</button>
      </div>
      <ul className="grid max-h-[42dvh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
        {CATALOG.filter((i) => i.category === cat).map((i) => {
          const s = i.size ?? sizes.get(i.id);
          return (
            <li key={i.id}>
              <button onClick={() => add(i.id)} className="group w-full rounded-lg border border-line p-2 text-left hover:border-accent hover:bg-accent-wash">
                <span className="grid aspect-square place-items-center overflow-hidden rounded-md bg-wash text-ink-soft group-hover:bg-white">
                  {i.kind === "model"
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={asset(`/thumbs/${i.id}.webp`)} alt="" className="h-full w-full object-contain p-1" />
                    : <BuiltIcon category={i.category} />}
                </span>
                <span className="mt-1.5 block text-[13px] font-medium leading-tight">{i.name}</span>
                {s && <span className="figures block text-[11.5px] text-ink-soft">{(s[0] * 100).toFixed(0)} × {(s[2] * 100).toFixed(0)} cm</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}

export function ToolBar() {
  const tool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const view = useStudio((s) => s.view);
  const showRoom = useStudio((s) => s.showRoom);
  const [catalog, setCatalog] = useState(false);
  const canEdit = showRoom && view !== "walk";
  const item = "flex h-12 min-w-[76px] flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[12px] font-medium disabled:opacity-35";
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:p-4">
      <AnimatePresence>{catalog && canEdit && <Catalog onClose={() => setCatalog(false)} />}</AnimatePresence>
      <nav className="panel pointer-events-auto flex p-1" aria-label="Tools">
        <button className={`${item} ${tool === "select" ? "bg-accent-wash text-accent" : "hover:bg-wash"}`} aria-pressed={tool === "select"} onClick={() => setTool("select")} title="Pick up and move furniture (V)">
          <svg {...ico}><path d="M4 3l11 6-5 1.5L8 16z" /></svg>Move
        </button>
        <button className={`${item} ${tool === "measure" ? "bg-accent-wash text-accent" : "hover:bg-wash"}`} aria-pressed={tool === "measure"} onClick={() => { setTool("measure"); setCatalog(false); }} title="Measure between two points (M)">
          <svg {...ico}><path d="M2 13L13 2l5 5L7 18z" /><path d="M6 12l1.5 1.5M9 9l1.5 1.5M12 6l1.5 1.5" /></svg>Measure
        </button>
        <button className={`${item} ${catalog && canEdit ? "bg-accent-wash text-accent" : "hover:bg-wash"}`} aria-expanded={catalog} disabled={!canEdit}
          title={canEdit ? "Add furniture and decor" : showRoom ? "Switch to Orbit or Plan to add furniture" : "Make a clean room from the scan first"}
          onClick={() => { setCatalog((c) => !c); setTool("select"); }}>
          <svg {...ico}><path d="M10 4v12M4 10h12" /></svg>Add furniture
        </button>
      </nav>
    </div>
  );
}
