"use client";
import { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStudio, walkInput } from "@/lib/store";

const EYE = 1.6;
const SPEED = 1.4; // m/s, a slow indoor walk
const forward = new THREE.Vector3();
const right = new THREE.Vector3();

/** First-person walk: drag to look, WASD / arrows / touch pad to move. Stays inside the estimated walls. */
function Walk() {
  const { camera, gl } = useThree();
  const look = useRef({ yaw: Math.PI, pitch: -0.05 });

  useEffect(() => {
    camera.position.set(0, EYE, 0);
    const el = gl.domElement;
    let last: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => { last = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!last) return;
      look.current.yaw -= (e.clientX - last.x) * 0.004;
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - (e.clientY - last.y) * 0.004, -1.3, 1.3);
      last = { x: e.clientX, y: e.clientY };
    };
    const up = () => { last = null; };
    const keys: Record<string, [keyof typeof walkInput, number]> = {
      KeyW: ["forward", 1], ArrowUp: ["forward", 1], KeyS: ["forward", -1], ArrowDown: ["forward", -1],
      KeyD: ["strafe", 1], ArrowRight: ["strafe", 1], KeyA: ["strafe", -1], ArrowLeft: ["strafe", -1],
    };
    const typing = (e: KeyboardEvent) => (e.target as HTMLElement)?.tagName === "INPUT";
    const kd = (e: KeyboardEvent) => { const k = keys[e.code]; if (k && !typing(e)) { walkInput[k[0]] = k[1]; e.preventDefault(); } };
    const ku = (e: KeyboardEvent) => { const k = keys[e.code]; if (k && walkInput[k[0]] === k[1]) walkInput[k[0]] = 0; };
    el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => {
      el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
      walkInput.forward = 0; walkInput.strafe = 0;
    };
  }, [camera, gl]);

  useFrame((_, dt) => {
    const { yaw, pitch } = look.current;
    camera.rotation.set(pitch, yaw, 0, "YXZ");
    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    const step = Math.min(dt, 0.1) * SPEED;
    camera.position.addScaledVector(forward, walkInput.forward * step).addScaledVector(right, walkInput.strafe * step);
    const w = useStudio.getState().room?.envelope.walls;
    if (w) {
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, w.x_min + 0.25, w.x_max - 0.25);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, w.z_min + 0.25, w.z_max - 0.25);
    }
    camera.position.y = EYE;
  });
  return null;
}

export function CameraRig() {
  const view = useStudio((s) => s.view);
  const dragging = useStudio((s) => s.dragging);
  const { camera, size } = useThree();
  // Frame the room whatever its size: the tuned positions below were set for a 5.6 m room.
  const span = useStudio((s) => (s.room ? Math.max(s.room.envelope.width_m, s.room.envelope.depth_m, 2) : 5.6));
  const f = span / 5.6;

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const portrait = size.height > size.width;
    if (view === "orbit") { cam.fov = 42; cam.position.set(...((portrait ? [8.6, 10.2, 11] : [5.2, 6.2, 6.6]).map((n) => n * f)) as [number, number, number]); }
    if (view === "plan") { cam.fov = 28; cam.position.set(0, (portrait ? 27 : 13.5) * f, 0.001); }
    if (view === "walk") cam.fov = 68;
    cam.updateProjectionMatrix();
    // Framing is intentionally reset only when the mode changes, not on every resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, camera, f]);

  if (view === "walk") return <Walk />;
  return (
    <OrbitControls
      key={view}
      makeDefault
      enabled={!dragging}
      target={[0, view === "plan" ? 0 : 0.9, 0]}
      enableRotate={view === "orbit"}
      enableDamping dampingFactor={0.12}
      minDistance={1} maxDistance={30 * Math.max(1, f)}
      maxPolarAngle={view === "orbit" ? Math.PI / 2 - 0.02 : 0}
      mouseButtons={view === "plan" ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN } : undefined}
      touches={view === "plan" ? { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN } : undefined}
    />
  );
}
