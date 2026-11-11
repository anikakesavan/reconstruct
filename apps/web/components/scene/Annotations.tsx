"use client";
import { Html, Line } from "@react-three/drei";
import { useStudio } from "@/lib/store";
import { distance, metres } from "@/lib/format";
import type { Vec3 } from "@/lib/types";

function Pin({ at }: { at: Vec3 }) {
  return (
    <mesh position={at} renderOrder={10}>
      <sphereGeometry args={[0.035, 16, 12]} />
      <meshBasicMaterial color="#f2c230" depthTest={false} toneMapped={false} />
    </mesh>
  );
}

const tag = "figures pointer-events-none whitespace-nowrap rounded-[2px] border border-ink bg-tape px-1.5 py-0.5 text-[13px] font-semibold text-ink";

export function Annotations() {
  const { a, b } = useStudio((s) => s.measure);
  const probe = useStudio((s) => s.probe);
  const tool = useStudio((s) => s.tool);
  return (
    <>
      {tool === "measure" && a && <Pin at={a} />}
      {tool === "measure" && a && b && (
        <>
          <Pin at={b} />
          <Line points={[a, b]} color="#f2c230" lineWidth={2.5} depthTest={false} renderOrder={9} />
          <Html position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]} center zIndexRange={[20, 0]}>
            <div className={tag}>{metres(distance(a, b))}</div>
          </Html>
        </>
      )}
      {tool === "inspect" && probe && (
        <>
          <Pin at={probe.point} />
          <Html position={probe.point} zIndexRange={[20, 0]} style={{ transform: "translate(10px, -130%)" }}>
            <div className={tag}>{metres(Math.max(0, probe.point[1]))} above floor</div>
          </Html>
        </>
      )}
    </>
  );
}
