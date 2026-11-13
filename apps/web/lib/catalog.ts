import generated from "./catalog.generated.json";
import type { Vec3 } from "./types";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const asset = (path: string) => `${BASE}${path}`;

export type Category = "Beds" | "Tables" | "Seating" | "Storage" | "Lighting" | "Decor" | "Plants" | "Rugs";
export type Placement = "floor" | "surface" | "wall" | "rug";
export type PartKind = "fabric" | "wood" | "metal" | "paint";

/** A region of a model's colour texture that can be recoloured on its own. Found automatically (tools/build_catalog.py). */
export interface Part { kind: PartKind; color: string; share: number; lum: number }

export interface CatalogItem {
  id: string; name: string;
  /** what the piece is, in the vocabulary the scan detector also uses */
  cls: string;
  category: Category; place: Placement;
  /** turn and scale baked in so every piece faces +Z at its real size */
  yaw: number; scale: number;
  /** width, height, depth in metres as shipped */
  size: Vec3;
  /** height of the top surface things can stand on, if any */
  surface?: number;
  source: "abo" | "polyhaven";
  parts: Part[]; partsMaterial: string | null;
}

export const CATALOG = (generated as CatalogItem[]).map((i) => ({
  ...i,
  // only a bed's "top" is below its highest point (the mattress, under the headboard)
  surface: i.surface === undefined ? undefined : i.cls === "bed" ? i.surface : i.size[1],
}));
export const ITEM = Object.fromEntries(CATALOG.map((i) => [i.id, i])) as Record<string, CatalogItem>;
export const CATEGORIES: Category[] = ["Beds", "Tables", "Seating", "Storage", "Lighting", "Decor", "Plants", "Rugs"];
export const modelUrl = (id: string) => asset(`/models/${id}.glb`);
export const maskUrl = (id: string) => asset(`/models/${id}.mask.png`);
export const thumbUrl = (id: string) => asset(`/thumbs/${id}.webp`);

export const FLOORS = [
  { id: "laminate_floor_02", name: "Pale laminate", repeat: 1.8, color: "#c9a77c" },
  { id: "wood_floor", name: "Oak boards", repeat: 1.6, color: "#8a5a33" },
  { id: "herringbone_parquet", name: "Herringbone", repeat: 1.4, color: "#a06a3c" },
] as const;

export const WALL_COLORS = [
  { hex: "#f3efe6", name: "Warm white" }, { hex: "#f7f7f4", name: "Gallery white" }, { hex: "#e6e2d6", name: "Oat" },
  { hex: "#dfe5dc", name: "Pale sage" }, { hex: "#dbe3ea", name: "Mist blue" }, { hex: "#ecd9cf", name: "Blush" },
  { hex: "#cfd3d0", name: "Stone grey" }, { hex: "#3f4a47", name: "Deep green" },
];

/** Colour choices, grouped by the material they are meant to look like. Any group can be used on any part. */
export const PALETTES: Record<PartKind | "leather", { name: string; hex: string }[]> = {
  fabric: [
    { name: "White", hex: "#f2efe9" }, { name: "Oatmeal", hex: "#d6cbb8" }, { name: "Light grey", hex: "#b9bab8" }, { name: "Charcoal", hex: "#45484a" },
    { name: "Sage", hex: "#a3b29b" }, { name: "Dusty blue", hex: "#8499ad" }, { name: "Navy", hex: "#283a55" }, { name: "Blush", hex: "#d9b3a6" },
    { name: "Clay", hex: "#b9775f" }, { name: "Mustard", hex: "#d1a94c" }, { name: "Forest", hex: "#3d5a4b" },
  ],
  leather: [
    { name: "Cognac", hex: "#9a5b2e" }, { name: "Tan", hex: "#b98556" }, { name: "Chestnut", hex: "#6b3a22" }, { name: "Black", hex: "#1c1b1a" }, { name: "Cream", hex: "#e3d6c1" },
  ],
  wood: [
    { name: "Birch", hex: "#d9c09a" }, { name: "Oak", hex: "#b98f5f" }, { name: "Walnut", hex: "#6b4429" }, { name: "Espresso", hex: "#3a261b" }, { name: "Whitewash", hex: "#e4dccf" }, { name: "Black stain", hex: "#26221f" },
  ],
  metal: [
    { name: "Brass", hex: "#c9a45c" }, { name: "Black", hex: "#222222" }, { name: "Chrome", hex: "#d2d4d6" }, { name: "Copper", hex: "#b87650" }, { name: "White", hex: "#eeeeec" },
  ],
  paint: [
    { name: "White", hex: "#f4f3f0" }, { name: "Cream", hex: "#e9e1d0" }, { name: "Grey", hex: "#9c9e9d" }, { name: "Black", hex: "#262626" }, { name: "Sage", hex: "#a9b8a2" }, { name: "Navy", hex: "#2c3e57" }, { name: "Terracotta", hex: "#b9694c" },
  ],
};

/** Detector labels mapped to catalogue classes. Anything not listed is reported but not placed. */
export const LABEL_TO_CLS: Record<string, string> = {
  bed: "bed", desk: "desk", table: "desk", chair: "chair", armchair: "armchair", "swivel chair": "chair", sofa: "sofa",
  "chest of drawers": "dresser", cabinet: "dresser", wardrobe: "wardrobe", bookcase: "bookcase", shelf: "bookcase",
  lamp: "table_lamp", "floor lamp": "floor_lamp", mirror: "mirror", rug: "rug", ottoman: "ottoman", stool: "ottoman", "coffee table": "table",
  plant: "plant", nightstand: "nightstand", "side table": "nightstand",
};
