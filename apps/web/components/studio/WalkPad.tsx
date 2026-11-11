"use client";
import { walkInput } from "@/lib/store";

type Axis = keyof typeof walkInput;
const KEYS: { label: string; aria: string; axis: Axis; value: number; cell: string }[] = [
  { label: "↑", aria: "Walk forward", axis: "forward", value: 1, cell: "col-start-2 row-start-1" },
  { label: "←", aria: "Step left", axis: "strafe", value: -1, cell: "col-start-1 row-start-2" },
  { label: "↓", aria: "Walk back", axis: "forward", value: -1, cell: "col-start-2 row-start-2" },
  { label: "→", aria: "Step right", axis: "strafe", value: 1, cell: "col-start-3 row-start-2" },
];

/** On-screen movement keys for walk mode. Drag anywhere else on the room to look around. */
export function WalkPad() {
  return (
    <div className="absolute bottom-[92px] right-3 z-10 sm:bottom-6 sm:right-6">
      <p className="mb-1 hidden text-right text-[12px] text-mat-line sm:block">Drag to look. W A S D or these keys to walk.</p>
      <div className="ml-auto grid w-max grid-cols-3 grid-rows-2 gap-1">
        {KEYS.map((k) => (
          <button
            key={k.aria} aria-label={k.aria}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); walkInput[k.axis] = k.value; }}
            onPointerUp={() => { walkInput[k.axis] = 0; }} onPointerCancel={() => { walkInput[k.axis] = 0; }}
            onContextMenu={(e) => e.preventDefault()}
            className={`board h-12 w-12 touch-none text-[18px] active:bg-tape ${k.cell}`}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
