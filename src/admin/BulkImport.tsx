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

type Row = { key: string; name: string; black?: File; white?: File; status: "ready" | "saving" | "saved" | "failed" | "skipped"; note?: string };

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

  const pick = (files: FileList | null) => {
    if (!files?.length) return;
    const map = new Map<string, Row>();
    const loose: string[] = [];
    [...files].filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(f.name)).forEach((f) => {
      const { name, frame } = readFile(f);
      if (!frame) { loose.push(f.name); return; } // can't tell which frame it is
      const key = name.toLowerCase();
      const row = map.get(key) ?? { key, name, status: "ready" as const };
      if (row[frame]) row.note = `Two ${frame} images found; using ${f.name}`;
      row[frame] = f;
      map.set(key, row);
    });
    const list = [...map.values()].map((r): Row => {
      if (existing.has(r.key)) return { ...r, status: "skipped", note: "Already in the store" };
      if (!r.black || !r.white) return { ...r, status: "skipped", note: `Missing the ${!r.black ? "black" : "white"} frame image` };
      return r;
    }).sort((a, b) => a.name.localeCompare(b.name));
    setRows(list);
    if (loose.length) toast(`${loose.length} file${loose.length > 1 ? "s" : ""} didn't say black or white and ${loose.length > 1 ? "were" : "was"} left out`);
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
                <FolderUp size={16} />Choose folder
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
                  <li key={r.key} className="p-3 flex items-center gap-3">
                    <Thumb file={r.black} label="Black" />
                    <Thumb file={r.white} label="White" />
                    <div className="flex-1 min-w-0">
                      <input className="w-full bg-transparent font-medium border-b border-transparent hover:border-ramady focus:border-fahmy outline-none py-0.5"
                        value={r.name} disabled={running || r.status === "saved"} aria-label="Poster name"
                        onChange={(e) => set(r.key, { name: e.target.value })} dir="auto" />
                      {r.note && <p className={cx("text-xs mt-0.5", r.status === "failed" || r.status === "skipped" ? "text-topy-dark" : "text-stone")}>{r.note}</p>}
                    </div>
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
          {running ? <p className="text-sm text-stone">Saving… {step}. Keep this screen open.</p> : <p className="text-sm text-stone">{ready.length ? `${ready.length} poster${ready.length === 1 ? "" : "s"} ready` : counts.saved ? `Done: ${counts.saved} poster${counts.saved === 1 ? "" : "s"} added to the store` : "Choose a folder to start"}</p>}
          <div className="ml-auto flex gap-2">
            {running
              ? <button className="btn-line" onClick={() => { stop.current = true; }}>Stop after this one</button>
              : <button className="btn-line" onClick={onClose}>Close</button>}
            <button className="btn-dark" disabled={running || !ready.length} onClick={run}>
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
    <div className={cx("w-12 aspect-[4/5] rounded-md overflow-hidden shrink-0 grid place-items-center text-[10px]", file ? "bg-ramly" : "border border-dashed border-topy-dark text-topy-dark")} title={`${label} frame`}>
      {file ? <img src={url} alt={`${label} frame`} className="w-full h-full object-cover" /> : `No ${label.toLowerCase()}`}
    </div>
  );
}
