import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { linePrice, useStore } from "../lib/store";
import { Accordion, ProductCard, ProductImage } from "../components/ui";
import { CATEGORY_LABEL, DELIVERY_ETA, cx, egp } from "../lib/utils";

export default function ProductPage() {
  const { slug } = useParams();
  const { db, addToCart, setCartOpen, toast } = useStore();
  const p = db.products.find((x) => x.slug === slug && x.active);
  const [variant, setVariant] = useState<string | undefined>(p?.variants[0]?.id);
  const [custom, setCustom] = useState("");
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const [err, setErr] = useState("");

  if (!p) {
    return (
      <div className="pt-40 pb-32 gutter text-center">
        <h1 className="display text-4xl">This piece isn't available</h1>
        <p className="text-stone mt-2">It may have sold out or been removed from the collection.</p>
        <Link to="/shop" className="btn-dark mt-8">Back to the collection</Link>
      </div>
    );
  }

  const price = linePrice(p, variant);
  const selected = p.variants.find((v) => v.id === variant);
  const soldOut = p.stock <= 0;
  const related = db.products.filter((x) => x.active && x.id !== p.id && x.category === p.category).concat(db.products.filter((x) => x.active && x.featured && x.category !== p.category)).slice(0, 4);
  const views = p.images.length ? p.images.map((_, i) => i) : [0];

  const add = () => {
    if (p.customText && !custom.trim()) { setErr(`Add the ${p.customText.toLowerCase()} so we can make it for you.`); return; }
    setErr("");
    addToCart({ productId: p.id, variantId: variant, custom: custom.trim() || undefined, qty });
    toast(`${p.name} added to your bag`);
    setCartOpen(true);
  };

  return (
    <>
      <div className="pt-24 md:pt-28 gutter max-w-[1500px] mx-auto">
        <nav className="text-sm text-stone mb-6 flex gap-2" aria-label="Breadcrumb">
          <Link to="/shop" className="hover:text-fahmy">Shop</Link><span>/</span>
          <Link to={`/shop?c=${p.category}`} className="hover:text-fahmy">{CATEGORY_LABEL[p.category].en}</Link>
        </nav>
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-16 items-start">
          {/* gallery — sticky on desktop */}
          <div className="lg:sticky lg:top-24 flex flex-col-reverse md:flex-row gap-3">
            {views.length > 1 && (
              <div className="flex md:flex-col gap-2 md:w-20">
                {views.map((i) => (
                  <button key={i} onClick={() => setImg(i)} className={cx("w-16 md:w-20 aspect-[4/5] rounded-lg overflow-hidden border-2", img === i ? "border-topy" : "border-transparent")} aria-label={`View image ${i + 1}`}>
                    <ProductImage p={p} i={i} />
                  </button>
                ))}
              </div>
            )}
            <motion.div key={img} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className={cx("flex-1 rounded-xl overflow-hidden", p.category === "flags" ? "aspect-square bg-ink" : "aspect-[4/5] bg-ramly")}>
              <ProductImage p={p} i={img} text={p.category === "flags" ? custom : undefined} className={p.category === "flags" && p.images.length ? "object-contain" : ""} />
            </motion.div>
          </div>

          {/* details */}
          <div className="lg:py-6">
            <p className=" text-lg text-topy-dark" lang="ar" dir="rtl">{p.nameAr}</p>
            <h1 className="display text-5xl md:text-7xl mt-1">{p.name}</h1>
            <div className="flex items-baseline gap-3 mt-5 tnum">
              <span className="text-2xl font-semibold">{egp(price)}</span>
              {p.compareAt && p.compareAt > price && <span className="text-stone line-through">{egp(p.compareAt)}</span>}
            </div>
            <p className="text-fahmy/80 leading-relaxed mt-5 max-w-[52ch] text-[17px]">{p.description}</p>

            {p.variants.length > 0 && (
              <fieldset className="mt-8">
                <legend className="text-sm text-stone mb-3">
                  Choose {(p.variantLabel || "an option").toLowerCase()}
                  {selected && <span className="text-fahmy">: {selected.label}</span>}
                </legend>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" aria-label={p.variantLabel || "Option"}>
                  {p.variants.map((v) => {
                    const on = variant === v.id;
                    return (
                      <button key={v.id} type="button" role="radio" aria-checked={on} onClick={() => setVariant(v.id)}
                        className={cx("text-left rounded-md border px-3.5 py-3 transition-colors", on ? "bg-fahmy text-sand border-fahmy" : "border-ramady hover:border-fahmy")}>
                        <span className="block text-[15px] font-medium tnum">{v.label}</span>
                        <span className={cx("block text-sm tnum mt-0.5", on ? "text-sand/70" : "text-stone")}>{egp(v.price)}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {p.customText && (
              <div className="mt-6">
                <label htmlFor="custom" className="label">{p.customText}</label>
                <input id="custom" className="field" maxLength={40} value={custom} onChange={(e) => { setCustom(e.target.value); setErr(""); }}
                  placeholder={p.category === "flags" ? "e.g. Hassan Family" : "e.g. Nour"} />
                <p className="text-xs text-stone mt-1.5">We send you a proof on WhatsApp before we print.</p>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3 items-center">
              <div className="inline-flex items-center rounded-full border border-ramady h-12">
                <button className="w-11 h-full grid place-items-center" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity"><Minus size={15} /></button>
                <span className="tnum w-8 text-center">{qty}</span>
                <button className="w-11 h-full grid place-items-center disabled:opacity-30" disabled={qty >= p.stock} onClick={() => setQty((q) => q + 1)} aria-label="Increase quantity"><Plus size={15} /></button>
              </div>
              <button className="btn-topy flex-1 min-w-[200px]" disabled={soldOut} onClick={add}>
                {soldOut ? "Sold out" : `Add to bag — ${egp(price * qty)}`}
              </button>
            </div>
            {err && <p className="text-topy-dark text-sm mt-3" role="alert">{err}</p>}
            <p className="text-sm text-stone mt-3">
              {soldOut ? "Back soon. Message us to be told when it's restocked." : p.stock <= 5 ? `Only ${p.stock} left in stock.` : `In stock. Delivered in ${DELIVERY_ETA.en}.`}
            </p>

            <div className="mt-10">
              <Accordion defaultOpen={0} items={[
                { q: "Details", a: <ul className="list-disc pl-5 space-y-1">{p.details.map((d) => <li key={d}>{d}</li>)}</ul> },
                { q: "Payment", a: `Pay a deposit from ${db.settings.minDeposit} EGP by InstaPay, mobile wallet or bank transfer and upload the receipt at checkout. The rest is paid in cash on delivery.` },
                { q: "Delivery", a: `${db.settings.shippingCairoAlex} EGP to Cairo, Giza and Alexandria, ${db.settings.shippingOther} EGP elsewhere. Free delivery on orders from ${db.settings.freeShippingOver.toLocaleString()} EGP. Delivery takes ${DELIVERY_ETA.en} (${DELIVERY_ETA.ar}).` },
              ]} />
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="gutter max-w-[1500px] mx-auto py-24">
          <h2 className="display text-4xl md:text-6xl mb-8">You might also like</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 md:gap-x-6 gap-y-10">
            {related.map((r) => <ProductCard key={r.id} p={r} />)}
          </div>
        </section>
      )}
    </>
  );
}
