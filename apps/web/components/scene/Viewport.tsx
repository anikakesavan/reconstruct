"use client";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { asset } from "@/lib/catalog";
import { useStudio } from "@/lib/store";
import { Room } from "./Room";
import { Furniture } from "./Furniture";
import { ScanLayer } from "./ScanLayer";
import { Annotations } from "./Annotations";
import { CameraRig } from "./CameraRig";

export const BACKDROP = "#e2e5e1";

/**
 * Lighting model: an HDR studio environment gives soft, even ambient light and reflections;
 * one directional "sun" on the window side gives direction and soft shadows.
 * Output is sRGB with ACES filmic tone mapping (the React Three Fiber defaults), exposure 1.
 */
function Lights() {
  const room = useStudio((s) => s.room);
  const reach = Math.max(room.width, room.depth) * 0.9 + 1;
  return (
    <>
      <Environment files={asset("/env/studio.hdr")} environmentIntensity={0.75} />
      <hemisphereLight args={["#ffffff", "#e4dfd4", 0.7]} />
      <directionalLight
        position={[2.2, 6.5, -5.5]} intensity={1.7} color="#fff3e0" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} shadow-normalBias={0.03} shadow-radius={5}
        shadow-camera-left={-reach} shadow-camera-right={reach} shadow-camera-top={reach} shadow-camera-bottom={-reach}
        shadow-camera-near={0.5} shadow-camera-far={22}
      />
    </>
  );
}

export default function Viewport() {
  const scan = useStudio((s) => s.scan);
  const showScan = useStudio((s) => s.showScan);
  const showRoom = useStudio((s) => s.showRoom);
  const walking = useStudio((s) => s.view === "walk");
  return (
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
      <Lights />
      <Suspense fallback={null}>
        {showRoom && <Room />}
        {showRoom && <Furniture />}
        {scan && showScan && <ScanLayer key={scan.id} url={scan.glbUrl} />}
      </Suspense>
      <Annotations />
      <CameraRig />
    </Canvas>
  );
}
