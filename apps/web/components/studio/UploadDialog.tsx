"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { API, DEMO_SCAN, createJob, deleteJob, getHealth, getJob, listJobs, scanFromJob, type Health } from "@/lib/api";
import { useStudio } from "@/lib/store";
import type { Job } from "@/lib/types";

const ACCEPT = "image/*,video/*,.heic,.heif,.mov,.mp4,.m4v,.webm";
const STAGES: [string, string][] = [
  ["frames", "Reading your files"],
  ["geometry", "Working out depth and camera positions"],
  ["scale", "Estimating real-world scale"],
  ["fusion", "Fusing the views into one surface"],
  ["room", "Finding the floor and walls"],
];
const btn = "min-h-11 rounded-[2px] border border-ink px-4 text-[15px] font-semibold";
const mb = (n: number) => (n / 1048576).toFixed(n < 10485760 ? 1 : 0);

type Phase =
  | { at: "pick" }
  | { at: "sending"; sent: number }
  | { at: "working"; job: Job }
  | { at: "failed"; reason: string };

export function UploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const openScan = useStudio((s) => s.openScan);
  const currentId = useStudio((s) => s.scan.id);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("My room");
  const [phase, setPhase] = useState<Phase>({ at: "pick" });
  const [health, setHealth] = useState<Health | "offline" | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = phase.at === "sending" || phase.at === "working";

  const refresh = useCallback(() => {
    getHealth().then(setHealth).catch(() => setHealth("offline"));
    listJobs().then(setJobs).catch(() => setJobs([]));
  }, []);
  useEffect(() => { if (open) refresh(); }, [open, refresh]);

  // Poll the running job. Keeps going while the dialog is closed so the scan still opens when ready.
  const jobId = phase.at === "working" ? phase.job.id : null;
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const tick = async () => {
      try {
        const job = await getJob(jobId);
        if (stop) return;
        if (job.status === "done") { openScan(scanFromJob(job)); setPhase({ at: "pick" }); setFiles([]); onClose(); return; }
        if (job.status === "failed") { setPhase({ at: "failed", reason: job.error ?? "The reconstruction failed." }); return; }
        setPhase({ at: "working", job });
      } catch {
        if (!stop) setPhase({ at: "failed", reason: "Lost contact with the reconstruction service. Check that it is still running." });
        return;
      }
      if (!stop) timer = window.setTimeout(tick, 1200);
    };
    let timer = window.setTimeout(tick, 600);
    return () => { stop = true; window.clearTimeout(timer); };
  }, [jobId, openScan, onClose]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
  }, [open, onClose]);

  const add = (list: FileList | null) => {
    if (!list) return;
    const ok = Array.from(list).filter((f) => /^(image|video)\//.test(f.type) || /\.(heic|heif|mov|mp4|m4v|webm|jpe?g|png|webp)$/i.test(f.name));
    setFiles((cur) => [...cur, ...ok.filter((f) => !cur.some((c) => c.name === f.name && c.size === f.size))]);
  };

  const start = async () => {
    setPhase({ at: "sending", sent: 0 });
    try {
      const job = await createJob(files, title.trim() || "My room", (sent) => setPhase({ at: "sending", sent }));
      setPhase({ at: "working", job });
    } catch (e) {
      setPhase({ at: "failed", reason: e instanceof Error ? e.message : "Upload failed." });
    }
  };

  const photos = files.filter((f) => !f.type.startsWith("video/") && !/\.(mov|mp4|m4v|webm)$/i.test(f.name)).length;
  const videos = files.length - photos;
  const enough = videos > 0 || photos >= 2;
  const total = files.reduce((n, f) => n + f.size, 0);
  const maxViews = health && health !== "offline" ? health.max_views : 16;
  const stageIndex = phase.at === "working" ? STAGES.findIndex(([id]) => id === phase.job.stage) : -1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-mat-deep/70 p-3"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.section
            role="dialog" aria-modal="true" aria-labelledby="upload-title"
            initial={{ y: 14 }} animate={{ y: 0 }} exit={{ y: 14 }} transition={{ duration: 0.18, ease: "easeOut" }}
            className="board w-[min(560px,100%)] select-text p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="upload-title" className="display text-[30px] font-extrabold leading-none">Scan your room</h2>
              <button onClick={onClose} aria-label="Close" className="-mr-2 -mt-2 grid h-10 w-10 place-items-center text-[22px] leading-none hover:bg-tape">×</button>
            </div>

            {health === "offline" && (
              <div className="mt-4 border border-ink bg-tape p-3 text-[14px] leading-[1.45]" role="alert">
                <p className="font-semibold">The reconstruction service is not running.</p>
                <p className="mt-1">It turns photos into 3D on your own computer. Start it in a terminal, then try again:</p>
                <pre className="mt-2 overflow-x-auto bg-ink p-2 text-[12px] text-board">cd services/reconstruction{"\n"}uvicorn app.main:app --port 8000</pre>
                <p className="mt-1 text-[12px]">Looking for it at {API}. First-time setup is in the README.</p>
                <button className={`${btn} mt-2 bg-board`} onClick={refresh}>Check again</button>
              </div>
            )}

            {phase.at === "pick" && (
              <>
                <p className="mt-3 text-[15px] leading-[1.45]">
                  Add 8 to {maxViews} photos, or one slow video sweep of 10 to 30 seconds. Stand in each corner and
                  shoot toward the opposite one, lights on, floor in the frame.
                </p>
                <button
                  type="button" onClick={() => input.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
                  onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
                  className={`mt-4 block w-full rounded-[2px] border-2 border-dashed border-ink px-4 py-7 text-center ${over ? "bg-tape" : "bg-white hover:bg-tape"}`}
                >
                  <span className="block text-[17px] font-semibold">{files.length ? "Add more" : "Choose photos or a video"}</span>
                  <span className="mt-1 block text-[13px] text-ink-soft">or drop them here. JPEG, PNG, HEIC, MP4, MOV.</span>
                </button>
                <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" tabIndex={-1}
                  onChange={(e) => { add(e.target.files); e.target.value = ""; }} />

                {files.length > 0 && (
                  <div className="mt-3">
                    <p className="figures text-[14px] font-semibold">
                      {[photos && `${photos} photo${photos === 1 ? "" : "s"}`, videos && `${videos} video${videos === 1 ? "" : "s"}`].filter(Boolean).join(" and ")}, {mb(total)} MB
                      <button className="ml-3 text-[13px] font-medium underline" onClick={() => setFiles([])}>Remove all</button>
                    </p>
                    {!enough && <p className="mt-1 text-[13px]">One photo is not enough to see depth. Add at least one more.</p>}
                    {photos > maxViews && <p className="mt-1 text-[13px] text-ink-soft">Only {maxViews} of these photos will be used, spread evenly, to keep processing time reasonable.</p>}
                    <label className="mt-3 block text-[13px] font-medium">
                      Name
                      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60}
                        className="mt-1 block h-10 w-full rounded-[2px] border border-ink bg-white px-2 text-[15px]" />
                    </label>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button className={`${btn} bg-tape disabled:opacity-40`} disabled={!enough || health === "offline"} onClick={start}>Build 3D room</button>
                  <p className="min-w-[200px] flex-1 text-[12px] leading-[1.4] text-ink-soft">
                    Files go only to the service on this computer{health && health !== "offline" ? ` (${health.device === "cuda" ? "using its graphics card" : "no graphics card, so allow a minute or two"})` : ""}.
                    Originals are deleted once the room is built.
                  </p>
                </div>
              </>
            )}

            {phase.at === "sending" && (
              <div className="mt-5" role="status">
                <p className="text-[16px] font-semibold">Sending files</p>
                <div className="mt-2 h-2 border border-ink bg-white"><div className="h-full bg-tape" style={{ width: `${phase.sent * 100}%` }} /></div>
                <p className="figures mt-1 text-[13px] text-ink-soft">{Math.round(phase.sent * 100)}% of {mb(total)} MB</p>
              </div>
            )}

            {phase.at === "working" && (
              <div className="mt-5" role="status" aria-live="polite">
                <ol>
                  {STAGES.map(([id, label], i) => {
                    const state = phase.job.status === "queued" ? "todo" : i < stageIndex ? "done" : i === stageIndex ? "now" : "todo";
                    return (
                      <li key={id} className={`flex items-center gap-3 border-b border-board-edge py-2 text-[15px] ${state === "todo" ? "text-ink-soft" : "font-medium"}`}>
                        <span aria-hidden className={`grid h-5 w-5 shrink-0 place-items-center border border-ink text-[12px] ${state === "done" ? "bg-ink text-board" : state === "now" ? "animate-pulse bg-tape" : ""}`}>{state === "done" ? "✓" : ""}</span>
                        {state === "now" ? phase.job.message : label}
                      </li>
                    );
                  })}
                </ol>
                <p className="mt-3 text-[13px] leading-[1.45] text-ink-soft">
                  {phase.job.status === "queued" ? "Waiting for an earlier scan to finish. " : ""}
                  You can close this and keep working. The room opens when it is ready.
                </p>
              </div>
            )}

            {phase.at === "failed" && (
              <div className="mt-4" role="alert">
                <p className="text-[16px] font-semibold">The room was not built</p>
                <p className="mt-1 text-[14px] leading-[1.45]">{phase.reason}</p>
                <button className={`${btn} mt-3 bg-tape`} onClick={() => { setPhase({ at: "pick" }); refresh(); }}>Back to your files</button>
              </div>
            )}

            {!busy && (
              <div className="mt-5 border-t border-ink pt-3">
                <h3 className="text-[13px] font-semibold">Rooms on this computer</h3>
                <ul className="mt-1">
                  {[{ ...DEMO_SCAN, status: "done" as const, demo: true }, ...jobs.map((j) => ({ ...scanFromJob(j), status: j.status, demo: false }))].map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 border-b border-board-edge py-1.5 text-[14px]">
                      <span className="min-w-0 truncate">{s.title}{s.demo && <span className="text-ink-soft"> (sample scan)</span>}{s.status === "failed" && <span className="text-ink-soft"> (failed)</span>}</span>
                      <span className="flex shrink-0 gap-3 text-[13px] font-medium">
                        {s.id === currentId ? <span className="text-ink-soft">Open now</span>
                          : s.status === "done" && <button className="underline" onClick={() => { openScan(s); onClose(); }}>Open</button>}
                        {!s.demo && s.id !== currentId && (s.status === "done" || s.status === "failed") && (
                          <button className="underline" onClick={() => deleteJob(s.id).then(refresh, refresh)}>Delete</button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
