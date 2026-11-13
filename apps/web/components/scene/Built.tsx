"use client";
import { RoundedBox } from "@react-three/drei";
import type { Vec3 } from "@/lib/types";
import { usePBR } from "./materials";

/** Furniture generated from dimensions. Origin is the centre of the footprint at floor level; front faces +Z. */

function Wood({ id, sx, sy }: { id: string; sx: number; sy: number }) {
  const maps = usePBR(id, Math.max(0.5, sx / 0.9), Math.max(0.5, sy / 0.9));
  return <meshStandardMaterial {...maps} roughness={0.7} envMapIntensity={0.7} />;
}
function Cloth({ color, sx, sy, id = "cotton_jersey" }: { color: string; sx: number; sy: number; id?: string }) {
  const maps = usePBR(id, sx / 0.35, sy / 0.35);
  return <meshStandardMaterial normalMap={maps.normalMap} normalScale={[1.4, 1.4]} roughnessMap={maps.roughnessMap} color={color} roughness={1} envMapIntensity={0.3} />;
}

export function Bed({ size, finish, fabric }: { size: Vec3; finish: string; fabric: string }) {
  const [w, , d] = size;
  const frameH = 0.26, legH = 0.1, mattH = 0.24, headH = 0.95, headT = 0.07;
  const mattW = w - 0.1, mattD = d - headT - 0.08;
  const top = legH + frameH;
  const pillows = w > 1.2 ? [-w * 0.24, w * 0.24] : [0];
  const pillowW = w > 1.2 ? w * 0.42 : w * 0.62;
  return (
    <group>
      {/* headboard at the back (-Z) */}
      <RoundedBox args={[w, headH, headT]} radius={0.025} smoothness={4} position={[0, headH / 2, -d / 2 + headT / 2]} castShadow receiveShadow>
        <Wood id={finish} sx={w} sy={headH} />
      </RoundedBox>
      <RoundedBox args={[w, frameH, d - headT]} radius={0.02} smoothness={4} position={[0, legH + frameH / 2, headT / 2]} castShadow receiveShadow>
        <Wood id={finish} sx={d} sy={frameH} />
      </RoundedBox>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (w / 2 - 0.09), legH / 2, sz * (d / 2 - 0.12)]} castShadow><cylinderGeometry args={[0.03, 0.022, legH, 16]} /><Wood id={finish} sx={0.3} sy={0.3} /></mesh>
      ))}
      <RoundedBox args={[mattW, mattH, mattD]} radius={0.07} smoothness={6} position={[0, top + mattH / 2 - 0.04, headT / 2 + 0.02]} castShadow receiveShadow>
        <Cloth color="#fbfaf6" sx={mattW} sy={mattD} />
      </RoundedBox>
      {/* duvet: covers the lower two thirds and drapes a little over the sides */}
      <RoundedBox args={[mattW + 0.07, 0.11, mattD * 0.66]} radius={0.05} smoothness={6} position={[0, top + mattH + 0.0, headT / 2 + 0.02 + mattD * 0.17]} castShadow receiveShadow>
        <Cloth color={fabric} sx={mattW} sy={mattD * 0.66} />
      </RoundedBox>
      <RoundedBox args={[mattW + 0.075, 0.1, 0.34]} radius={0.045} smoothness={6} position={[0, top + mattH + 0.02, headT / 2 + 0.02 - mattD * 0.16 + 0.17]} castShadow>
        <Cloth color="#fbfaf6" sx={mattW} sy={0.34} />
      </RoundedBox>
      {pillows.map((px) => (
        <RoundedBox key={px} args={[pillowW, 0.15, 0.42]} radius={0.07} smoothness={6} position={[px, top + mattH + 0.02, -d / 2 + headT + 0.3]} rotation={[-0.22, 0, 0]} castShadow receiveShadow>
          <Cloth color="#fdfcf9" sx={pillowW} sy={0.42} />
        </RoundedBox>
      ))}
    </group>
  );
}

