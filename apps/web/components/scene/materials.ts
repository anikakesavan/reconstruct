"use client";
import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { asset } from "@/lib/catalog";

/** A CC0 Poly Haven material set (colour, normal, roughness), tiled every `metres`. */
export function usePBR(id: string, repeatX: number, repeatY: number) {
  const maps = useTexture({
    map: asset(`/textures/${id}/diff.webp`),
    normalMap: asset(`/textures/${id}/nor.webp`),
    roughnessMap: asset(`/textures/${id}/rough.webp`),
  });
  return useMemo(() => {
    const out = {} as Record<keyof typeof maps, THREE.Texture>;
    (Object.keys(maps) as (keyof typeof maps)[]).forEach((k) => {
      const t = maps[k].clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeatX, repeatY);
      t.anisotropy = 8;
      t.colorSpace = k === "map" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.needsUpdate = true;
      out[k] = t;
    });
    return out;
  }, [maps, repeatX, repeatY]);
}

export const ACCENT = "#1f6f5c";
