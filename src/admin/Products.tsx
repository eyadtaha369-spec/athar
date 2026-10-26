import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Plus, Search, Trash2, X } from "lucide-react";
import { useStore } from "../lib/store";
import { img } from "../lib/assets";
import { Forbidden, PageHead, can } from "./AdminLayout";
import { ProductImage } from "../components/ui";
import { CATEGORY_LABEL, compressImage, cx, egp, uid } from "../lib/utils";
import type { ArtKind, Category, Product } from "../lib/types";

const ART_FOR: Record<Category, ArtKind> = { posters: "pyramids", sleeves: "sleeve", flags: "flag", cases: "case", sunshades: "sunshade", umbrellas: "umbrella" };
const PALETTES: [string, string, string][] = [
  ["#A85B3E", "#E3DAC9", "#222222"], ["#606859", "#E3DAC9", "#222222"], ["#222222", "#E3DAC9", "#A85B3E"], ["#E3DAC9", "#606859", "#A85B3E"],
];
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "product-" + uid();

const blank = (): Product => ({
  id: uid(), slug: "", name: "", nameAr: "", category: "posters", price: 0, stock: 0, active: true, featured: false,
  description: "", details: [], variants: [], variantLabel: "Size", images: [], art: "pyramids", palette: PALETTES[0], createdAt: new Date().toISOString(),
});

