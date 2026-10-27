import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, MotionValue, useMotionValueEvent } from "framer-motion";
import { useStore } from "../lib/store";
import { Accordion, ImagePlaceholder, Mark, ProductCard, ProductImage } from "../components/ui";
import { img } from "../lib/assets";
import { CATEGORY_LABEL, DELIVERY_ETA, cx, egp, fmtDate } from "../lib/utils";
import type { Product } from "../lib/types";

const ease = [0.2, 0.7, 0.2, 1] as const;

/* Small calligraphic label, the brush-script counterpart of the reference */
const Tag = ({ children, dark = false, className = "" }: { children: React.ReactNode; dark?: boolean; className?: string }) => (
  <p className={cx("font-kufi font-bold text-[22px] leading-none", dark ? "text-topy" : "text-topy-deep", className)} lang="ar">{children}</p>
);

/* Hairline lattice band in place of the reference's barbed wire */
const Lattice = ({ className = "", light = false }) => <div aria-hidden className={cx("h-10 lattice [background-size:28px_28px]", light ? "text-fahmy/10" : "text-sand/10", className)} />;

function Hero({ stack }: { stack: Product[] }) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0), my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-1, 1], [6, -6]), { stiffness: 120, damping: 18 });
  const ry = useSpring(useTransform(mx, [-1, 1], [-8, 8]), { stiffness: 120, damping: 18 });
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const spread = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.6]);

  return (
    <section
      ref={ref}
      className="relative bg-sand text-fahmy overflow-hidden pt-28 md:pt-32 pb-16 md:pb-24"
      onMouseMove={(e) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
        my.set(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
    >
      <div className="absolute inset-0 lattice text-fahmy/[0.045]" aria-hidden />
      <div className="gutter max-w-[1500px] mx-auto relative grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-6 items-center">
        <div className="relative z-[2]">
          <Tag>مجموعة الخريف ٢٠٢٦</Tag>
          {/* "Made to leave أثر": the logo itself is the last word of the line */}
          <h1 className="mt-5 display text-[17vw] sm:text-[13vw] lg:text-[7.4vw] 2xl:text-[124px]" aria-label="Made to leave أثر">
            <motion.span initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, delay: 0.1, ease }} className="block" aria-hidden>
              Made to
            </motion.span>
            <motion.span initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, delay: 0.22, ease }} className="flex items-baseline gap-[0.24em]" aria-hidden>
              <span>leave</span>
              <Mark label="" className="h-[0.94em] text-topy-deep translate-y-[0.16em]" />
            </motion.span>
          </h1>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.45, ease }}>
            <p className="text-stone text-[17px] leading-relaxed mt-8 max-w-[46ch]">
              Wall flags, posters, laptop sleeves, phone cases, sunshades and umbrellas. Designed in Egypt, printed in small runs, checked by hand before they ship.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link to="/shop?c=flags" className="btn-topy uppercase tracking-wide text-[13px]">Shop the flags</Link>
              <Link to="/shop" className="btn-line uppercase tracking-wide text-[13px] font-semibold">See everything</Link>
            </div>
          </motion.div>
        </div>

        {/* Fanned stack of real flags, tilting with the cursor */}
        <motion.div style={{ rotateX: rx, rotateY: ry, transformPerspective: 1200 }} className="relative h-[92vw] sm:h-[70vw] lg:h-[620px]">
          {stack.slice(0, 4).map((p, i) => {
            const pos = [
              { l: "4%", t: "16%", r: -11 }, { l: "36%", t: "2%", r: 6 }, { l: "14%", t: "40%", r: -3 }, { l: "48%", t: "38%", r: 10 },
            ][i];
            return (
              <HeroCard key={p.id} p={p} i={i} pos={pos} spread={spread} />
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function HeroCard({ p, i, pos, spread }: { p: Product; i: number; pos: { l: string; t: string; r: number }; spread: MotionValue<number> }) {
  const rot = useTransform(spread, (s) => pos.r * s);
  return (
    <motion.div
      initial={{ opacity: 0, y: 120, rotate: pos.r * 3 }} animate={{ opacity: 1, y: 0, rotate: pos.r }}
      transition={{ duration: 1, delay: 0.35 + i * 0.12, ease }}
      style={{ left: pos.l, top: pos.t, rotate: rot, zIndex: i }}
      className="absolute w-[48%] lg:w-[46%]"
    >
      <motion.div whileHover={{ y: -14, scale: 1.04, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
        <Link to={`/p/${p.slug}`} className="block rounded-xl overflow-hidden bg-fahmy text-sand border border-ramady/70 shadow-[0_40px_70px_-34px_rgba(26,26,26,.55)]">
          <div className="aspect-square"><ProductImage p={p} /></div>
          <div className="flex justify-between items-center gap-2 px-3 py-2.5 bg-ink/90 text-[12px] md:text-[13px]">
            <span className="truncate font-medium">{p.name}</span>
            <span className="tnum text-ramady shrink-0">{egp(p.price)}</span>
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}

function Statement() {
  return (
    <section className="bg-sand text-fahmy relative">
      <Lattice light />
      <div className="gutter max-w-[1500px] mx-auto py-20 md:py-28 grid lg:grid-cols-[1.6fr_1fr] gap-10 items-end">
        <p className="display text-[11vw] sm:text-[7vw] lg:text-[64px] leading-[0.92]">
          Every piece is designed here, printed in small runs and checked by hand. No mass stock, no copy-paste.{" "}
          <span className="text-topy-deep">Things made to stay.</span>
        </p>
        <div>
          <p className="text-stone leading-relaxed max-w-[42ch]">Athar means trace: the mark something leaves behind. We make the everyday things you carry and hang, so each one leaves a little of home wherever it goes.</p>
          <div className="flex flex-wrap gap-2 mt-6">
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <Link key={k} to={`/shop?c=${k}`} className="h-8 px-3 rounded border border-ramady text-[12px] uppercase tracking-wide inline-flex items-center hover:border-topy-dark hover:text-topy-dark">{v.en}</Link>
            ))}
          </div>
        </div>
      </div>
      <Lattice light />
    </section>
  );
}

function VaultCard({ p, i, total, progress }: { p: Product; i: number; total: number; progress: MotionValue<number> }) {
  const c = i / Math.max(1, total - 1);
  const scale = useTransform(progress, [c - 0.3, c, c + 0.3], [0.88, 1, 0.88]);
  const rotate = useTransform(progress, [c - 0.3, c, c + 0.3], [-4, 0, 4]);
  return (
    <motion.div style={{ scale, rotate }} className="w-[min(78vw,380px)] shrink-0">
      <ProductCard p={p} dark size="lg" />
    </motion.div>
  );
}

function Vault({ items }: { items: Product[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0.04, 0.96], ["0%", `-${Math.max(0, items.length - 2.4) * (100 / items.length)}%`]);
  const bar = useTransform(scrollYProgress, [0.04, 0.96], ["0%", "100%"]);
  const [idx, setIdx] = useState(1);
  useMotionValueEvent(scrollYProgress, "change", (v) => setIdx(Math.min(items.length, Math.max(1, Math.round(v * (items.length - 1)) + 1))));

  return (
    <section className="bg-ink text-sand relative z-[2]" aria-label="Featured pieces">
      <div ref={ref} className="hidden md:block" style={{ height: `${Math.max(240, items.length * 42)}vh` }}>
        <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[min(90vw,1100px)] border-x border-sand/[0.06] pointer-events-none" aria-hidden />
          <div className="gutter max-w-[1500px] mx-auto w-full flex items-end justify-between gap-8 mb-10 relative">
            <div>
              <Tag dark>الخزنة</Tag>
              <h2 className="display text-7xl xl:text-8xl mt-2">The vault</h2>
            </div>
            <div className="text-right">
              <p className="display tnum text-7xl xl:text-8xl text-sand/90">{String(idx).padStart(2, "0")}<span className="text-sand/25">/{String(items.length).padStart(2, "0")}</span></p>
              <Link to="/shop" className="text-sm uppercase tracking-wide text-ramady hover:text-topy">View all pieces</Link>
            </div>
          </div>
          <motion.div style={{ x }} className="flex gap-8 pl-[max(40px,calc((100vw-1500px)/2+40px))] will-change-transform">
            {items.map((p, i) => <VaultCard key={p.id} p={p} i={i} total={items.length} progress={scrollYProgress} />)}
          </motion.div>
          <div className="gutter max-w-[1500px] mx-auto w-full mt-10">
            <div className="h-[2px] bg-sand/10 overflow-hidden"><motion.div style={{ width: bar }} className="h-full bg-topy" /></div>
          </div>
        </div>
      </div>
      <div className="md:hidden py-16">
        <div className="gutter mb-8">
          <Tag dark>الخزنة</Tag>
          <h2 className="display text-6xl mt-2">The vault</h2>
          <p className="text-ramady mt-2">Swipe through this season's most-wanted pieces.</p>
        </div>
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar gutter pb-2">
          {items.map((p) => <div key={p.id} className="w-[76vw] shrink-0 snap-center"><ProductCard p={p} dark /></div>)}
        </div>
      </div>
    </section>
  );
}

function Process() {
  const steps = [
    ["Pick", "Choose your design, size or phone model. Custom text if it has it."],
    ["Deposit", "Transfer a deposit from 100 EGP by InstaPay, wallet or bank."],
    ["Upload", "Attach the deposit receipt. We verify it and confirm your order."],
    ["Receive", `Delivered in ${DELIVERY_ETA.en}. Pay the rest in cash to the courier.`],
  ];
  return (
    <section className="bg-sand text-fahmy relative">
      <div className="gutter max-w-[1500px] mx-auto py-24 md:py-32">
        <Tag>الطريقة</Tag>
        <h2 className="display text-[14vw] sm:text-[9vw] lg:text-[96px] mt-3">
          From your screen <br className="hidden sm:block" />to your <span className="text-topy-deep">wall</span>
        </h2>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-14">
          {steps.map(([t, d], i) => (
            <motion.li key={t} initial={{ rotate: 0 }} whileHover={{ rotate: i % 2 ? 1.5 : -1.5, y: -6 }}
              className="relative border border-ramady/70 rounded-lg p-6 pt-5 min-h-[220px] flex flex-col bg-paper">
              <span className="display tnum text-6xl text-topy-deep">{String(i + 1).padStart(2, "0")}</span>
              <p className="display text-3xl mt-auto">{t}</p>
              <p className="text-stone text-[15px] leading-relaxed mt-2">{d}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Drop({ p }: { p: Product }) {
  return (
    <section className="bg-sand py-6 md:py-10">
      <div className="gutter max-w-[1500px] mx-auto">
        <div className="relative rounded-2xl bg-fahmy text-sand overflow-hidden grid lg:grid-cols-[1fr_1fr]">
          <div className="p-7 md:p-12 lg:p-16 flex flex-col">
            <Tag dark>الإصدار المميز</Tag>
            <h2 className="display text-[15vw] sm:text-[10vw] lg:text-[110px] mt-3">Drop 07</h2>
            <p className="display text-3xl md:text-4xl text-topy mt-1">{p.name}</p>
            <ul className="mt-8 space-y-2.5 text-[15px] text-ramady max-w-[44ch]">
              <li>{p.description}</li>
              {p.details.slice(0, 3).map((d) => <li key={d} className="flex gap-3"><span className="w-1.5 h-1.5 rounded-full bg-topy mt-2 shrink-0" />{d}</li>)}
            </ul>
            <div className="flex flex-wrap items-center gap-5 mt-10">
              <Link to={`/p/${p.slug}`} className="btn-topy uppercase tracking-wide text-[13px]">Get this flag</Link>
              <span className="tnum text-lg">from {egp(p.price)}</span>
            </div>
          </div>
          <div className="relative min-h-[380px] bg-[#242322]">
            <motion.div initial={{ rotate: 0 }} whileInView={{ rotate: -4 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 1, ease }}
              className="absolute inset-8 md:inset-14 rounded-xl overflow-hidden shadow-[0_40px_80px_-30px_rgba(29,27,25,.6)]">
              <ProductImage p={p} />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Categories({ products }: { products: Product[] }) {
  const cats = Object.entries(CATEGORY_LABEL).map(([k, v]) => ({ k, ...v, count: products.filter((p) => p.category === k).length, sample: products.find((p) => p.category === k) }));
  const spans = ["md:col-span-7 md:row-span-2", "md:col-span-5", "md:col-span-5", "md:col-span-4", "md:col-span-4", "md:col-span-4"];
  return (
    <section className="bg-sand text-fahmy">
      <div className="gutter max-w-[1500px] mx-auto py-24 md:py-32">
        <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
          <div>
            <Tag>المجموعات</Tag>
            <h2 className="display text-[14vw] sm:text-[9vw] lg:text-[96px] mt-3">Six ways to <br />carry home</h2>
          </div>
          <p className="text-stone max-w-[38ch]">The same quiet palette across everything: charcoal, sand, clay, olive and grey.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-12 gap-3 md:gap-4 md:auto-rows-[250px]">
          {cats.map((c, i) => (
            <Link key={c.k} to={`/shop?c=${c.k}`} className={cx("group relative overflow-hidden rounded-xl bg-ramly", spans[i], i === 0 ? "col-span-2 aspect-[4/3] md:aspect-auto" : "aspect-[4/5] md:aspect-auto")}>
              {/* Category banner slot: drop the real photo in here later */}
              <div className="absolute inset-0 transition-transform duration-[900ms] group-hover:scale-105">
                <ImagePlaceholder />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 text-fahmy flex items-end justify-between gap-3">
                <div>
                  <p className="font-ar text-sm text-fahmy/60" lang="ar">{c.ar}</p>
                  <p className="display text-2xl md:text-4xl">{c.en}</p>
                </div>
                <span className="tnum text-sm text-fahmy/50 shrink-0">{c.count} {c.count === 1 ? "piece" : "pieces"}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Record() {
  const { db } = useStore();
  const flags = db.products.filter((p) => p.active && p.category === "flags").length;
  const log = db.orders.filter((o) => o.status !== "cancelled" && o.status !== "pending").slice(0, 5);
  const stamps = [
    { v: String(flags), l: "Flag designs", cls: "bg-sand text-ink -rotate-2" },
    { v: "27", l: "Governorates we deliver to", cls: "bg-topy-dark text-white rotate-1" },
    { v: "5–7", l: "Working days to your door", cls: "border border-sand/30 text-sand -rotate-1" },
  ];
  return (
    <section className="bg-ink text-sand">
      <div className="gutter max-w-[1500px] mx-auto py-24 md:py-32 grid lg:grid-cols-[1fr_1.15fr] gap-14">
        <div>
          <Tag dark>السجل</Tag>
          <h2 className="display text-[14vw] sm:text-[9vw] lg:text-[96px] mt-3">Every order <br />leaves a <span className="text-topy">trace</span></h2>
          <div className="flex flex-wrap gap-4 mt-12">
            {stamps.map((s) => (
              <div key={s.l} className={cx("rounded-md px-5 py-4 min-w-[150px]", s.cls)}>
                <p className="display tnum text-6xl">{s.v}</p>
                <p className="text-xs uppercase tracking-wide mt-2 opacity-75 max-w-[16ch]">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:pt-24">
          <p className="text-ramady text-sm uppercase tracking-[0.2em] mb-4">Recently on its way</p>
          <ul className="divide-y divide-sand/10 border-y border-sand/10">
            {log.map((o) => (
              <li key={o.id} className="py-4 grid grid-cols-[90px_1fr_auto] gap-4 items-center text-[15px]">
                <span className="tnum text-sand/40 text-sm">{fmtDate(o.createdAt).replace(/ \d{4}$/, "")}</span>
                <span className="truncate"><span className="text-sand">{o.lines[0].name}</span>{o.lines.length > 1 && <span className="text-sand/40"> + {o.lines.length - 1} more</span>}</span>
                <span className="text-ramady text-sm uppercase tracking-wide">{o.shipping.governorate}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const { db } = useStore();
  const s = db.settings;
  return (
    <section id="faq" className="bg-sand text-fahmy relative z-[2] scroll-mt-20">
      <Lattice light />
      <div className="gutter max-w-[1500px] mx-auto py-24 md:py-32 grid lg:grid-cols-[1fr_1.4fr] gap-12">
        <div>
          <h2 className="display text-[14vw] sm:text-[9vw] lg:text-[96px]">Ask us <br /><span className="text-topy-deep">anything</span></h2>
          <p className="text-stone mt-6 max-w-[36ch]">Not here? Message us on WhatsApp at <span className="text-fahmy tnum select-all">{s.whatsapp}</span>.</p>
        </div>
        <Accordion defaultOpen={0} items={[
          { q: "How do I pay?", a: <>Pay a deposit of at least {s.minDeposit} EGP by InstaPay, mobile wallet ({s.wallet.providers}) or bank transfer, and upload the receipt at checkout. You pay the rest in cash when the courier delivers your order. You can also pay the full amount upfront.</> },
          { q: "When is my order confirmed?", a: "Your order stays pending until we check your deposit receipt by hand, usually within a few hours on working days. You'll get a WhatsApp message once it's confirmed, and you can follow it on the Track order page." },
          { q: "How much is delivery?", a: <>{s.shippingCairoAlex} EGP to Cairo, Giza and Alexandria, {s.shippingOther} EGP to other governorates, and free for orders of {s.freeShippingOver.toLocaleString()} EGP or more. Every order is delivered in {DELIVERY_ETA.en} <span className="font-ar" lang="ar">({DELIVERY_ETA.ar})</span>.</> },
          { q: "What are the flags made of?", a: "Knitted polyester printed edge to edge, with brass grommets and wall hooks in the box. They're light, don't crease much, and are safe to wash cold." },
          { q: "Can I return or exchange?", a: "Unused items can be exchanged within 14 days. Custom flags and personalised cases are made for you, so we replace those only if they arrive damaged or misprinted." },
          { q: "Can I order my own design?", a: "Yes. Choose Custom Flag, write your text at checkout, and we'll send you a proof on WhatsApp before we print. For a full image, send it to us on WhatsApp after you order." },
        ]} />
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="bg-ink text-sand border-t border-sand/10">
      <div className="gutter max-w-[1500px] mx-auto py-24 md:py-32 grid lg:grid-cols-[1.5fr_1fr] gap-10 items-end">
        <h2 className="display text-[15vw] sm:text-[10vw] lg:text-[120px]">Put a trace <br />on your wall</h2>
        <div>
          <p className="font-ar text-2xl text-sand/85" lang="ar" dir="rtl">كل تفصيلة ليها أثر</p>
          <p className="text-ramady mt-3 max-w-[38ch]">New flags drop every few weeks. Find the one that sounds like your room.</p>
          <Link to="/shop?c=flags" className="btn-topy uppercase tracking-wide text-[13px] mt-7">Shop the flags</Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { db } = useStore();
  const live = db.products.filter((p) => p.active);
  const featured = live.filter((p) => p.featured);
  const heroStack = ["the-godfather", "aurora-valley", "bmw-m4", "danger-zone"].map((s) => live.find((p) => p.slug === s)).filter(Boolean) as Product[];
  const drop = live.find((p) => p.slug === "bmw-m4") ?? featured[0];
  return (
    <>
      <Hero stack={heroStack.length >= 4 ? heroStack : featured} />
      <Statement />
      <Vault items={featured} />
      <Process />
      {drop && <Drop p={drop} />}
      <Categories products={live} />
      <Record />
      <FAQ />
      <Closing />
    </>
  );
}
