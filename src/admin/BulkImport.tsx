import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Download, FolderUp, Loader2, X } from "lucide-react";
import { useStore } from "../lib/store";
import { fromPrice, presetVariants } from "../lib/pricing";
import { phoneModels } from "../lib/seed";
import { CATEGORY_LABEL, compressImage, cx, egp, uid } from "../lib/utils";
import type { Category, Frame, Product, Variant } from "../lib/types";

/**
 * Bulk import for every category. Pick the unzipped folder and it builds the products:
 *
 *  Category: chosen at the top, or "from folders" where the top-level folders say which category
 *  (Posters/, Flags or أعلام/, Laptop Sleeves/, Phone Cases/, Sunshades/).
 *
 *  Posters: pairs each design's black-frame and white-frame image (by name, or by comparing the artwork).
 *  Other categories: one image = one product, or one folder per product holding its photos
 *  (front, back, …), or files named "Name 1.jpg", "Name 2.jpg" grouped into one product.
 *
 *  Optional products.csv / products.json in the folder sets names, Arabic names, category, stock,
 *  prices and descriptions exactly (download the template from the modal).
 */

const CATS: Category[] = ["posters", "flags", "sleeves", "cases", "sunshades"];
const CAT_WORDS: [Category, RegExp][] = [
  ["posters", /poster|wall\s*art|بوستر|لوحات|لوحة/i],
  ["sleeves", /sleeve|laptop|لابتوب|لاب توب/i],
  ["cases", /phone|mobile|\bcases?\b|موبايل|تليفون|جراب/i],
  ["flags", /flag|a3lam|aalam|أعلام|اعلام|علم/i],
  ["sunshades", /sun\s*shade|shade|windshield|شمسي|شماسي|شمسية/i],
];
const categoryFrom = (text: string): Category | "" => {
  const t = text.trim().toLowerCase();
  if (CATS.includes(t as Category)) return t as Category;
  return CAT_WORDS.find(([, re]) => re.test(t))?.[0] ?? "";
};

const DETAILS: Record<Category, string[]> = {
  posters: ["Printed on 250gsm matte art paper", "Fade-resistant pigment inks", "Comes framed in black or white, ready to hang", "Ships in a corner-protected box"],
  flags: ["Knitted polyester, vivid on both sides", "Two brass grommets for hanging", "Printed within 3 working days"],
  sleeves: ["5mm wool-blend felt", "Leather strap with snap", "Front pocket for charger and cables", "Soft microfibre lining"],
  cases: ["Dual-layer TPU + polycarbonate", "Matte, fingerprint-resistant finish", "Raised camera lip", "Wireless-charging compatible"],
  sunshades: ["Reflective silver backing", "Folds into a pouch the size of a plate", "Fits most sedans and SUVs", "Printed artwork faces outward"],
};

const relPath = (f: File) => ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name).split("/").filter(Boolean);
const isImage = (f: File) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|avif)$/i.test(f.name);
const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/* ---------- optional products.csv / products.json ---------- */
type Mapped = { name: string; nameAr?: string; category?: string; stock?: number; price?: number; prices?: number[]; description?: string; images: string[]; black?: string; white?: string };

function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === "," || c === ";" && !text.includes(",")) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  if (!head) return [];
  const keys = head.map((h) => h.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s-]+/g, "_"));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}
const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^\d.]/g, "")); return String(v ?? "").trim() && Number.isFinite(n) ? n : undefined; };
const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : String(v ?? "").split(/[|;\n]/)).map((x) => x.trim()).filter(Boolean);

function readMapping(records: Record<string, unknown>[]): Mapped[] {
  return records.map((r) => ({
    name: String(r.name ?? r.name_en ?? r.title ?? "").trim(),
    nameAr: String(r.name_ar ?? r.arabic_name ?? r.nameAr ?? "").trim() || undefined,
    category: String(r.category ?? "").trim() || undefined,
    stock: num(r.stock),
    price: num(r.price),
    prices: r.prices != null && String(r.prices).trim() ? list(r.prices).map((x) => num(x) ?? 0) : undefined,
    description: String(r.description ?? "").trim() || undefined,
    images: list(r.images ?? r.image ?? r.photos),
    black: String(r.black_image ?? r.black ?? r.blackImage ?? "").trim() || undefined,
    white: String(r.white_image ?? r.white ?? r.whiteImage ?? "").trim() || undefined,
  })).filter((m) => m.name);
}

