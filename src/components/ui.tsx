import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import type { Frame, Product } from "../lib/types";
import { CATEGORY_LABEL, cx, egp } from "../lib/utils";
import { useStore } from "../lib/store";
import { img } from "../lib/assets";
import { hasPriceRange } from "../lib/pricing";

/** The أثر calligraphy mark from the brand guidelines, tinted with currentColor. */
export function Mark({ className = "", label = "أثر" }: { className?: string; label?: string }) {
  return <span role="img" aria-label={label} className={cx("mark", className)} style={{ ["--mark" as string]: `url(${img("asset:brand/logo-ar")})` }} />;
}
/** "ATHAR" wordmark from the official logo. */
export function Wordmark({ className = "" }: { className?: string }) {
  return <span role="img" aria-label="ATHAR" className={cx("mark wordmark", className)} style={{ ["--mark" as string]: `url(${img("asset:brand/wordmark")})` }} />;
}
/** Full logo: أثر mark, ATHAR and "More than just products". */
export function Lockup({ className = "" }: { className?: string }) {
  return <span role="img" aria-label="ATHAR أثر, More than just products" className={cx("mark lockup", className)} style={{ ["--mark" as string]: `url(${img("asset:brand/lockup")})` }} />;
}
export function TaglineMark({ className = "" }: { className?: string }) {
  return <span role="img" aria-label="More than just products" className={cx("mark tagline-mark", className)} style={{ ["--mark" as string]: `url(${img("asset:brand/tagline")})` }} />;
}
export function IconMark({ className = "" }: { className?: string }) {
  return <span aria-hidden className={cx("mark icon-mark", className)} style={{ ["--icon" as string]: `url(${img("asset:brand/icon")})` }} />;
}

export function Logo({ light = false, className = "" }: { light?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-3 select-none", light ? "text-sand" : "text-fahmy", className)}>
      <Mark className="h-9 md:h-10 shrink-0" label="ATHAR أثر" />
      <Wordmark className="h-[11px] md:h-[12px] hidden sm:inline-block translate-y-[3px]" />
    </span>
  );
}

/**
 * Neutral stand-in for a photo. Text scales with the card (container units),
 * so it reads on a large hero card and stays tidy on a small thumbnail.
 */
export function ImagePlaceholder({ title, label, tone = "sand", className = "" }: { title?: string; label?: string; tone?: "sand" | "dark"; className?: string }) {
  return (
    <div
      className={cx("relative w-full h-full overflow-hidden flex flex-col items-center justify-center text-center", tone === "dark" ? "bg-[#242322] text-sand/80" : "bg-ramly text-fahmy/75", className)}
      style={{ containerType: "inline-size" }}
      role="img"
      aria-label={title ? `${title}, photo coming soon` : "Photo coming soon"}
    >
      <div aria-hidden className={cx("absolute inset-0 lattice [background-size:22px_22px]", tone === "dark" ? "text-sand/[0.05]" : "text-fahmy/[0.05]")} />
      <IconMark className={cx("relative w-[16cqw] min-w-[14px] max-w-[64px]", tone === "dark" ? "text-sand/25" : "text-fahmy/20")} />
      {label && <p className="relative mt-[5cqw] uppercase tracking-[0.18em] text-[clamp(7px,3.6cqw,13px)] opacity-60">{label}</p>}
      {title && <p className="relative mt-[2cqw] px-[8cqw] display leading-[0.92] text-[clamp(8px,9cqw,44px)] text-balance">{title}</p>}
    </div>
  );
}

export function ProductImage({ p, i = 0, className = "" }: { p: Product; i?: number; className?: string; text?: string }) {
  const src = p.images[i];
  return src ? (
    <img src={img(src)} alt={p.name} className={cx("w-full h-full", className.includes("object-contain") ? "" : "object-cover", className)} loading="lazy" />
  ) : (
    <ImagePlaceholder title={p.name} label={CATEGORY_LABEL[p.category]?.en} className={className.replace("object-contain", "")} />
  );
}

