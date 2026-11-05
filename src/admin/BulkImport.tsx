import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, FolderUp, Loader2, X } from "lucide-react";
import { useStore } from "../lib/store";
import { fromPrice, presetVariants } from "../lib/pricing";
import { compressImage, cx, egp, uid } from "../lib/utils";
import type { Frame, Product } from "../lib/types";

/**
 * Bulk poster import. Pick the unzipped folder (or select all the images) and it pairs every poster's
 * black-frame and white-frame image by name, then saves each poster with the standard poster sizes and prices.
 *
 * Works with any of these layouts:
 *   Ferrari - black.jpg / Ferrari - white.jpg      (colour word in the file name, English or Arabic)
 *   Ferrari_B.png / Ferrari_W.png                  (single letter B / W at the end)
 *   Ferrari/black.jpg / Ferrari/white.jpg          (one folder per poster)
 *   Black/Ferrari.jpg / White/Ferrari.jpg          (one folder per colour)
 */

type Row = { key: string; name: string; black?: File; white?: File; status: "ready" | "saving" | "saved" | "failed" | "skipped"; note?: string; auto?: boolean };

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
const POSTER_DETAILS = ["Printed on 250gsm matte art paper", "Fade-resistant pigment inks", "Comes framed in black or white, ready to hang", "Ships in a corner-protected box"];

