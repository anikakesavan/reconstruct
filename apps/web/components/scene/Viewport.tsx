"use client";
import { Suspense, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
import { ScanMesh } from "./ScanMesh";
import { Volumes } from "./Volumes";
import { Annotations } from "./Annotations";
import { CameraRig } from "./CameraRig";
import { useStudio } from "@/lib/store";

function Stats() {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ t: 0, n: 0 });
  useFrame((_, dt) => {
    acc.current.t += dt; acc.current.n += 1;
    if (acc.current.t >= 0.5) {
      useStudio.getState().setStats(Math.round(acc.current.n / acc.current.t), gl.info.render.triangles);
      acc.current = { t: 0, n: 0 };
    }
  });
  return null;
}

export default function Viewport() {
  const view = useStudio((s) => s.view);
  const scan = useStudio((s) => s.scan);
  return (
    <Canvas
      camera={{ position: [5.2, 6.2, 6.6], fov: 42, near: 0.05, far: 80 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => useStudio.getState().select(null)}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#1e4d43"]} />
      {/* The cutting mat: 0.5 m cells, 1 m sections. Sits just under the scanned floor. */}
      {view !== "walk" && (
        <Grid
          position={[0, -0.06, 0]} infiniteGrid cellSize={0.5} sectionSize={1}
          cellColor="#4f8676" sectionColor="#8fc2b2" cellThickness={0.6} sectionThickness={1}
          fadeDistance={34} fadeStrength={1.6}
        />
      )}
      <Suspense fallback={null}>
        <ScanMesh key={scan.id} url={scan.glbUrl} />
      </Suspense>
      <Volumes />
      <Annotations />
      <CameraRig />
      <Stats />
    </Canvas>
  );
}