const TEMPLATE = [
  "name,name_ar,category,stock,price,prices,description,images,black_image,white_image",
  'Ferrari,فيراري,posters,10,,,"",,ferrari-black.jpg,ferrari-white.jpg',
  "Egypt Pharaohs Flag,علم الفراعنة,flags,15,,340|430|510|610,Big flag for match days,pharaohs.jpg,,",
  "Sahara Sleeve,,sleeves,8,,,Felt sleeve with a desert print,sahara-front.jpg|sahara-back.jpg,,",
  "Cartouche Case,خرطوشة,cases,25,300,,,cartouche.jpg,,",
  "Nile Sunset Sunshade,,sunshades,12,,,,nile.jpg,,",
].join("\n");

type Row = {
  key: string; name: string; category: Category | "";
  black?: File; white?: File;          // posters
  images?: File[];                     // every other category
  status: "ready" | "saving" | "saved" | "failed" | "skipped"; note?: string; auto?: boolean;
  // optional values from a products.csv / products.json in the folder
  nameAr?: string; description?: string; stock?: number; price?: number; prices?: number[];
};

/**
 * Looks at an image once and returns:
 *  - art: a small colour fingerprint of the middle of the picture (the poster artwork, inside any frame),
 *    normalised so lighting doesn't matter. The black and white versions of a design share it.
 *  - edge: brightness around the outside (where the frame is). The black-frame version is darker there.
 */
type Look = { art: Float32Array; edge: number; grid: Float32Array };
const GW = 48, GH = 60; // brightness grid used to find where two versions differ (the frame)
async function look(f: File): Promise<Look | null> {
  try {
    const bmp = await createImageBitmap(f, { resizeWidth: 240, resizeQuality: "low" } as ImageBitmapOptions);
    const W = 240, H = Math.max(1, Math.round((bmp.height / bmp.width) * 240));
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true })!; g.drawImage(bmp, 0, 0, W, H); bmp.close?.();
    const px = g.getImageData(0, 0, W, H).data;
    const lum = (x: number, y: number) => { const k = (y * W + x) * 4; return 0.299 * px[k] + 0.587 * px[k + 1] + 0.114 * px[k + 2]; };
    // artwork: the middle of the picture (well inside any frame and mat), sampled on a 12×15 grid, RGB
    const gx = 12, gy = 15, art = new Float32Array(gx * gy * 3);
    const x0 = W * 0.36, x1 = W * 0.64, y0 = H * 0.36, y1 = H * 0.64;
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
      const x = Math.floor(x0 + ((i + 0.5) / gx) * (x1 - x0)), y = Math.floor(y0 + ((j + 0.5) / gy) * (y1 - y0));
      const k = (y * W + x) * 4, o = (j * gx + i) * 3;
      art[o] = px[k]; art[o + 1] = px[k + 1]; art[o + 2] = px[k + 2];
    }
    let mean = 0; art.forEach((v) => (mean += v)); mean /= art.length;
    let norm = 0; for (let k = 0; k < art.length; k++) { art[k] -= mean; norm += art[k] * art[k]; }
    norm = Math.sqrt(norm) || 1; for (let k = 0; k < art.length; k++) art[k] /= norm;
    // frame area: everything outside the middle 60%
    let t = 0, n = 0;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      if (x > W * 0.2 && x < W * 0.8 && y > H * 0.2 && y < H * 0.8) continue;
      t += lum(x, y); n++;
    }
    const grid = new Float32Array(GW * GH);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) grid[j * GW + i] = lum(Math.floor(((i + 0.5) / GW) * W), Math.floor(((j + 0.5) / GH) * H));
    return { art, edge: n ? t / n : 128, grid };
  } catch { return null; }
}
/**
 * Which of two versions of the same design has the black frame: look only where the two pictures differ
 * clearly (that is the frame), and take the one that is darker there.
 */
function blackFirst(a: Look, b: Look): { aIsBlack: boolean; sure: boolean } {
  let da = 0, db = 0, n = 0;
  for (let k = 0; k < a.grid.length; k++) {
    if (Math.abs(a.grid[k] - b.grid[k]) > 45) { da += a.grid[k]; db += b.grid[k]; n++; }
  }
  if (n < 4) return { aIsBlack: a.edge <= b.edge, sure: false };
  return { aIsBlack: da <= db, sure: Math.abs(da - db) / n > 40 };
}
const likeness = (a: Float32Array, b: Float32Array) => { let d = 0; for (let k = 0; k < a.length; k++) d += a[k] * b[k]; return d; }; // 1 = identical

