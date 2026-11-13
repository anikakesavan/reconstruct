"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Studio } from "@/components/studio/Studio";

const Sheet = dynamic(() => import("@/components/dev/Sheet"), { ssr: false });

/** The editor, or (with ?thumb=<id>) a single catalogue piece for thumbnail rendering. */
export function App() {
  const [thumb, setThumb] = useState<string | null | undefined>(undefined);
  useEffect(() => { setThumb(new URLSearchParams(window.location.search).get("thumb")); }, []);
  if (thumb === undefined) return null;
  return thumb ? <Sheet id={thumb} /> : <Studio />;
}
