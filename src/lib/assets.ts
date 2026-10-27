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

export const img = (src?: string) => (src && src.startsWith("asset:") ? ASSETS[src.slice(6)] ?? "" : src ?? "");