function Editor({ initial, onClose }: { initial: Product; onClose: () => void }) {
  const { saveProduct, deleteProduct, db, toast } = useStore();
  const isNew = !db.products.some((p) => p.id === initial.id);
  const [p, setP] = useState<Product>(initial);
  const [detailsText, setDetailsText] = useState(initial.details.join("\n"));
  const [err, setErr] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const up = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }));

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const imgs = await Promise.all([...files].slice(0, 6).map((f) => compressImage(f, 1200, 0.82)));
      setP((x) => ({ ...x, images: [...x.images, ...imgs].slice(0, 6) }));
    } catch (e) { setErr((x) => ({ ...x, images: (e as Error).message })); }
    setUploading(false);
  };

  const save = () => {
    const e: Record<string, string> = {};
    if (!p.name.trim()) e.name = "Give the product a name.";
    if (!(p.price > 0)) e.price = "Enter a price above 0.";
    if (p.stock < 0 || !Number.isFinite(p.stock)) e.stock = "Stock can't be negative.";
    const slug = p.slug.trim() || slugify(p.name);
    if (db.products.some((x) => x.slug === slug && x.id !== p.id)) e.slug = "Another product already uses this link.";
    if (p.variants.some((v) => !v.label.trim())) e.variants = "Every option needs a name, or remove the empty one.";
    setErr(e);
    if (Object.keys(e).length) return;
    saveProduct({ ...p, slug, name: p.name.trim(), details: detailsText.split("\n").map((s) => s.trim()).filter(Boolean) });
    toast(isNew ? `${p.name} added to the store` : `${p.name} saved`);
    onClose();
  };

  const E = ({ k }: { k: string }) => err[k] ? <p className="text-topy text-sm mt-1" role="alert">{err[k]}</p> : null;

  return (
    <>
      <motion.div className="fixed inset-0 z-[60] bg-fahmy/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside role="dialog" aria-label={isNew ? "New product" : `Edit ${initial.name}`}
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 34, stiffness: 320 }}
        className="fixed right-0 top-0 bottom-0 z-[61] w-full max-w-[720px] bg-sand flex flex-col"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="px-5 md:px-7 h-16 flex items-center justify-between border-b border-fahmy/10 shrink-0">
          <h2 className="display text-xl">{isNew ? "New product" : "Edit product"}</h2>
          <button onClick={onClose} className="w-10 h-10 grid place-items-center rounded-full hover:bg-ramly" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 md:px-7 py-6 space-y-8">
          {/* Images */}
          <section>
            <p className="label">Photos <span className="text-stone/70">(first one is the cover, up to 6)</span></p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {p.images.map((src, i) => (
                <div key={i} className="relative aspect-[4/5] rounded-xl overflow-hidden bg-ramly group">
                  <img src={img(src)} alt="" className="w-full h-full object-cover" />
                  {i === 0 && <span className="absolute left-2 top-2 text-[11px] bg-fahmy text-sand rounded-full px-2 py-0.5">Cover</span>}
                  <div className="absolute inset-x-0 bottom-0 p-1.5 flex gap-1 justify-end bg-gradient-to-t from-fahmy/60 to-transparent">
                    {i > 0 && <button type="button" onClick={() => up("images", [src, ...p.images.filter((_, k) => k !== i)])} className="text-[11px] bg-sand rounded-full px-2 py-1">Make cover</button>}
                    <button type="button" onClick={() => up("images", p.images.filter((_, k) => k !== i))} className="w-7 h-7 grid place-items-center bg-sand rounded-full" aria-label="Remove photo"><X size={13} /></button>
                  </div>
                </div>
              ))}
              {p.images.length < 6 && (
                <label className="aspect-[4/5] rounded-xl border-2 border-dashed border-fahmy/20 hover:border-fahmy/50 grid place-items-center text-center cursor-pointer text-sm text-stone p-2">
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addImages(e.target.files)} />
                  <span><ImagePlus className="mx-auto mb-1 text-topy" size={22} />{uploading ? "Uploading…" : "Add photos"}</span>
                </label>
              )}
              {p.images.length === 0 && (
                <div className="aspect-[4/5] rounded-xl overflow-hidden bg-ramly relative">
                  <ProductImage p={p} />
                  <span className="absolute inset-x-0 bottom-0 text-[11px] text-center bg-fahmy/70 text-sand py-1">Artwork shown until you add photos</span>
                </div>
              )}
            </div>
            <E k="images" />
            {p.images.length === 0 && (
              <div className="flex gap-2 mt-3 items-center">
                <span className="text-sm text-stone mr-1">Artwork colours</span>
                {PALETTES.map((pal, i) => (
                  <button key={i} type="button" onClick={() => up("palette", pal)} aria-label={`Palette ${i + 1}`}
                    className={cx("w-8 h-8 rounded-full overflow-hidden border-2 flex", p.palette.join() === pal.join() ? "border-fahmy" : "border-transparent")}>
                    {pal.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="grid sm:grid-cols-2 gap-4">
            <div><label htmlFor="pe-name" className="label">Name (English)</label><input id="pe-name" className="field" value={p.name} onChange={(e) => up("name", e.target.value)} /><E k="name" /></div>
            <div><label htmlFor="pe-ar" className="label">Name (Arabic)</label><input id="pe-ar" dir="rtl" className="field font-ar" value={p.nameAr} onChange={(e) => up("nameAr", e.target.value)} /></div>
            <div>
              <label htmlFor="pe-cat" className="label">Category</label>
              <select id="pe-cat" className="field" value={p.category} onChange={(e) => { const c = e.target.value as Category; setP((x) => ({ ...x, category: c, art: x.category === c ? x.art : ART_FOR[c] })); }}>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
              </select>
            </div>
            <div><label htmlFor="pe-slug" className="label">Link</label><input id="pe-slug" className="field" placeholder={slugify(p.name || "new product")} value={p.slug} onChange={(e) => up("slug", slugify(e.target.value))} /><E k="slug" /></div>
          </section>

          <section className="grid grid-cols-3 gap-4">
            <div><label htmlFor="pe-price" className="label">Price (EGP)</label><input id="pe-price" type="number" min={0} className="field tnum" value={p.price || ""} onChange={(e) => up("price", Number(e.target.value))} /><E k="price" /></div>
            <div><label htmlFor="pe-compare" className="label">Old price</label><input id="pe-compare" type="number" min={0} className="field tnum" placeholder="Optional" value={p.compareAt ?? ""} onChange={(e) => up("compareAt", e.target.value ? Number(e.target.value) : undefined)} /></div>
            <div><label htmlFor="pe-stock" className="label">In stock</label><input id="pe-stock" type="number" min={0} className="field tnum" value={p.stock} onChange={(e) => up("stock", Number(e.target.value))} /><E k="stock" /></div>
          </section>

          <section className="flex flex-wrap gap-3">
            {([["active", "Visible in store"], ["featured", "Show in the vault on the homepage"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-3 rounded-xl border border-fahmy/15 bg-paper px-4 h-12 cursor-pointer">
                <input type="checkbox" className="w-5 h-5 accent-[#A85B3E]" checked={p[k]} onChange={(e) => up(k, e.target.checked)} />{l}
              </label>
            ))}
          </section>

          <section className="space-y-4">
            <div><label htmlFor="pe-desc" className="label">Description</label><textarea id="pe-desc" rows={3} className="field" value={p.description} onChange={(e) => up("description", e.target.value)} /></div>
            <div><label htmlFor="pe-details" className="label">Details <span className="text-stone/70">(one per line)</span></label><textarea id="pe-details" rows={4} className="field" value={detailsText} onChange={(e) => setDetailsText(e.target.value)} /></div>
          </section>

          <section>
            <div className="flex items-end gap-3 mb-3">
              <div className="flex-1"><label htmlFor="pe-vlabel" className="label">Options <span className="text-stone/70">(sizes, phone models…)</span></label><input id="pe-vlabel" className="field" placeholder="Option name, e.g. Size" value={p.variantLabel ?? ""} onChange={(e) => up("variantLabel", e.target.value)} /></div>
              <button type="button" className="btn-line h-12" onClick={() => up("variants", [...p.variants, { id: uid(), label: "", priceDelta: 0 }])}><Plus size={16} />Add option</button>
            </div>
            {p.variants.length === 0 && <p className="text-sm text-stone">No options. Customers buy this product as it is.</p>}
            <ul className="space-y-2">
              {p.variants.map((v, i) => (
                <li key={v.id} className="flex gap-2">
                  <input className="field flex-1" placeholder="e.g. A2 — 42×59 cm" value={v.label} aria-label={`Option ${i + 1} name`}
                    onChange={(e) => up("variants", p.variants.map((x) => (x.id === v.id ? { ...x, label: e.target.value } : x)))} />
                  <input type="number" className="field w-32 tnum" value={v.priceDelta} aria-label={`Option ${i + 1} price change`} title="Added to the base price (use a negative number for cheaper)"
                    onChange={(e) => up("variants", p.variants.map((x) => (x.id === v.id ? { ...x, priceDelta: Number(e.target.value) } : x)))} />
                  <button type="button" onClick={() => up("variants", p.variants.filter((x) => x.id !== v.id))} className="w-12 h-12 grid place-items-center rounded-xl hover:bg-ramly" aria-label="Remove option"><X size={16} /></button>
                </li>
              ))}
            </ul>
            {p.variants.length > 0 && <p className="text-xs text-stone mt-2">The number is added to the base price. Use 0 for the same price.</p>}
            <E k="variants" />
          </section>

          <section>
            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <input type="checkbox" className="w-5 h-5 accent-[#A85B3E]" checked={p.customText !== undefined} onChange={(e) => up("customText", e.target.checked ? "Your text" : undefined)} />
              Customers add their own text (names, slogans)
            </label>
            {p.customText !== undefined && <input id="pe-custom" className="field" value={p.customText} onChange={(e) => up("customText", e.target.value)} placeholder="Label shown to customers, e.g. Text on your flag" aria-label="Custom text label" />}
          </section>
        </div>

        <div className="px-5 md:px-7 py-4 border-t border-fahmy/10 flex flex-wrap gap-3 items-center shrink-0">
          {!isNew && (confirmDel ? (
            <span className="flex items-center gap-2 text-sm">
              Delete for good?
              <button className="btn h-10 px-4 bg-topy text-white" onClick={() => { deleteProduct(p.id); toast(`${initial.name} deleted`); onClose(); }}>Delete</button>
              <button className="btn h-10 px-4" onClick={() => setConfirmDel(false)}>Keep</button>
            </span>
          ) : (
            <button className="btn h-10 px-3 text-topy" onClick={() => setConfirmDel(true)}><Trash2 size={16} />Delete</button>
          ))}
          <div className="ml-auto flex gap-2">
            <button className="btn-line" onClick={onClose}>Discard</button>
            <button className="btn-dark" onClick={save} disabled={uploading}>{isNew ? "Add product" : "Save changes"}</button>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

export default function Products() {
  const { db, me, saveProduct, toast } = useStore();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState<Product | null>(() => db.products.find((p) => p.id === sp.get("edit")) ?? null);

  const sold = useMemo(() => {
    const m = new Map<string, number>();
    db.orders.filter((o) => o.status !== "cancelled").forEach((o) => o.lines.forEach((l) => m.set(l.productId, (m.get(l.productId) || 0) + l.qty)));
    return m;
  }, [db.orders]);

  if (!can(me?.role, "products")) return <Forbidden />;

  const list = db.products.filter((p) => (cat === "all" || p.category === cat) && (!q.trim() || p.name.toLowerCase().includes(q.toLowerCase()) || p.nameAr.includes(q)));
  const close = () => { setEditing(null); if (sp.get("edit")) setSp({}, { replace: true }); };

  return (
    <>
      <PageHead title="Products" sub={`${db.products.length} products, ${db.products.filter((p) => p.active).length} visible in the store`}
        action={<button className="btn-topy" onClick={() => setEditing(blank())}><Plus size={17} />New product</button>} />

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone" />
          <input id="prod-search" className="field h-10 pl-10" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
        </div>
        <select id="prod-cat" className="field h-10 w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="all">All categories</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
        </select>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-fahmy/20 py-16 text-center">
          <p className="font-medium">No products found</p>
          <button className="btn-dark mt-4" onClick={() => setEditing(blank())}>Add your first product</button>
        </div>
      ) : (
        <div className="rounded-2xl bg-paper border border-fahmy/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="text-left text-stone border-b border-fahmy/10">
                <tr><th className="font-normal px-4 py-3">Product</th><th className="font-normal px-4 py-3">Category</th><th className="font-normal px-4 py-3">Price</th><th className="font-normal px-4 py-3">Stock</th><th className="font-normal px-4 py-3">Sold</th><th className="font-normal px-4 py-3">In store</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-fahmy/10">
                {list.map((p) => (
                  <tr key={p.id} className="hover:bg-ramly/30">
                    <td className="px-4 py-3">
                      <button className="flex items-center gap-3 text-left" onClick={() => setEditing(p)}>
                        <span className="w-11 h-14 rounded-lg overflow-hidden bg-ramly shrink-0"><ProductImage p={p} /></span>
                        <span><span className="block font-medium hover:text-topy">{p.name}</span><span className="block font-ar text-stone text-xs" lang="ar">{p.nameAr}</span></span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-stone">{CATEGORY_LABEL[p.category].en}</td>
                    <td className="px-4 py-3 tnum">{egp(p.price)}{p.variants.length > 1 && <span className="block text-xs text-stone">{p.variants.length} options</span>}</td>
                    <td className="px-4 py-3">
                      <input type="number" min={0} value={p.stock} aria-label={`Stock for ${p.name}`}
                        onChange={(e) => saveProduct({ ...p, stock: Math.max(0, Number(e.target.value)) })}
                        className={cx("w-20 h-9 rounded-lg border px-2 tnum bg-sand", p.stock === 0 ? "border-topy text-topy" : p.stock <= 5 ? "border-[#C9A77C]" : "border-fahmy/15")} />
                    </td>
                    <td className="px-4 py-3 tnum text-stone">{sold.get(p.id) || 0}</td>
                    <td className="px-4 py-3">
                      <button role="switch" aria-checked={p.active} aria-label={`Show ${p.name} in store`} onClick={() => { saveProduct({ ...p, active: !p.active }); toast(p.active ? `${p.name} hidden from the store` : `${p.name} is live`); }}
                        className={cx("w-11 h-6 rounded-full relative transition-colors", p.active ? "bg-zeyti" : "bg-fahmy/20")}>
                        <span className={cx("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all", p.active ? "left-[22px]" : "left-0.5")} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right"><button className="text-topy hover:underline" onClick={() => setEditing(p)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>{editing && <Editor key={editing.id} initial={editing} onClose={close} />}</AnimatePresence>
    </>
  );
}