/** Poster proportions from a size label like "50×70 cm" (shown portrait). */
export function posterRatio(label?: string) {
  const m = /(\d+(?:\.\d+)?)\s*[×x*]\s*(\d+(?:\.\d+)?)/i.exec(label || "");
  if (!m) return 4 / 5;
  const a = Number(m[1]), b = Number(m[2]);
  return Math.min(a, b) / Math.max(a, b);
}

const FRAME_STYLE: Record<Frame | "none", React.CSSProperties> = {
  // moulding colour, a soft bevel inside, and the shadow the frame casts on the wall
  black: { backgroundColor: "#151515", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08), inset 0 2px 3px rgba(255,255,255,.10), 0 18px 40px -14px rgba(0,0,0,.55), 0 4px 10px -4px rgba(0,0,0,.35)" },
  white: { backgroundColor: "#F8F6F1", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08), inset 0 -2px 3px rgba(0,0,0,.06), 0 18px 40px -16px rgba(0,0,0,.35), 0 4px 10px -4px rgba(0,0,0,.18)" },
  none: { backgroundColor: "rgba(0,0,0,0)", boxShadow: "0 14px 34px -18px rgba(0,0,0,.35)" },
};

/**
 * Poster on a wall inside a black or white frame. Uses the admin's real framed photo for that colour
 * when there is one; otherwise frames the design itself. Switching colours cross-fades.
 */