export function BulkImport({ onClose }: { onClose: () => void }) {
  const { db, saveProduct, toast } = useStore();
  const [rows, setRows] = useState<Row[]>([]);
  const [stock, setStock] = useState(10);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState("");
  const stop = useRef(false);
  const sizes = presetVariants("posters");

  const existing = useMemo(() => new Set(db.products.filter((p) => p.category === "posters").map((p) => p.name.trim().toLowerCase())), [db.products]);

  const [reading, setReading] = useState(false);
  const [readStep, setReadStep] = useState("");

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setReading(true); setRows([]);
    const images = [...files].filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
    const map = new Map<string, Row>();
    const loose: File[] = [];

    // 1. names that say black / white (English or Arabic, or B / W)
    const named = new Map<string, { name: string; black?: File; white?: File }>();
    images.forEach((f) => {
      const { name, frame } = readFile(f);
      if (!frame) { loose.push(f); return; }
      const key = cleanName(name).toLowerCase() || name.toLowerCase();
      const g = named.get(key) ?? { name: cleanName(name) || name };
      if (g[frame]) loose.push(g[frame]!); // a second image of the same colour: let the picture matching place it
      g[frame] = f; named.set(key, g);
    });
    named.forEach((g, key) => {
      if (g.black && g.white) map.set(key, { key, name: g.name, black: g.black, white: g.white, status: "ready" });
      else loose.push((g.black || g.white)!); // its partner may have an unhelpful name: match by picture
    });

    // 2. everything else: match the two versions of each design by their artwork
    const looks: { f: File; l: Look }[] = [];
    const unreadable: File[] = [];
    for (let k = 0; k < loose.length; k++) {
      setReadStep(`Comparing images ${k + 1} of ${loose.length}…`);
      const l = await look(loose[k]);
      if (l) looks.push({ f: loose[k], l }); else unreadable.push(loose[k]);
    }
    const pairs: { a: number; b: number; s: number }[] = [];
    for (let a = 0; a < looks.length; a++) for (let b = a + 1; b < looks.length; b++) {
      pairs.push({ a, b, s: likeness(looks[a].l.art, looks[b].l.art) });
    }
    pairs.sort((x, y) => y.s - x.s);
    const used = new Set<number>();
    const unpaired: Row[] = [];
    for (const pr of pairs) {
      if (used.has(pr.a) || used.has(pr.b) || pr.s < 0.55) continue;
      used.add(pr.a); used.add(pr.b);
      const A = looks[pr.a], B = looks[pr.b];
      const bf = blackFirst(A.l, B.l);
      const [black, white] = bf.aIsBlack ? [A, B] : [B, A];
      const nb = cleanName(readFile(black.f).name || black.f.name), nw = cleanName(readFile(white.f).name || white.f.name);
      let name = commonName(nw, nb);
      // "Ferrari/IMG_2041.jpg" + "Ferrari/IMG_2042.jpg": the folder carries the name
      const folderOf = (f: File) => { const p = ((f as File & { webkitRelativePath?: string }).webkitRelativePath || "").split("/"); return p.length > 2 ? p[p.length - 2] : ""; };
      if (isGeneric(name) && folderOf(black.f) && folderOf(black.f) === folderOf(white.f)) name = cleanName(folderOf(black.f));
      const unnamed = isGeneric(name);
      if (unnamed) name = "";
      const key = (name || "design-" + pr.a + "-" + pr.b).toLowerCase();
      const unsureColour = !bf.sure;
      map.set(map.has(key) ? key + "-" + pr.a : key, {
        key: map.has(key) ? key + "-" + pr.a : key, name, black: black.f, white: white.f, status: "ready", auto: true,
        note: [unnamed && "Type the poster name", unsureColour && "Check black / white (tap Swap if wrong)", pr.s < 0.75 && "Check these two are the same design"].filter(Boolean).join(" · ") || undefined,
      });
    }
    looks.forEach((x, k) => {
      if (!used.has(k)) unpaired.push({ key: "x:" + k, name: cleanName(x.f.name) || x.f.name, white: x.f, status: "skipped", note: `No matching second image found for ${x.f.name}` });
    });
    unreadable.forEach((f, k) => unpaired.push({ key: "u:" + k, name: f.name, status: "skipped", note: `This image couldn't be opened (${f.name})` }));

    const list = [...map.values()].map((r): Row => {
      if (r.name && existing.has(r.name.trim().toLowerCase())) return { ...r, status: "skipped", note: "Already in the store" };
      return r;
    }).sort((a, b) => (a.name || "~").localeCompare(b.name || "~")).concat(unpaired);
    setRows(list);
    setReading(false); setReadStep("");
    const paired = list.filter((r) => r.black && r.white).length;
    toast(`${images.length} images → ${paired} poster${paired === 1 ? "" : "s"} paired${unpaired.length ? `, ${unpaired.length} left over` : ""}`);
  };

  const ready = rows.filter((r) => r.status === "ready" || r.status === "failed");
  const set = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const run = async () => {
    setRunning(true); stop.current = false;
    const used = new Set(db.products.map((p) => p.slug));
    let saved = 0;
    for (const r of rows) {
      if (stop.current) break;
      if (r.status !== "ready" && r.status !== "failed") continue;
      if (!r.name.trim()) { set(r.key, { status: "failed", note: "Type the poster name, then tap Retry" }); continue; }
      set(r.key, { status: "saving", note: "Preparing photos…" });
      try {
        const [black, white] = await Promise.all([compressImage(r.black!, 1400, 0.85), compressImage(r.white!, 1400, 0.85)]);
        let slug = slugify(r.name) || "poster";
        if (used.has(slug)) slug = `${slug}-${uid().slice(0, 4)}`;
        used.add(slug);
        const p: Product = {
          id: uid(), slug, name: r.name, nameAr: hasArabic(r.name) ? r.name : "", category: "posters",
          price: fromPrice(sizes, 0), compareAt: undefined, stock, active: true, featured: false,
          description: "", details: POSTER_DETAILS, variants: sizes, variantLabel: "Size",
          images: [], frameImages: { black, white }, art: "abstract", palette: ["#A67B5B", "#E8E1D6", "#1A1A1A"],
          createdAt: new Date().toISOString(),
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
    toast(stop.current ? `Stopped. ${saved} poster${saved === 1 ? "" : "s"} saved.` : `${saved} poster${saved === 1 ? "" : "s"} added to the store`);
  };

  const counts = {
    ready: rows.filter((r) => r.status === "ready").length,
    saved: rows.filter((r) => r.status === "saved").length,
    skipped: rows.filter((r) => r.status === "skipped").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[60] bg-fahmy/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !running && onClose()} />
      <motion.aside role="dialog" aria-label="Bulk import posters"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 34, stiffness: 320 }}
        className="fixed right-0 top-0 bottom-0 z-[61] w-full max-w-[760px] bg-sand flex flex-col"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="px-5 md:px-7 h-16 flex items-center justify-between border-b border-ramady/50 shrink-0">
          <h2 className="display text-xl">Bulk import posters</h2>
          <button onClick={onClose} disabled={running} className="w-10 h-10 grid place-items-center rounded-full hover:bg-ramly" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 md:px-7 py-6 space-y-6">
          <section className="rounded-2xl bg-paper border border-ramady/50 p-5">
            <p className="font-semibold">1. Choose your poster images</p>
            <p className="text-sm text-stone mt-1">Each poster needs a black-frame and a white-frame image. Name them like <b>Ferrari - black.jpg</b> and <b>Ferrari - white.jpg</b> (or Ferrari_B / Ferrari_W, أسود / أبيض), or use one folder per poster.</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <label className={cx("btn-dark h-11 px-4 cursor-pointer", running && "opacity-50 pointer-events-none")}>
                <FolderUp size={16} />{reading ? "Reading…" : "Choose folder"}
                {/* @ts-expect-error webkitdirectory is supported by every current browser */}
                <input type="file" webkitdirectory="" directory="" multiple className="sr-only" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
              </label>
              <label className={cx("btn-line h-11 px-4 cursor-pointer", running && "opacity-50 pointer-events-none")}>
                Or select images
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
              </label>
            </div>
          </section>

          <section className="rounded-2xl bg-paper border border-ramady/50 p-5">
            <p className="font-semibold">2. Prices and stock</p>
            <p className="text-sm text-stone mt-1">Every poster gets the standard poster sizes and prices:</p>
            <p className="text-sm mt-2 tnum">{sizes.map((s) => `${s.label} ${egp(s.price)}`).join(" · ")}</p>
            <label className="flex items-center gap-3 mt-4 text-sm">
              Stock for each poster
              <input type="number" min={0} className="field h-10 w-24 tnum" value={stock} disabled={running} onChange={(e) => setStock(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
            </label>
          </section>

          {rows.length > 0 && (
            <section>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <p className="font-semibold">3. Check the list</p>
                <p className="text-sm text-stone tnum">{counts.ready + counts.failed} to add · {counts.saved} saved · {counts.skipped} skipped</p>
              </div>
              <ul className="rounded-2xl bg-paper border border-ramady/50 divide-y divide-ramady/50">
                {rows.map((r) => (
                  <li key={r.key} className="p-3 flex items-center gap-3" data-black={r.black?.name} data-white={r.white?.name}>
                    <Thumb file={r.black} label="Black" />
                    <Thumb file={r.white} label="White" />
                    <div className="flex-1 min-w-0">
                      <input className={cx("w-full bg-transparent font-medium border-b hover:border-ramady focus:border-fahmy outline-none py-0.5", r.name ? "border-transparent" : "border-topy-dark")}
                        value={r.name} placeholder="Type the poster name" disabled={running || r.status === "saved"} aria-label="Poster name"
                        onChange={(e) => set(r.key, { name: e.target.value })} dir="auto"
                        onKeyDown={(e) => {
                          // Enter jumps to the next poster without a name, so naming a long list is quick
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          const all = [...document.querySelectorAll<HTMLInputElement>("[data-bulk-name]")];
                          const next = all.slice(all.indexOf(e.currentTarget) + 1).find((x) => !x.value) ?? all[all.indexOf(e.currentTarget) + 1];
                          next?.focus();
                        }} data-bulk-name="" />
                      {r.note && <p className={cx("text-xs mt-0.5", r.status === "failed" || r.status === "skipped" ? "text-topy-dark" : "text-stone")}>{r.note}</p>}
                    </div>
                    {r.auto && r.status === "ready" && !running && (
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
          {reading ? <p className="text-sm text-stone">{readStep || "Reading images…"}</p> : running ? <p className="text-sm text-stone">Saving… {step}. Keep this screen open.</p> : <p className="text-sm text-stone">{ready.length ? `${ready.length} poster${ready.length === 1 ? "" : "s"} ready` : counts.saved ? `Done: ${counts.saved} poster${counts.saved === 1 ? "" : "s"} added to the store` : "Choose a folder to start"}</p>}
          <div className="ml-auto flex gap-2">
            {running
              ? <button className="btn-line" onClick={() => { stop.current = true; }}>Stop after this one</button>
              : <button className="btn-line" onClick={onClose}>Close</button>}
            <button className="btn-dark" disabled={running || reading || !ready.length} onClick={run}>
              {running ? "Importing…" : counts.failed ? `Retry ${ready.length}` : `Import ${ready.length || ""} posters`}
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
    <div className={cx("w-16 aspect-[4/5] rounded-md overflow-hidden shrink-0 grid place-items-center text-[10px]", file ? "bg-ramly" : "border border-dashed border-topy-dark text-topy-dark")} title={`${label} frame`}>
      {file ? <img src={url} alt={`${label} frame`} className="w-full h-full object-cover" /> : `No ${label.toLowerCase()}`}
    </div>
  );
}
