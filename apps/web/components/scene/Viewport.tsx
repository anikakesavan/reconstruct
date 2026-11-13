"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { asset } from "@/lib/catalog";
import { useStudio } from "@/lib/store";
import type { Room as RoomData } from "@/lib/types";
import { Room } from "./Room";
import { Furniture } from "./Furniture";
import { ScanLayer } from "./ScanLayer";
import { Annotations } from "./Annotations";
import { CameraRig } from "./CameraRig";

export const BACKDROP = "#e2e5e1";
/** The editor's camera, shared so the "before" view can follow it exactly. */
const main: { camera: THREE.PerspectiveCamera | null; onFrame: (() => void) | null } = { camera: null, onFrame: null };

/**
 * Lighting model: an HDR studio environment gives soft, even ambient light and reflections;
 * one directional "sun" on the window side gives direction and soft shadows.
 * Output is sRGB with ACES filmic tone mapping (the React Three Fiber defaults), exposure 1.
 */
function Lights({ room }: { room: RoomData }) {
  const reach = Math.max(room.width, room.depth) * 0.9 + 1;
  return (
    <>
      <Environment files={asset("/env/studio.hdr")} environmentIntensity={0.5} />
      <hemisphereLight args={["#ffffff", "#e4dfd4", 0.4]} />
      <directionalLight
        position={[2.2, 6.5, -5.5]} intensity={1.6} color="#fff3e0" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} shadow-normalBias={0.03} shadow-radius={5}
        shadow-camera-left={-reach} shadow-camera-right={reach} shadow-camera-top={reach} shadow-camera-bottom={-reach}
        shadow-camera-near={0.5} shadow-camera-far={22}
      />
    </>
  );
}

function ShareCamera() {
  const camera = useThree((s) => s.camera);
  useEffect(() => { main.camera = camera as THREE.PerspectiveCamera; }, [camera]);
  useFrame(() => { main.onFrame?.(); }); // whenever the editor redraws, the "before" view redraws too
  return null;
}
function FollowCamera() {
  const { camera, invalidate } = useThree();
  useEffect(() => { main.onFrame = () => invalidate(); invalidate(); return () => { main.onFrame = null; }; }, [invalidate]);
  useFrame(() => {
    const src = main.camera; if (!src) return;
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.copy(src.position); cam.quaternion.copy(src.quaternion);
    if (cam.fov !== src.fov) { cam.fov = src.fov; cam.updateProjectionMatrix(); }
  });
  return null;
}

/** Before and after: the design as first opened, drawn in a second canvas clipped by a draggable divider. */
function Before() {
  const baseline = useStudio((s) => s.baseline);
  const [split, setSplit] = useState(0.5);
  const drag = useRef(false);
  const pct = `${split * 100}%`;
  return (
    <div className="absolute inset-0 z-[5]" style={{ pointerEvents: "none" }}>
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split * 100}% 0 0)` }}>
        <Canvas frameloop="demand" shadows={{ type: THREE.VSMShadowMap }} camera={{ fov: 34, near: 0.05, far: 90 }} dpr={[1, 2]} style={{ pointerEvents: "none" }}>
          <color attach="background" args={[BACKDROP]} />
          <Lights room={baseline.room} />
          <Suspense fallback={null}><Room room={baseline.room} /><Furniture objects={baseline.objects} /></Suspense>
          <FollowCamera />
        </Canvas>
      </div>
      <span className="panel absolute top-[124px] px-2.5 py-1 text-[12.5px] font-semibold sm:top-20" style={{ left: `calc(${pct} - 78px)` }}>Before</span>
      <span className="panel absolute top-[124px] px-2.5 py-1 text-[12.5px] font-semibold sm:top-20" style={{ left: `calc(${pct} + 18px)` }}>After</span>
      <div
        role="slider" aria-label="Before and after divider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(split * 100)} tabIndex={0}
        className="absolute inset-y-0 w-9 -translate-x-1/2 cursor-ew-resize touch-none" style={{ left: pct, pointerEvents: "auto" }}
        onPointerDown={(e) => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (drag.current) setSplit(Math.min(0.95, Math.max(0.05, e.clientX / window.innerWidth))); }}
        onPointerUp={() => { drag.current = false; }} onPointerCancel={() => { drag.current = false; }}
        onKeyDown={(e) => { if (e.key === "ArrowLeft") setSplit((s) => Math.max(0.05, s - 0.04)); if (e.key === "ArrowRight") setSplit((s) => Math.min(0.95, s + 0.04)); }}
      >
        <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgb(23_33_30/0.25)]" />
        <div className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-white text-[13px] shadow">⇆</div>
      </div>
    </div>
  );
}

export default function Viewport() {
  const scan = useStudio((s) => s.scan);
  const showScan = useStudio((s) => s.showScan);
  const room = useStudio((s) => s.room);
  const walking = useStudio((s) => s.view === "walk");
  const comparing = useStudio((s) => s.comparing);
  const scanScale = useStudio((s) => s.scanScale);
  return (
    <>
      <Canvas
        // draw only when something changes; walking needs a continuous loop
        frameloop={walking ? "always" : "demand"}
        shadows={{ type: THREE.VSMShadowMap }}
        camera={{ position: [6.9, 6.2, 8.0], fov: 34, near: 0.05, far: 90 }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onPointerMissed={() => useStudio.getState().select(null)}
        style={{ touchAction: "none" }}
      >
        <color attach="background" args={[BACKDROP]} />
        <Lights room={room} />
        <Suspense fallback={null}><Room /></Suspense>
        <Furniture />
        <Suspense fallback={null}>{scan && showScan && <ScanLayer key={scan.id} url={scan.glbUrl} scale={scanScale} />}</Suspense>
        <Annotations />
        <CameraRig />
        <ShareCamera />
      </Canvas>
      {comparing && <Before />}
    </>
  );
}