export function FramedPreview({ p, i = 0, frame, sizeLabel, className = "" }: { p: Product; i?: number; frame?: Frame; sizeLabel?: string; className?: string }) {
  const photo = frame ? p.frameImages?.[frame] : undefined;
  const ratio = posterRatio(sizeLabel);
  const fw = `min(74cqw, calc(80cqh * ${ratio}))`; // frame width that fits the box both ways
  return (
    <div className={cx("relative w-full h-full overflow-hidden", className)} style={{ containerType: "size", background: "radial-gradient(120% 90% at 50% 20%, #EFE9DF 0%, #E2DACD 70%, #D9D0C2 100%)" }}>
      <AnimatePresence initial={false}>
        {photo ? (
          <motion.img key={"photo-" + frame} src={img(photo)} alt={`${p.name}, ${frame} frame`} className="absolute inset-0 w-full h-full object-cover"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }} />
        ) : (
          <motion.div key="mockup" className="absolute inset-0 grid place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
            <div
              role="img" aria-label={`${p.name}${frame ? `, ${frame} frame` : ""}`}
              className="transition-[background-color,box-shadow,padding] duration-500 ease-out"
              style={{ width: fw, aspectRatio: String(ratio), padding: frame ? `calc(${fw} * 0.045)` : "0px", ...FRAME_STYLE[frame ?? "none"] }}
            >
              {/* mat board, then the print */}
              <div className="w-full h-full bg-[#FBFAF6] transition-[padding] duration-500" style={{ padding: frame ? `calc(${fw} * 0.07)` : "0px", boxShadow: frame ? "inset 0 1px 4px rgba(0,0,0,.18)" : "none" }}>
                <div className="w-full h-full overflow-hidden"><ProductImage p={p} i={i} /></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ProductCard({ p, dark = false, size = "md" }: { p: Product; dark?: boolean; size?: "md" | "lg" }) {
  const { addToCart, setCartOpen, toast } = useStore();
  const soldOut = p.stock <= 0;
  const quickAdd = !p.customText && p.variants.length === 0;
  return (
    <div className="group relative">
      <Link to={`/p/${p.slug}`} className="block">
        <div className={cx("relative overflow-hidden rounded-lg", p.category === "flags" ? "aspect-[4/3]" : "aspect-[4/5]", dark ? "bg-fahmy" : "bg-ramly")}>
          <div className="absolute inset-0 transition-transform duration-[900ms] ease-[cubic-bezier(.2,.7,.2,1)] group-hover:scale-[1.04]">
            <ProductImage p={p} />
          </div>
          {soldOut && <span className="absolute left-3 top-3 rounded-full bg-fahmy text-sand text-xs px-3 py-1">Sold out</span>}
          {!soldOut && p.compareAt && <span className="absolute left-3 top-3 rounded-full bg-topy-dark text-white text-xs px-3 py-1">Sale</span>}
        </div>
        <div className={cx("mt-3 flex items-start justify-between gap-3", dark ? "text-sand" : "text-fahmy")}>
          <div className="min-w-0">
            <h3 className={cx("font-medium leading-snug", size === "lg" ? "text-lg" : "text-[15px]")}>{p.name}</h3>
            <p className={cx(" text-sm mt-0.5", dark ? "text-sand/50" : "text-stone")} lang="ar" dir="rtl">{p.nameAr}</p>
          </div>
          <div className="text-right shrink-0 tnum">
            <div className="text-[15px]">{hasPriceRange(p) && <span className={dark ? "text-sand/50" : "text-stone"}>from </span>}{egp(p.price)}</div>
            {p.compareAt && <div className={cx("text-xs line-through", dark ? "text-sand/40" : "text-stone")}>{egp(p.compareAt)}</div>}
          </div>
        </div>
      </Link>
      {quickAdd && !soldOut && (
        <button
          aria-label={`Add ${p.name} to bag`}
          onClick={() => { addToCart({ productId: p.id, qty: 1 }); toast(`${p.name} added to your bag`); setCartOpen(true); }}
          className="absolute right-3 top-3 grid place-items-center w-10 h-10 rounded-full bg-sand/90 text-fahmy backdrop-blur opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-topy hover:text-white"
        >
          <Plus size={18} />
        </button>
      )}
    </div>
  );
}

export function Accordion({ items, dark = false, defaultOpen = -1 }: { items: { q: string; a: React.ReactNode }[]; dark?: boolean; defaultOpen?: number }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cx("border-t", dark ? "border-sand/15" : "border-ramady/70")}>
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className={cx("border-b", dark ? "border-sand/15" : "border-ramady/70")}>
            <button
              className="w-full flex items-center justify-between gap-6 py-5 text-left"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              <span className="text-[17px] md:text-lg font-medium">{it.q}</span>
              <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.3 }} className={cx("grid place-items-center w-9 h-9 rounded-full shrink-0 border", dark ? "border-sand/25" : "border-ramady")}>
                <Plus size={16} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className={cx("pb-6 pr-14 text-[15px] leading-relaxed max-w-[62ch]", dark ? "text-sand/70" : "text-stone")}>{it.a}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export function Toast() {
  const { toastMsg } = useStore();
  return (
    <div className="fixed inset-x-0 z-[80] flex justify-center pointer-events-none" style={{ bottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}>
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            className="mx-4 rounded-full bg-fahmy text-sand px-5 py-3 text-sm shadow-[0_10px_30px_-10px_rgba(34,34,34,.5)]"
            role="status"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Free-delivery progress: how far the cart is from the threshold. */
export function FreeDeliveryBar({ subtotal, threshold, className = "" }: { subtotal: number; threshold: number; className?: string }) {
  const left = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, (subtotal / threshold) * 100);
  return (
    <div className={cx("text-sm", className)} role="status">
      <p>
        {left > 0
          ? <>Add <b className="tnum">{egp(left)}</b> more to get <b>free delivery</b> on orders from {egp(threshold)}.</>
          : <><b>Free delivery unlocked.</b> Your order ships free.</>}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-fahmy/10 overflow-hidden" aria-hidden>
        <div className={cx("h-full transition-all duration-500", left > 0 ? "bg-topy" : "bg-zeyti")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="text-xs text-stone">{label}</div>
        <div className="font-medium tnum select-all break-all">{value}</div>
      </div>
      <button type="button" onClick={copy} className="shrink-0 text-sm rounded-full border border-ramady px-3 h-8 hover:border-fahmy">
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
