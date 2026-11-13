import type { Vec3 } from "./types";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const asset = (path: string) => `${BASE}${path}`;

export type Category = "Beds" | "Tables" | "Seating" | "Storage" | "Plants" | "Lighting" | "Decor" | "Rugs";

export interface CatalogItem {
  id: string;
  name: string;
  category: Category;
  /** "model": a CC0 scanned or modelled asset from Poly Haven. "built": generated in code from dimensions. */
  kind: "model" | "built";
  /** Turn applied so that every item's front faces +Z before the user rotates it. */
  yaw?: number;
  /** Uniform scale for models that ship smaller than the real thing. */
  scale?: number;
  /** Built items: width, height, depth in metres. Model sizes are read from the file when it loads. */
  size?: Vec3;
  /** Built items that take a wood finish. */
  wood?: boolean;
  /** Default tint for fabric on built items. */
  fabric?: string;
  /** Sits on other furniture by default (lamps, vases), so new ones are added at table height. */
  tabletop?: boolean;
  /** Hangs on a wall. */
  wall?: boolean;
}

export const CATALOG: CatalogItem[] = [
  { id: "bed_double", name: "Platform bed, double", category: "Beds", kind: "built", size: [1.5, 0.95, 2.1], wood: true, fabric: "#f4f1ea" },
  { id: "bed_queen", name: "Platform bed, queen", category: "Beds", kind: "built", size: [1.7, 0.95, 2.15], wood: true, fabric: "#f4f1ea" },
  { id: "bed_single", name: "Platform bed, single", category: "Beds", kind: "built", size: [1.0, 0.95, 2.05], wood: true, fabric: "#f4f1ea" },
  { id: "desk", name: "Writing desk", category: "Tables", kind: "built", size: [1.3, 0.74, 0.62], wood: true },
  { id: "side_table_01", name: "Side table", category: "Tables", kind: "model" },
  { id: "coffee_table_round_01", name: "Round coffee table", category: "Tables", kind: "model" },
  { id: "chair", name: "Desk chair", category: "Seating", kind: "built", size: [0.46, 0.8, 0.5], wood: true, fabric: "#d9cdb8" },
  { id: "modern_arm_chair_01", name: "Armchair", category: "Seating", kind: "model" },
  { id: "mid_century_lounge_chair", name: "Lounge chair", category: "Seating", kind: "model" },
  { id: "wooden_display_shelves_01", name: "Cube shelves", category: "Storage", kind: "model" },
  { id: "drawer_cabinet", name: "Open cabinet", category: "Storage", kind: "model" },
  { id: "modern_wooden_cabinet", name: "Sideboard", category: "Storage", kind: "model" },
  { id: "steel_frame_shelves_03", name: "Steel frame shelves", category: "Storage", kind: "model" },
  { id: "wicker_basket_02", name: "Wicker basket", category: "Storage", kind: "model", scale: 1.9 },
  { id: "potted_plant_01", name: "Tall plant", category: "Plants", kind: "model" },
  { id: "potted_plant_02", name: "Leafy plant", category: "Plants", kind: "model" },
  { id: "potted_plant_04", name: "Small succulent", category: "Plants", kind: "model", tabletop: true },
  { id: "desk_lamp_arm_01", name: "Desk lamp", category: "Lighting", kind: "model", tabletop: true },
  { id: "ceramic_vase_01", name: "Round vase", category: "Decor", kind: "model", tabletop: true },
  { id: "ceramic_vase_03", name: "Tall vase", category: "Decor", kind: "model", tabletop: true },
  { id: "standing_picture_frame_01", name: "Standing frame", category: "Decor", kind: "model", tabletop: true },
  { id: "print", name: "Framed print", category: "Decor", kind: "built", size: [0.6, 0.8, 0.035], wood: true, fabric: "#a9b8a2", wall: true },
  { id: "book_encyclopedia_set_01", name: "Row of books", category: "Decor", kind: "model", tabletop: true },
  { id: "throw_pillows_01", name: "Throw pillows", category: "Decor", kind: "model", tabletop: true },
  { id: "rug_large", name: "Wool rug, large", category: "Rugs", kind: "built", size: [2.4, 0.018, 1.7], fabric: "#b3bfab" },
  { id: "rug_small", name: "Wool rug, small", category: "Rugs", kind: "built", size: [1.6, 0.018, 1.0], fabric: "#b3bfab" },
];

export const ITEM = Object.fromEntries(CATALOG.map((i) => [i.id, i])) as Record<string, CatalogItem>;
export const CATEGORIES: Category[] = ["Beds", "Tables", "Seating", "Storage", "Plants", "Lighting", "Decor", "Rugs"];
export const modelUrl = (id: string) => asset(`/models/${id}.glb`);

export const FLOORS = [
  { id: "wood_floor", name: "Oak boards", repeat: 1.6 },
  { id: "laminate_floor_02", name: "Pale laminate", repeat: 1.8 },
  { id: "herringbone_parquet", name: "Herringbone", repeat: 1.4 },
] as const;

export const WOODS = [
  { id: "oak_veneer_01", name: "Oak" },
  { id: "plywood", name: "Birch ply" },
  { id: "black_oak_veneer", name: "Black oak" },
] as const;

export const WALL_COLORS = [
  { hex: "#f3efe6", name: "Warm white" },
  { hex: "#f7f7f4", name: "Gallery white" },
  { hex: "#e6e2d6", name: "Oat" },
  { hex: "#dfe5dc", name: "Pale sage" },
  { hex: "#dbe3ea", name: "Mist blue" },
  { hex: "#ecd9cf", name: "Blush" },
];

export const TINTS = [
  { hex: "#f4f1ea", name: "Ivory" },
  { hex: "#d9cdb8", name: "Sand" },
  { hex: "#a9b8a2", name: "Sage" },
  { hex: "#8fa3b5", name: "Dusty blue" },
  { hex: "#c98f7a", name: "Clay" },
  { hex: "#e2c56d", name: "Mustard" },
  { hex: "#55605c", name: "Slate" },
  { hex: "#2c302e", name: "Charcoal" },
];

/** Size of every item as placed (w, h, d). Built items are known; models report theirs after loading. */
export const sizes = new Map<string, Vec3>(CATALOG.filter((i) => i.size).map((i) => [i.id, i.size!]));
