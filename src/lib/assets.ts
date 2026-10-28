// Brand imagery. Products can reference files here as "asset:<key>";
// uploaded product photos are stored as normal URLs.

import a_brand_icon from "../assets/brand/icon.png";
import a_brand_lockup from "../assets/brand/lockup.png";
import a_brand_logo_ar from "../assets/brand/logo-ar.png";
import a_brand_pattern from "../assets/brand/pattern.jpg";
import a_brand_tagline from "../assets/brand/tagline.png";
import a_brand_wordmark from "../assets/brand/wordmark.png";

export const ASSETS: Record<string, string> = {
  "brand/icon": a_brand_icon,
  "brand/lockup": a_brand_lockup,
  "brand/logo-ar": a_brand_logo_ar,
  "brand/pattern": a_brand_pattern,
  "brand/tagline": a_brand_tagline,
  "brand/wordmark": a_brand_wordmark,
};

/** Turns a stored image reference into a URL. Tolerates bad values from the sheet (numbers, objects, empty cells). */
export const imageRef = (v: unknown): string => {
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object") { const o = v as { url?: unknown; src?: unknown }; return imageRef(o.url ?? o.src ?? ""); }
  return "";
};
export const img = (src?: unknown) => { const s = imageRef(src); return s.startsWith("asset:") ? ASSETS[s.slice(6)] ?? "" : s; };
