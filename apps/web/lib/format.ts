export const metres = (n: number, digits = 2) => `${n.toFixed(digits)} m`;
export const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
