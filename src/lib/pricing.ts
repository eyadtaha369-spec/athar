import { imageRef } from "./assets";
import type { Category, Product, Variant } from "./types";

/**
 * Customer selling prices per size (EGP). Each size carries its own final price;
 * nothing else is shown to customers.
 */
export const SIZE_PRESETS: Partial<Record<Category, { label: string; sizes: Omit<Variant, "id">[] }>> = {
  posters: {
    label: "Poster sizes",
    sizes: [
      { label: "20×30 cm", price: 210 },
      { label: "40×30 cm", price: 250 },
      { label: "50×40 cm", price: 350 },
      { label: "50×60 cm", price: 500 },
      { label: "50×70 cm", price: 460 },
    ],
  },
  flags: {
    label: "Flag sizes",
    sizes: [
      { label: "146×96 cm", price: 340 },
      { label: "146×146 cm", price: 430 },
      { label: "196×146 cm", price: 510 },
      { label: "246×146 cm", price: 610 },
    ],
  },
  sunshades: {
    label: "Sunshade size",
    sizes: [{ label: "Cover 80", price: 250 }],
  },
  sleeves: {
    label: "Laptop sizes",
    sizes: [
      { label: "12 inch", price: 350 },
      { label: "13 inch", price: 350 },
      { label: "14 inch", price: 370 },
      { label: "15 inch", price: 370 },
      { label: "17 inch", price: 400 },
    ],
  },
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const presetVariants = (c: Category): Variant[] =>
  (SIZE_PRESETS[c]?.sizes ?? []).map((s) => ({ id: slug(s.label), ...s }));

/** Lowest selling price, used for "from" labels and sorting. */
export const fromPrice = (variants: Variant[], fallback: number) =>
  variants.length ? Math.min(...variants.map((v) => v.price)) : fallback;

export const hasPriceRange = (p: Product) => new Set(p.variants.map((v) => v.price)).size > 1;

/**
 * Brings any stored product to the current shape: every variant has its own `price`
 * (older data stored a `priceDelta` on top of the base price) and `price` is the lowest one.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeProduct(p: any): Product {
  const variants: Variant[] = (p.variants ?? []).map((v: { id: string; label: string; price?: number; priceDelta?: number }) => ({
    id: v.id, label: v.label, price: typeof v.price === "number" ? v.price : (p.price ?? 0) + (v.priceDelta ?? 0),
  }));
  // Sheet rows edited by hand can hold odd values; keep only usable photo links
  const images = (Array.isArray(p.images) ? p.images : p.images ? [p.images] : []).map(imageRef).filter(Boolean);
  return { ...p, id: String(p.id), name: String(p.name ?? ""), description: String(p.description ?? ""), category: String(p.category ?? ""),
    images, details: Array.isArray(p.details) ? p.details.map(String) : [], variants, price: fromPrice(variants, p.price ?? 0) };
}

/** Applies the size price list to every product in a category that has one. */
export function applySizePresets(p: Product): Product {
  const preset = presetVariants(p.category);
  if (!preset.length) return p;
  return { ...p, variants: preset, variantLabel: "Size", price: fromPrice(preset, p.price), compareAt: undefined };
}
