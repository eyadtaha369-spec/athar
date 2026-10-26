import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import ProductArt from "./ProductArt";
import type { Product } from "../lib/types";
import { cx, egp } from "../lib/utils";
import { useStore } from "../lib/store";
import { img } from "../lib/assets";

/** The أثر calligraphy mark from the brand guidelines, tinted with currentColor. */
export function Mark({ className = "", label = "أثر" }: { className?: string; label?: string }) {
  return <span role="img" aria-label={label} className={cx("mark", className)} style={{ ["--mark" as string]: `url(${img("asset:brand/logo-ar")})` }} />;
}
export function IconMark({ className = "" }: { className?: string }) {
  return <span aria-hidden className={cx("mark icon-mark", className)} style={{ ["--icon" as string]: `url(${img("asset:brand/icon")})` }} />;
}

export function Logo({ light = false, className = "" }: { light?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-3 select-none", light ? "text-sand" : "text-fahmy", className)}>
      <Mark className="h-7 md:h-8" label="ATHAR أثر" />
      <span className="logotype text-[13px] leading-none hidden sm:inline">Athar</span>
    </span>
  );
}

export function ProductImage({ p, i = 0, className = "", text }: { p: Product; i?: number; className?: string; text?: string }) {
  const src = p.images[i];
  return src ? (
    <img src={img(src)} alt={p.name} className={cx("w-full h-full", className.includes("object-contain") ? "" : "object-cover", className)} loading="lazy" />
  ) : (
    <ProductArt kind={p.art} palette={p.palette} text={text} className={cx("w-full h-full", className)} />
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
          {!soldOut && p.compareAt && <span className="absolute left-3 top-3 rounded-full bg-topy text-white text-xs px-3 py-1">Sale</span>}
        </div>
        <div className={cx("mt-3 flex items-start justify-between gap-3", dark ? "text-sand" : "text-fahmy")}>
          <div className="min-w-0">
            <h3 className={cx("font-medium leading-snug", size === "lg" ? "text-lg" : "text-[15px]")}>{p.name}</h3>
            <p className={cx("font-ar text-sm mt-0.5", dark ? "text-sand/50" : "text-stone")} lang="ar" dir="rtl">{p.nameAr}</p>
          </div>
          <div className="text-right shrink-0 tnum">
            <div className="text-[15px]">{p.variants.length > 1 && <span className={dark ? "text-sand/50" : "text-stone"}>from </span>}{egp(p.price)}</div>
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
    <div className={cx("border-t", dark ? "border-sand/15" : "border-fahmy/15")}>
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className={cx("border-b", dark ? "border-sand/15" : "border-fahmy/15")}>
            <button
              className="w-full flex items-center justify-between gap-6 py-5 text-left"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              <span className="text-[17px] md:text-lg font-medium">{it.q}</span>
              <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.3 }} className={cx("grid place-items-center w-9 h-9 rounded-full shrink-0 border", dark ? "border-sand/25" : "border-fahmy/20")}>
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
      <button type="button" onClick={copy} className="shrink-0 text-sm rounded-full border border-fahmy/20 px-3 h-8 hover:border-fahmy">
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
