import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../lib/store";
import { ProductCard } from "../components/ui";
import { CATEGORY_LABEL, cx } from "../lib/utils";

const SORTS = { featured: "Featured", new: "Newest", low: "Price: low to high", high: "Price: high to low" } as const;

export default function Shop() {
  const { db } = useStore();
  const [sp, setSp] = useSearchParams();
  const cat = sp.get("c") || "all";
  const [sort, setSort] = useState<keyof typeof SORTS>("featured");
  const [q, setQ] = useState("");
  const [col, setCol] = useState("all");
  const collections = [...new Set(db.products.filter((p) => p.active && p.category === "flags" && p.collection).map((p) => p.collection!))];

  const list = useMemo(() => {
    let l = db.products.filter((p) => p.active && (cat === "all" || p.category === cat) && (cat !== "flags" || col === "all" || p.collection === col));
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      l = l.filter((p) => p.name.toLowerCase().includes(t) || p.nameAr.includes(q.trim()) || p.description.toLowerCase().includes(t));
    }
    const s = [...l];
    if (sort === "featured") s.sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.stock > 0) - Number(a.stock > 0));
    if (sort === "new") s.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === "low") s.sort((a, b) => a.price - b.price);
    if (sort === "high") s.sort((a, b) => b.price - a.price);
    return s;
  }, [db.products, cat, sort, q, col]);

  const heading = cat === "all" ? { en: "The collection", ar: "كل المنتجات" } : CATEGORY_LABEL[cat];

  return (
    <div className="pt-28 md:pt-36 pb-24">
      <div className="gutter max-w-[1500px] mx-auto">
        <p className=" text-topy-dark text-xl" lang="ar">{heading.ar}</p>
        <h1 className="display text-6xl md:text-9xl mt-1">{heading.en}</h1>
      </div>

      <div className="sticky z-30 mt-10 bg-sand/90 backdrop-blur-md border-y border-ramady/50" style={{ top: "calc(env(safe-area-inset-top, 0px) + 0px)" }}>
        <div className="gutter max-w-[1500px] mx-auto py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 max-w-full">
            {[["all", "All"], ...Object.entries(CATEGORY_LABEL).map(([k, v]) => [k, v.en])].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setSp(k === "all" ? {} : { c: k })}
                className={cx("shrink-0 h-10 px-4 rounded-full text-sm border transition-colors", cat === k ? "bg-fahmy text-sand border-fahmy" : "border-ramady hover:border-fahmy")}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <input id="shop-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="field h-10 sm:w-48" aria-label="Search products" />
            <select id="shop-sort" value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)} className="field h-10 w-auto pr-8" aria-label="Sort">
              {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="gutter max-w-[1500px] mx-auto mt-10">
        {cat === "flags" && collections.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {["all", ...collections].map((c) => (
              <button key={c} onClick={() => setCol(c)} className={cx("h-8 px-3 rounded text-[12px] uppercase tracking-wide border", col === c ? "bg-topy border-topy text-white" : "border-ramady hover:border-fahmy")}>
                {c === "all" ? "All flags" : c}
              </button>
            ))}
          </div>
        )}
        <p className="text-sm text-stone mb-6 tnum">{list.length} {list.length === 1 ? "piece" : "pieces"}</p>
        {list.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-xl font-medium">Nothing matches “{q}”</p>
            <p className="text-stone mt-1">Try a different word, or browse all categories.</p>
            <button className="btn-line mt-6" onClick={() => { setQ(""); setSp({}); }}>Show everything</button>
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 md:gap-x-6 gap-y-10">
            <AnimatePresence mode="popLayout">
              {list.map((p) => (
                <motion.div key={p.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.3 }}>
                  <ProductCard p={p} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
