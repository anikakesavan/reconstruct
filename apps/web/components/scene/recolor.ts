"use client";
import * as THREE from "three";
import { maskUrl, type CatalogItem } from "@/lib/catalog";

/**
 * Physically sensible recolouring. A model's colour texture is split (offline) into parts. To recolour a part we keep
 * each pixel's brightness relative to the part's average (which carries weave, grain, seams and baked shading) and
 * replace its colour with the target. So white on a dark leather chair gives white leather with the same creases,
 * instead of a dark chair with a tint. Normal and roughness maps are untouched.
 */
const masks = new Map<string, Promise<Uint8ClampedArray>>();
const bases = new WeakMap<THREE.Texture, ImageData>();
const cache = new Map<string, THREE.Texture>();
const MASK_N = 512;

function loadMask(id: string): Promise<Uint8ClampedArray> {
  let p = masks.get(id);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = document.createElement("canvas"); c.width = c.height = MASK_N;
        const ctx = c.getContext("2d", { willReadFrequently: true })!; ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0, MASK_N, MASK_N);
        resolve(ctx.getImageData(0, 0, MASK_N, MASK_N).data);
      };
      img.onerror = reject; img.src = maskUrl(id);
    });
    masks.set(id, p);
  }
  return p;
}

const toLin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const toSrgb = (l: number) => { const c = Math.min(1, Math.max(0, l)); return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255); };
const LIN = Float32Array.from({ length: 256 }, (_, i) => toLin(i));

/** Returns a recoloured copy of `map`, or the original when no colour is set. Cached per item and colour set. */
export async function recolour(item: CatalogItem, map: THREE.Texture, colors: (string | null)[]): Promise<THREE.Texture> {
  if (!colors.some(Boolean) || !item.parts.length) return map;
  const key = `${item.id}|${colors.join(",")}`;
  const hit = cache.get(key); if (hit) return hit;
  const mask = await loadMask(item.id);
  let base = bases.get(map);
  const src = map.image as CanvasImageSource & { width: number; height: number };
  const W = src.width, H = src.height;
  if (!base) {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d", { willReadFrequently: true })!; ctx.drawImage(src, 0, 0);
    base = ctx.getImageData(0, 0, W, H); bases.set(map, base);
  }
  const out = new ImageData(new Uint8ClampedArray(base.data), W, H); const px = out.data;
  const targets = colors.map((hex) => (hex ? [1, 3, 5].map((i) => LIN[parseInt(hex.slice(i, i + 2), 16)]) : null));
  for (let y = 0; y < H; y++) {
    const my = Math.min(MASK_N - 1, (y * MASK_N / H) | 0) * MASK_N;
    for (let x = 0; x < W; x++) {
      const part = Math.round(mask[(my + Math.min(MASK_N - 1, (x * MASK_N / W) | 0)) * 4] / 100);
      const t = targets[part]; if (!t) continue;
      const i = (y * W + x) * 4;
      const lum = 0.2126 * LIN[px[i]] + 0.7152 * LIN[px[i + 1]] + 0.0722 * LIN[px[i + 2]];
      const mean = Math.max(0.004, item.parts[part].lum);
      // very dark originals carry little usable detail, so trust their variation less
      const trust = Math.min(1, Math.max(0.35, mean / 0.03));
      const ratio = 1 + (Math.min(2.2, lum / mean) - 1) * trust;
      px[i] = toSrgb(t[0] * ratio); px[i + 1] = toSrgb(t[1] * ratio); px[i + 2] = toSrgb(t[2] * ratio);
    }
  }
  const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d")!.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = map.flipY; tex.colorSpace = map.colorSpace; tex.wrapS = map.wrapS; tex.wrapT = map.wrapT;
  tex.repeat.copy(map.repeat); tex.offset.copy(map.offset); tex.channel = map.channel; tex.anisotropy = 8; tex.needsUpdate = true;
  cache.set(key, tex);
  if (cache.size > 60) { const first = cache.keys().next().value!; cache.get(first)?.dispose(); cache.delete(first); }
  return tex;
}