/** Strips the parts of a file name that aren't the design's name. */
const GENERIC = /^(img|image|photo|pic|dsc|pxl|screenshot|untitled( design)?|design|poster|mockup|copy of|نسخة من|صورة|تصميم)\b/i;
function cleanName(raw: string) {
  let s = raw.replace(/\.[a-z0-9]+$/i, "");
  s = s.replace(/^(copy of|نسخة من)\s+/i, "")
    .replace(/\b\d{3,5}\s*[x×]\s*\d{3,5}\b/gi, " ")           // 1080x1350
    .replace(/\b(19|20)\d{2}[-_.]?\d{2}[-_.]?\d{2}\b/g, " ")    // dates
    .replace(/[\s_\-.]*(\(\d+\)|copy|نسخة|final|v\d+)\s*$/gi, " ");
  s = tidy(s).replace(/[\s_\-.]+\d{1,3}$/, "").trim();         // trailing numbering
  return s;
}
const isGeneric = (s: string) => !s || /^[\d\s()_\-.]+$/.test(s) || (GENERIC.test(s) && s.replace(GENERIC, "").replace(/[\s\d_\-.()]+/g, "").length === 0);
function commonName(a: string, b: string) {
  if (a.toLowerCase() === b.toLowerCase()) return a;
  let i = 0; while (i < a.length && i < b.length && a[i].toLowerCase() === b[i].toLowerCase()) i++;
  const pre = a.slice(0, i).replace(/[\s_\-.(]+$/, "").trim();
  return pre.length >= 3 ? pre : !isGeneric(a) ? a : b;
}

const BLACK = /(^|[\s_\-.()[\]])(black|blk|b|اسود|أسود|الاسود|الأسود|اسوود)(?=$|[\s_\-.()[\]])/i;
const WHITE = /(^|[\s_\-.()[\]])(white|wht|w|ابيض|أبيض|الابيض|الأبيض)(?=$|[\s_\-.()[\]])/i;
const FRAME_WORDS = /(^|[\s_\-.()[\]])(frame|framed|إطار|اطار|برواز|mockup|mock-up)(?=$|[\s_\-.()[\]])/gi;

function colourOf(text: string): Frame | undefined {
  const b = BLACK.test(text), w = WHITE.test(text);
  if (b && !w) return "black";
  if (w && !b) return "white";
  return undefined;
}

const tidy = (s: string) => s
  .replace(BLACK, " ").replace(WHITE, " ").replace(FRAME_WORDS, " ")
  .replace(/[_]+/g, " ").replace(/\s*-\s*$/, "").replace(/^\s*-\s*/, "").replace(/\s+/g, " ").trim();

/** Works out the poster name and frame colour from the file's path inside the chosen folder. */
function readFile(f: File): { name: string; frame?: Frame } {
  const parts = ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name).split("/").filter(Boolean);
  const file = parts.pop()!.replace(/\.[a-z0-9]+$/i, "");
  const folders = parts.slice(1); // first part is the folder that was picked
  // colour from the file name, else from a folder ("Black/Ferrari.jpg" or "Ferrari/black.jpg")
  let frame = colourOf(file);
  let name = tidy(file);
  if (!frame) {
    for (let i = folders.length - 1; i >= 0 && !frame; i--) frame = colourOf(folders[i]);
  }
  // "Ferrari/black.jpg": the file name was only the colour, so the poster name is the folder
  if (!name && folders.length) name = tidy(folders[folders.length - 1]);
  return { name: name || file, frame };
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const hasArabic = (s: string) => /[؀-ۿ]/.test(s);
export function BulkImport({ onClose }: { onClose: () => void }) {
  const { db, saveProduct, toast } = useStore();
  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState<Category | "auto">("auto");
  const [stock, setStock] = useState(10);
  const [casePrice, setCasePrice] = useState(280);
  const [running, setRunning] = useState(false);
  const [reading, setReading] = useState(false);
  const [readStep, setReadStep] = useState("");
  const [step, setStep] = useState("");
  const stop = useRef(false);

  const existing = useMemo(() => new Set(db.products.map((p) => `${p.category}:${p.name.trim().toLowerCase()}`)), [db.products]);
  const isDup = (r: Row) => !!r.name && !!r.category && existing.has(`${r.category}:${r.name.trim().toLowerCase()}`);

  /* ----- posters: pair black + white of each design ----- */
  const posterRows = async (images: File[]): Promise<Row[]> => {
    const map = new Map<string, Row>();
    const loose: File[] = [];
    const named = new Map<string, { name: string; black?: File; white?: File }>();
    images.forEach((f) => {
      const { name, frame } = readFile(f);
      if (!frame) { loose.push(f); return; }
      const key = cleanName(name).toLowerCase() || name.toLowerCase();
      const g = named.get(key) ?? { name: cleanName(name) || name };
      if (g[frame]) loose.push(g[frame]!);
      g[frame] = f; named.set(key, g);
    });
    named.forEach((g, key) => {
      if (g.black && g.white) map.set(key, { key: "p:" + key, name: g.name, category: "posters", black: g.black, white: g.white, status: "ready" });
      else loose.push((g.black || g.white)!);
    });
    const looks: { f: File; l: Look }[] = [];
    const out: Row[] = [];
    for (let k = 0; k < loose.length; k++) {
      setReadStep(`Comparing poster images ${k + 1} of ${loose.length}…`);
      const l = await look(loose[k]);
      if (l) looks.push({ f: loose[k], l }); else out.push({ key: "pu:" + k, name: loose[k].name, category: "posters", status: "skipped", note: `This image couldn't be opened (${loose[k].name})` });
    }
    const pairs: { a: number; b: number; s: number }[] = [];
    for (let a = 0; a < looks.length; a++) for (let b = a + 1; b < looks.length; b++) pairs.push({ a, b, s: likeness(looks[a].l.art, looks[b].l.art) });
    pairs.sort((x, y) => y.s - x.s);
    const used = new Set<number>();
    for (const pr of pairs) {
      if (used.has(pr.a) || used.has(pr.b) || pr.s < 0.55) continue;
      used.add(pr.a); used.add(pr.b);
      const A = looks[pr.a], B = looks[pr.b];
      const bf = blackFirst(A.l, B.l);
      const [black, white] = bf.aIsBlack ? [A, B] : [B, A];
      let name = commonName(cleanName(readFile(white.f).name || white.f.name), cleanName(readFile(black.f).name || black.f.name));
      const folderOf = (f: File) => { const p = relPath(f); return p.length > 2 ? p[p.length - 2] : ""; };
      if (isGeneric(name) && folderOf(black.f) && folderOf(black.f) === folderOf(white.f) && !categoryFrom(folderOf(black.f))) name = cleanName(folderOf(black.f));
      const unnamed = isGeneric(name);
      if (unnamed) name = "";
      const key = "p:" + (name || `design-${pr.a}-${pr.b}`).toLowerCase() + (map.has("p:" + name.toLowerCase()) ? "-" + pr.a : "");
      map.set(key, {
        key, name, category: "posters", black: black.f, white: white.f, status: "ready", auto: true,
        note: [unnamed && "Type the poster name", !bf.sure && "Check black / white (tap Swap if wrong)", pr.s < 0.75 && "Check these two are the same design"].filter(Boolean).join(" · ") || undefined,
      });
    }
    looks.forEach((x, k) => { if (!used.has(k)) out.push({ key: "px:" + k, name: cleanName(x.f.name) || x.f.name, category: "posters", white: x.f, status: "skipped", note: `No matching second image found for ${x.f.name}` }); });
    return [...map.values(), ...out];
  };

  /* ----- other categories: one image = one product, or one folder per product, or "Name 1/2/3" ----- */
  const productRows = (images: File[], cat: Category | "", depth: number): Row[] => {
    const groups = new Map<string, { name: string; files: File[] }>();
    images.forEach((f) => {
      const parts = relPath(f);
      // folders below the picked folder (and below the category folder, when there is one)
      const inner = depth >= parts.length ? [] : parts.slice(depth, -1);
      while (inner.length && categoryFrom(inner[0])) inner.shift(); // "Flags/…" inside a single-category import
      let name: string, key: string;
      if (inner.length) { name = cleanName(inner[inner.length - 1]); key = "dir:" + inner.join("/"); }
      else {
        name = cleanName(f.name.replace(/[\s_\-.]*(front|back|side|detail|closeup|close-up|امام|خلف)\b/gi, " "));
        key = "name:" + (name || f.name).toLowerCase();
      }
      const g = groups.get(key) ?? { name, files: [] };
      g.files.push(f); groups.set(key, g);
    });
    return [...groups.entries()].map(([key, g]) => {
      // front / main / cover photo first, then the rest in name order
      const rank = (f: File) => (/(front|main|cover|امام|أمام)/i.test(f.name) ? 0 : /(back|خلف)/i.test(f.name) ? 2 : 1);
      const files = g.files.sort((a, b) => rank(a) - rank(b) || natural(a.name, b.name)).slice(0, 6);
      const name = isGeneric(g.name) ? "" : g.name;
      return {
        key: `${cat || "x"}:${key}`, name, category: cat, images: files, status: "ready" as const,
        note: [!name && "Type the product name", !cat && "Pick the category", g.files.length > 6 && "Only the first 6 photos are used"].filter(Boolean).join(" · ") || undefined,
      };
    });
  };

  /* ----- products.csv / products.json in the folder ----- */
  const mappedRows = (mapping: Mapped[], images: File[]): Row[] => {
    const byName = new Map(images.map((f) => [f.name.toLowerCase(), f]));
    const find = (n?: string) => (n ? byName.get(n.toLowerCase()) ?? byName.get(n.toLowerCase().split("/").pop()!) : undefined);
    return mapping.map((m, i): Row => {
      const cat = (m.category ? categoryFrom(m.category) : mode === "auto" ? "" : mode) as Category | "";
      const base = { key: "m:" + i, name: m.name, nameAr: m.nameAr, description: m.description, stock: m.stock, price: m.price, prices: m.prices, category: cat };
      if (cat === "posters") {
        const black = find(m.black), white = find(m.white);
        const missing = [!black && (m.black ? `black image "${m.black}" not in the folder` : "no black_image"), !white && (m.white ? `white image "${m.white}" not in the folder` : "no white_image")].filter(Boolean);
        return { ...base, black, white, status: missing.length ? "skipped" : "ready", note: missing.join(" · ") || undefined };
      }
      const files = m.images.map(find).filter(Boolean) as File[];
      const lost = m.images.filter((n) => !find(n));
      return {
        ...base, images: files, status: !files.length || !cat ? "skipped" : "ready",
        note: [!cat && "Unknown category in the sheet", !files.length && "No photos found for this row", lost.length && files.length && `Not found: ${lost.join(", ")}`].filter(Boolean).join(" · ") || undefined,
      };
    });
  };

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setReading(true); setRows([]);
    try {
      const all = [...files];
      const images = all.filter(isImage);
      const sheet = all.find((f) => /\.(csv|json)$/i.test(f.name));
      if (sheet) {
        const text = await sheet.text();
        let records: Record<string, unknown>[] = [];
        try { records = sheet.name.toLowerCase().endsWith(".json") ? (JSON.parse(text).products ?? JSON.parse(text)) : parseCSV(text); }
        catch { toast(`${sheet.name} couldn't be read. Check it's a valid ${sheet.name.split(".").pop()!.toUpperCase()} file.`); }
        const mapping = readMapping(records);
        if (mapping.length) {
          const out = mappedRows(mapping, images).map((r) => (isDup(r) ? { ...r, status: "skipped" as const, note: "Already in the store" } : r));
          setRows(out);
          toast(`${sheet.name}: ${out.filter((r) => r.status === "ready").length} of ${out.length} products ready`);
          return;
        }
      }
      // which category each image belongs to
      const byCat = new Map<Category | "", { files: File[]; depth: number }>();
      images.forEach((f) => {
        const parts = relPath(f);
        let cat: Category | "" = mode === "auto" ? "" : mode;
        let depth = parts.length > 1 ? 1 : 0; // skip the picked folder's own name
        if (mode === "auto") {
          // a top-level folder named after a category decides it
          for (let i = depth; i < parts.length - 1; i++) { const c = categoryFrom(parts[i]); if (c) { cat = c; depth = i + 1; break; } }
          if (!cat && parts.length > 1) { const c = categoryFrom(parts[0]); if (c) cat = c; }
        }
        const g = byCat.get(cat) ?? { files: [], depth };
        g.files.push(f); g.depth = Math.min(g.depth, depth); byCat.set(cat, g);
      });
      let out: Row[] = [];
      for (const [cat, g] of byCat) {
        if (cat === "posters") out = out.concat(await posterRows(g.files));
        // no category: ignore unknown folders and treat every image as its own product
        else out = out.concat(cat ? productRows(g.files, cat, g.depth) : productRows(g.files, cat, 99));
      }
      out = out.map((r) => (isDup(r) ? { ...r, status: "skipped" as const, note: "Already in the store" } : r))
        .sort((a, b) => (a.category || "~").localeCompare(b.category || "~") || natural(a.name || "~", b.name || "~"));
      setRows(out);
      const per = CATS.map((c) => [c, out.filter((r) => r.category === c && r.status === "ready").length] as const).filter(([, n]) => n);
      toast(per.length ? per.map(([c, n]) => `${n} ${CATEGORY_LABEL[c].en}`).join(" · ") + " ready" : "No products found. Check the folder and category.");
    } finally { setReading(false); setReadStep(""); }
  };

  const ready = rows.filter((r) => (r.status === "ready" || r.status === "failed"));
  const set = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  /** Sizes and prices for a product of this category (sheet values win when given). */
  const variantsFor = (r: Row): Variant[] => {
    const cat = r.category as Category;
    if (cat === "cases") {
      const base = r.price ?? casePrice;
      return phoneModels.map((m) => ({ id: m.id, label: m.label, price: base + (m.priceDelta ?? 0) }));
    }
    const sizes = presetVariants(cat);
    if (r.prices?.length) return sizes.map((s, i) => ({ ...s, price: r.prices![i] || s.price }));
    if (r.price && sizes.length === 1) return [{ ...sizes[0], price: r.price }];
    return sizes;
  };

  const run = async () => {
    setRunning(true); stop.current = false;
    const used = new Set(db.products.map((p) => p.slug));
    let saved = 0;
    for (const r of rows) {
      if (stop.current) break;
      if (r.status !== "ready" && r.status !== "failed") continue;
      if (!r.name.trim()) { set(r.key, { status: "failed", note: "Type the product name, then tap Retry" }); continue; }
      if (!r.category) { set(r.key, { status: "failed", note: "Pick the category, then tap Retry" }); continue; }
      if (isDup(r)) { set(r.key, { status: "skipped", note: "Already in the store" }); continue; }
      const cat = r.category;
      set(r.key, { status: "saving", note: "Preparing photos…" });
      try {
        let images: string[] = [], frameImages: Product["frameImages"];
        if (cat === "posters") {
          if (!r.black || !r.white) throw new Error("A poster needs both the black and the white frame image");
          const [black, white] = await Promise.all([compressImage(r.black, 1400, 0.85), compressImage(r.white, 1400, 0.85)]);
          frameImages = { black, white };
        } else {
          if (!r.images?.length) throw new Error("No photos");
          for (const f of r.images) images.push(await compressImage(f, 1400, 0.85));
        }
        let slug = slugify(r.name) || cat;
        if (used.has(slug)) slug = `${slug}-${uid().slice(0, 4)}`;
        used.add(slug);
        const variants = variantsFor(r);
        const p: Product = {
          id: uid(), slug, name: r.name.trim(), nameAr: r.nameAr ?? (hasArabic(r.name) ? r.name : ""), category: cat,
          price: fromPrice(variants, r.price ?? 0), compareAt: undefined, stock: r.stock ?? stock, active: true, featured: false,
          description: r.description ?? "", details: DETAILS[cat], variants, variantLabel: cat === "cases" ? "Phone model" : "Size",
          images, frameImages, art: "abstract", palette: ["#A67B5B", "#E8E1D6", "#1A1A1A"], createdAt: new Date().toISOString(),
        };
        await saveProduct(p, (m) => set(r.key, { note: m }));
        set(r.key, { status: "saved", note: undefined });
        saved++;
      } catch (e) {
        set(r.key, { status: "failed", note: (e as Error).message });
      }
      setStep(`${saved} saved`);
    }
    setRunning(false);
    toast(stop.current ? `Stopped. ${saved} product${saved === 1 ? "" : "s"} saved.` : `${saved} product${saved === 1 ? "" : "s"} added to the store`);
  };

  const counts = {
    ready: rows.filter((r) => r.status === "ready").length,
    saved: rows.filter((r) => r.status === "saved").length,
    skipped: rows.filter((r) => r.status === "skipped").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };
  const shownCats = mode === "auto" ? CATS : [mode];

  const downloadTemplate = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + TEMPLATE], { type: "text/csv;charset=utf-8" }));
    a.download = "products.csv"; a.click();
  };

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[60] bg-fahmy/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !running && onClose()} />
      <motion.aside role="dialog" aria-label="Bulk import products"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 34, stiffness: 320 }}
        className="fixed right-0 top-0 bottom-0 z-[61] w-full max-w-[800px] bg-sand flex flex-col"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="px-5 md:px-7 h-16 flex items-center justify-between border-b border-ramady/50 shrink-0">
          <h2 className="display text-xl">Bulk import products</h2>
          <button onClick={onClose} disabled={running} className="w-10 h-10 grid place-items-center rounded-full hover:bg-ramly" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 md:px-7 py-6 space-y-6">
          <section className="rounded-2xl bg-paper border border-ramady/50 p-5">
            <p className="font-semibold">1. Category</p>
            <div className="flex flex-wrap gap-2 mt-3" role="radiogroup" aria-label="Category">
              {(["auto", ...CATS] as const).map((c) => (
                <button key={c} type="button" role="radio" aria-checked={mode === c} disabled={running || reading}
                  onClick={() => { setMode(c); setRows([]); }}
                  className={cx("h-9 px-3.5 rounded-full text-sm border", mode === c ? "bg-fahmy text-sand border-fahmy" : "border-ramady hover:border-fahmy")}>
                  {c === "auto" ? "All categories (by folder)" : CATEGORY_LABEL[c].en}
                </button>
              ))}
            </div>
            <p className="text-xs text-stone mt-3">
              {mode === "auto"
                ? "Put each category in its own folder: Posters, Flags (أعلام), Laptop Sleeves, Phone Cases, Sunshades. Anything else you can assign below."
                : mode === "posters"
                  ? "Each poster needs a black-frame and a white-frame image. They're paired by name (black/white, أسود/أبيض, _B/_W) or by matching the artwork."
                  : "One image = one product, or one folder per product with its photos (front, back…). Files like “Name 1.jpg”, “Name 2.jpg” become one product."}
            </p>
          </section>

          <section className="rounded-2xl bg-paper border border-ramady/50 p-5">
            <p className="font-semibold">2. Choose the images</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <label className={cx("btn-dark h-11 px-4 cursor-pointer", (running || reading) && "opacity-50 pointer-events-none")}>
                <FolderUp size={16} />{reading ? "Reading…" : "Choose folder"}
                {/* @ts-expect-error webkitdirectory is supported by every current browser */}
                <input type="file" webkitdirectory="" directory="" multiple className="sr-only" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
              </label>
              <label className={cx("btn-line h-11 px-4 cursor-pointer", (running || reading) && "opacity-50 pointer-events-none")}>
                Or select files
                <input type="file" accept="image/*,.csv,.json" multiple className="sr-only" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
              </label>
            </div>
            <p className="text-xs text-stone mt-3">
              Want exact names, Arabic names, stock or prices per product? Put a <b>products.csv</b> (or .json) in the folder.{" "}
              <button type="button" onClick={downloadTemplate} className="underline inline-flex items-center gap-1"><Download size={12} />Download the template</button>
            </p>
          </section>

          <section className="rounded-2xl bg-paper border border-ramady/50 p-5">
            <p className="font-semibold">3. Prices and stock</p>
            <ul className="text-sm mt-2 space-y-1.5">
              {shownCats.map((c) => (
                <li key={c}>
                  <span className="font-medium">{CATEGORY_LABEL[c].en}:</span>{" "}
                  {c === "cases"
                    ? <span className="inline-flex items-center gap-2">from <input type="number" min={0} className="field h-8 w-24 tnum inline-block" value={casePrice} disabled={running} onChange={(e) => setCasePrice(Math.max(0, Number(e.target.value) || 0))} /> EGP per phone model <span className="text-stone">({phoneModels.length} models)</span></span>
                    : <span className="text-stone tnum">{presetVariants(c).map((s) => `${s.label} ${egp(s.price)}`).join(" · ")}</span>}
                </li>
              ))}
            </ul>
            <label className="flex items-center gap-3 mt-4 text-sm">
              Stock for each product
              <input type="number" min={0} className="field h-10 w-24 tnum" value={stock} disabled={running} onChange={(e) => setStock(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
            </label>
            <p className="text-xs text-stone mt-2">Values in products.csv override these for that product.</p>
          </section>

          {rows.length > 0 && (
            <section>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <p className="font-semibold">4. Check the list</p>
                <p className="text-sm text-stone tnum">{counts.ready + counts.failed} to add · {counts.saved} saved · {counts.skipped} skipped</p>
              </div>
              <ul className="rounded-2xl bg-paper border border-ramady/50 divide-y divide-ramady/50">
                {rows.map((r) => (
                  <li key={r.key} className="p-3 flex items-center gap-3" data-black={r.black?.name} data-white={r.white?.name} data-images={r.images?.map((f) => f.name).join("|")}>
                    {r.category === "posters"
                      ? <><Thumb file={r.black} label="Black" /><Thumb file={r.white} label="White" /></>
                      : <div className="flex -space-x-8 shrink-0">{(r.images ?? []).slice(0, 3).map((f, k) => <Thumb key={k} file={f} label="Photo" />)}</div>}
                    <div className="flex-1 min-w-0">
                      <input className={cx("w-full bg-transparent font-medium border-b hover:border-ramady focus:border-fahmy outline-none py-0.5", r.name ? "border-transparent" : "border-topy-dark")}
                        value={r.name} placeholder="Type the product name" disabled={running || r.status === "saved"} aria-label="Product name"
                        onChange={(e) => set(r.key, { name: e.target.value })} dir="auto"
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          const all = [...document.querySelectorAll<HTMLInputElement>("[data-bulk-name]")];
                          const next = all.slice(all.indexOf(e.currentTarget) + 1).find((x) => !x.value) ?? all[all.indexOf(e.currentTarget) + 1];
                          next?.focus();
                        }} data-bulk-name="" />
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                        {r.category === "posters" || r.status === "saved" ? (
                          <span className="text-[11px] rounded-full bg-ramly px-2 py-0.5">{r.category ? CATEGORY_LABEL[r.category].en : ""}</span>
                        ) : (
                          <select aria-label="Category" value={r.category} disabled={running}
                            onChange={(e) => set(r.key, { category: e.target.value as Category, status: r.status === "skipped" && r.note?.startsWith("Pick") ? "ready" : r.status, note: r.note?.replace(/Pick the category( · )?/, "") || undefined })}
                            className={cx("text-[11px] rounded-full px-2 py-0.5 bg-ramly border", r.category ? "border-transparent" : "border-topy-dark")}>
                            <option value="">Pick category…</option>
                            {CATS.filter((c) => c !== "posters").map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c].en}</option>)}
                          </select>
                        )}
                        {r.category !== "posters" && (r.images?.length ?? 0) > 1 && <span className="text-[11px] text-stone">{r.images!.length} photos</span>}
                        {r.stock != null && <span className="text-[11px] text-stone">stock {r.stock}</span>}
                        {r.note && <span className={cx("text-xs", r.status === "failed" || r.status === "skipped" ? "text-topy-dark" : "text-stone")}>{r.note}</span>}
                      </div>
                    </div>
                    {r.category === "posters" && r.auto && r.status === "ready" && !running && (
                      <button type="button" className="text-xs underline text-stone hover:text-fahmy shrink-0" onClick={() => set(r.key, { black: r.white, white: r.black, note: "Swapped" })}>Swap</button>
                    )}
                    <span className="shrink-0 w-7 grid place-items-center">
                      {r.status === "saving" && <Loader2 size={17} className="animate-spin text-stone" />}
                      {r.status === "saved" && <Check size={17} className="text-zeyti-dark" />}
                      {(r.status === "failed" || r.status === "skipped") && <AlertTriangle size={16} className="text-topy-dark" />}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="px-5 md:px-7 py-4 border-t border-ramady/50 flex flex-wrap gap-3 items-center shrink-0">
          {reading ? <p className="text-sm text-stone">{readStep || "Reading images…"}</p> : running ? <p className="text-sm text-stone">Saving… {step}. Keep this screen open.</p> : <p className="text-sm text-stone">{ready.length ? `${ready.length} product${ready.length === 1 ? "" : "s"} ready` : counts.saved ? `Done: ${counts.saved} product${counts.saved === 1 ? "" : "s"} added to the store` : "Choose a folder to start"}</p>}
          <div className="ml-auto flex gap-2">
            {running
              ? <button className="btn-line" onClick={() => { stop.current = true; }}>Stop after this one</button>
              : <button className="btn-line" onClick={onClose}>Close</button>}
            <button className="btn-dark" disabled={running || reading || !ready.length} onClick={run}>
              {running ? "Importing…" : counts.failed ? `Retry ${ready.length}` : `Import ${ready.length || ""} products`}
            </button>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

function Thumb({ file, label }: { file?: File; label: string }) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  return (
    <div className={cx("w-16 aspect-[4/5] rounded-md overflow-hidden shrink-0 grid place-items-center text-[10px] ring-2 ring-paper", file ? "bg-ramly" : "border border-dashed border-topy-dark text-topy-dark")} title={label}>
      {file ? <img src={url} alt={label === "Photo" ? file.name : `${label} frame`} className="w-full h-full object-cover" /> : `No ${label.toLowerCase()}`}
    </div>
  );
}