export function Desk({ size, finish }: { size: Vec3; finish: string }) {
  const [w, h, d] = size;
  const topT = 0.032, leg = 0.045, inset = 0.06;
  return (
    <group>
      <RoundedBox args={[w, topT, d]} radius={0.008} smoothness={3} position={[0, h - topT / 2, 0]} castShadow receiveShadow><Wood id={finish} sx={w} sy={d} /></RoundedBox>
      <mesh position={[0, h - topT - 0.045, -d / 2 + inset + 0.01]} castShadow><boxGeometry args={[w - 2 * inset - leg, 0.09, 0.018]} /><Wood id={finish} sx={w} sy={0.2} /></mesh>
      <mesh position={[0, h - topT - 0.045, d / 2 - inset - 0.01]} castShadow><boxGeometry args={[w - 2 * inset - leg, 0.09, 0.018]} /><Wood id={finish} sx={w} sy={0.2} /></mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (w / 2 - inset), (h - topT) / 2, sz * (d / 2 - inset)]} castShadow>
          <cylinderGeometry args={[leg / 2, leg / 2 - 0.008, h - topT, 20]} /><Wood id={finish} sx={0.2} sy={h} />
        </mesh>
      ))}
    </group>
  );
}

export function Rug({ size, fabric }: { size: Vec3; fabric: string }) {
  const [w, h, d] = size;
  return (
    <RoundedBox args={[w, h, d]} radius={0.008} smoothness={2} position={[0, h / 2, 0]} receiveShadow>
      <Cloth id="wool_boucle" color={fabric} sx={w * 0.5} sy={d * 0.5} />
    </RoundedBox>
  );
}

export function Chair({ size, finish, fabric }: { size: Vec3; finish: string; fabric: string }) {
  const [w, h, d] = size;
  const seatY = 0.44, leg = 0.034;
  const fx = w / 2 - 0.035, fz = d / 2 - 0.05;
  return (
    <group>
      {/* front legs, then back legs that run up to carry the backrest (back is -Z) */}
      {[-1, 1].map((sx) => (
        <mesh key={`f${sx}`} position={[sx * fx, seatY / 2, fz]} castShadow><cylinderGeometry args={[leg / 2, leg / 2 - 0.007, seatY, 16]} /><Wood id={finish} sx={0.2} sy={0.5} /></mesh>
      ))}
      {[-1, 1].map((sx) => (
        <mesh key={`b${sx}`} position={[sx * fx, h / 2, -fz - 0.02]} rotation={[-0.09, 0, 0]} castShadow><cylinderGeometry args={[leg / 2 - 0.004, leg / 2 - 0.007, h, 16]} /><Wood id={finish} sx={0.2} sy={0.8} /></mesh>
      ))}
      <RoundedBox args={[w, 0.03, d - 0.06]} radius={0.012} smoothness={3} position={[0, seatY, 0.01]} castShadow receiveShadow><Wood id={finish} sx={w} sy={d} /></RoundedBox>
      <RoundedBox args={[w - 0.05, 0.04, d - 0.11]} radius={0.018} smoothness={4} position={[0, seatY + 0.032, 0.012]} castShadow><Cloth color={fabric} sx={w} sy={d} id="wool_boucle" /></RoundedBox>
      <RoundedBox args={[w - 0.03, 0.17, 0.024]} radius={0.011} smoothness={3} position={[0, h - 0.11, -fz - 0.05]} rotation={[-0.09, 0, 0]} castShadow><Wood id={finish} sx={w} sy={0.2} /></RoundedBox>
    </group>
  );
}

/** A framed abstract print. The artwork is two plain shapes drawn here, not an image of an existing work. */
export function Print({ size, finish, fabric }: { size: Vec3; finish: string; fabric: string }) {
  const [w, h, d] = size;
  const b = 0.028;
  return (
    <group position={[0, h / 2, 0]}>
      <mesh castShadow><boxGeometry args={[w, h, d]} /><Wood id={finish} sx={w} sy={h} /></mesh>
      <mesh position={[0, 0, d / 2 + 0.001]}><planeGeometry args={[w - 2 * b, h - 2 * b]} /><meshStandardMaterial color="#f7f5ef" roughness={0.95} /></mesh>
      <mesh position={[0, -h * 0.12, d / 2 + 0.002]}><planeGeometry args={[w * 0.5, h * 0.36]} /><meshStandardMaterial color={fabric} roughness={0.95} /></mesh>
      <mesh position={[w * 0.08, h * 0.19, d / 2 + 0.002]}><circleGeometry args={[w * 0.15, 48]} /><meshStandardMaterial color="#e0a96a" roughness={0.95} /></mesh>
    </group>
  );
}
