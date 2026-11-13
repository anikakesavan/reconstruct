import type { Job, ScanRef } from "./types";

/** Where the Python reconstruction service runs. Override with NEXT_PUBLIC_RECONSTRUCT_API. */
export const API = (process.env.NEXT_PUBLIC_RECONSTRUCT_API ?? "http://localhost:8000").replace(/\/$/, "");

export const scanFromJob = (job: Pick<Job, "id" | "title">): ScanRef => ({
  id: job.id, title: job.title,
  glbUrl: `${API}/reconstructions/${job.id}/scan.glb`, metaUrl: `${API}/reconstructions/${job.id}/room.json`,
});

export interface Health { ok: boolean; device: string; max_views: number }

async function json<T>(res: Response): Promise<T> {
  if (res.ok) return res.json();
  const body = await res.json().catch(() => null);
  throw new Error(typeof body?.detail === "string" ? body.detail : `The service answered with an error (${res.status}).`);
}

export const getHealth = () => fetch(`${API}/health`).then((r) => json<Health>(r));
export const getJob = (id: string) => fetch(`${API}/reconstructions/${id}`).then((r) => json<Job>(r));
export const listJobs = () => fetch(`${API}/reconstructions`).then((r) => json<Job[]>(r));
export const deleteJob = (id: string) =>
  fetch(`${API}/reconstructions/${id}`, { method: "DELETE" }).then((r) => { if (!r.ok) return json<void>(r); });

/** Upload with byte progress (fetch cannot report upload progress, XMLHttpRequest can). */
export function createJob(files: File[], title: string, onProgress: (fraction: number) => void): Promise<Job> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("title", title);
    files.forEach((f) => form.append("files", f, f.name));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/reconstructions`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new Error("Could not reach the reconstruction service."));
    xhr.onload = () => {
      let body: { detail?: unknown } | null = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && body) resolve(body as Job);
      else reject(new Error(typeof body?.detail === "string" ? body.detail : `Upload failed (${xhr.status}).`));
    };
    xhr.send(form);
  });
}
