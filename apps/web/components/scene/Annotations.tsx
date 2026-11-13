"use client";
import { Html, Line } from "@react-three/drei";
import { useStudio } from "@/lib/store";
import { distance, metres } from "@/lib/format";
import type { Vec3 } from "@/lib/types";

function Pin({ at }: { at: Vec3 }) {
  return (
    <mesh position={at} renderOrder={10}>
      <sphereGeometry args={[0.035, 16, 12]} />
      <meshBasicMaterial color="#1f6f5c" depthTest={false} toneMapped={false} />
    </mesh>
  );
}

const tag = "figures pointer-events-none whitespace-nowrap rounded-md bg-accent px-2 py-0.5 text-[13px] font-semibold text-white shadow";

export function Annotations() {
  const { a, b } = useStudio((s) => s.measure);
  const tool = useStudio((s) => s.tool);
  if (tool !== "measure" || !a) return null;
  return (
    <>
      <Pin at={a} />
      {b && (
        <>
          <Pin at={b} />
          <Line points={[a, b]} color="#1f6f5c" lineWidth={2.5} depthTest={false} renderOrder={9} />
          <Html position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]} center zIndexRange={[20, 0]}>
            <div className={tag}>{metres(distance(a, b))}</div>
          </Html>
        </>
      )}
    </>
  );
}
