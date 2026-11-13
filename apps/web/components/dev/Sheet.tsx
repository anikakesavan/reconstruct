"use client";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { asset, CATALOG, ITEM } from "@/lib/catalog";
import { Model } from "@/components/scene/Furniture";

/** Developer view: one catalogue piece on a plain background, used to render thumbnails (?thumb=<id>). */
export default function Sheet({ id }: { id: string }) {
  const def = ITEM[id] ?? CATALOG[0];
  const r = Math.max(def.size[0], def.size[1], def.size[2]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#f3f5f2" }}>
      <Canvas camera={{ position: [r * 1.05, def.size[1] * 0.5 + r * 0.75, r * 1.9], fov: 30 }} onCreated={({ camera }) => camera.lookAt(0, def.size[1] * 0.45, 0)} gl={{ preserveDrawingBuffer: true }}>
        <Environment files={asset("/env/studio.hdr")} environmentIntensity={0.9} />
        <hemisphereLight args={["#ffffff", "#e4dfd4", 0.7]} />
        <directionalLight position={[2, 5, 4]} intensity={1.6} />
        <Suspense fallback={null}><Model item={def.id} colors={def.parts.map(() => null)} /></Suspense>
      </Canvas>
    </div>
  );
}
