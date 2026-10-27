import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { FreeDeliveryBar, IconMark, Lockup, Logo, Mark, ProductImage, Toast, Wordmark } from "./ui";
import Preloader from "./Preloader";
import { linePrice, useStore } from "../lib/store";
import { CATEGORY_LABEL, DELIVERY_ETA, cx, egp } from "../lib/utils";

const NAV = [
  { to: "/shop", label: "Shop all" },
  { to: "/shop?c=flags", label: "Flags" },
  { to: "/shop?c=posters", label: "Posters" },
  { to: "/shop?c=cases", label: "Phone cases" },
  { to: "/track", label: "Track order" },
];

function Header({ dark }: { dark: boolean }) {
  const { cart, setCartOpen } = useStore();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  const count = cart.reduce((s, i) => s + i.qty, 0);

  useEffect(() => {
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      setScrolled(y > 20);
      if (y > 300 && y > last + 4) setHidden(true);
      if (y < last - 4) setHidden(false);
      last = y;
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setMenu(false), [loc.pathname, loc.search]);

  const solid = scrolled || menu;
  return (
    <motion.header
      animate={{ y: hidden && !menu ? "-110%" : "0%" }}
      transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
      className={cx(
        "fixed inset-x-0 z-50 transition-colors duration-300",
        dark ? "text-sand" : "text-fahmy",
        solid && (dark ? "bg-ink/80 backdrop-blur-md border-b border-sand/10" : "bg-sand/85 backdrop-blur-md border-b border-ramady/50"),
      )}
      style={{ top: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="gutter h-16 md:h-[72px] flex items-center justify-between gap-6 max-w-[1500px] mx-auto">
        <Link to="/" aria-label="ATHAR home"><Logo light={dark} /></Link>
        <nav className="hidden lg:flex items-center gap-8 text-[14px]">
          {NAV.map((n) => <NavLink key={n.to} to={n.to} className={cx("py-1 opacity-80 hover:opacity-100 transition", dark ? "hover:text-topy" : "hover:text-topy-dark")}>{n.label}</NavLink>)}
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={() => setCartOpen(true)} className={cx("h-10 pl-4 pr-1.5 rounded-md inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide", dark ? "bg-sand text-ink hover:bg-white" : "bg-fahmy text-sand hover:bg-black")} aria-label={`Open bag, ${count} items`}>
            <ShoppingBag size={15} /> <span className="hidden sm:inline">Bag</span>
            <span className="tnum min-w-7 h-7 px-1.5 rounded bg-topy-dark text-white text-xs grid place-items-center">{count}</span>
          </button>
          <button className={cx("lg:hidden grid place-items-center w-10 h-10 rounded-md border", dark ? "border-sand/25" : "border-ramady")} onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu}>
            {menu ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {menu && (
          <motion.nav initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="lg:hidden overflow-hidden">
            <div className="gutter pb-6 pt-2 flex flex-col">
              {NAV.map((n) => <Link key={n.to} to={n.to} className={cx("display text-4xl py-3 border-b", dark ? "border-sand/10" : "border-ramady/50")}>{n.label}</Link>)}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

function CartDrawer() {
  const { cart, cartOpen, setCartOpen, db, setQty } = useStore();
  const settings = db.settings;
  const nav = useNavigate();
  const rows = cart.map((c) => ({ c, p: db.products.find((p) => p.id === c.productId) })).filter((r) => r.p);
  const subtotal = rows.reduce((s, r) => s + linePrice(r.p!, r.c.variantId) * r.c.qty, 0);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && setCartOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [setCartOpen]);

  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          <motion.div className="fixed inset-0 z-[70] bg-ink/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCartOpen(false)} />
          <motion.aside
            role="dialog" aria-label="Your bag"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-[71] w-full max-w-[440px] bg-sand flex flex-col"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)", paddingRight: "env(safe-area-inset-right, 0px)" }}
          >
            <div className="flex items-center justify-between px-6 h-[72px] border-b border-ramady/50">
              <h2 className="display text-3xl">Your bag</h2>
              <button onClick={() => setCartOpen(false)} className="grid place-items-center w-10 h-10 rounded-full hover:bg-ramly" aria-label="Close bag"><X size={18} /></button>
            </div>
            {rows.length === 0 ? (
              <div className="flex-1 grid place-items-center px-8 text-center">
                <div>
                  <Mark className="h-16 text-topy/70 mb-5" />
                  <p className="text-lg font-medium">Your bag is empty</p>
                  <p className="text-stone mt-1 mb-6">Start with a flag for your wall or a case with the أثر mark.</p>
                  <button className="btn-dark" onClick={() => { setCartOpen(false); nav("/shop"); }}>Browse the collection</button>
                </div>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 bg-ramly/60">
                  <FreeDeliveryBar subtotal={subtotal} threshold={settings.freeShippingOver} />
                  <p className="text-xs text-stone mt-2">Delivery in {DELIVERY_ETA.en} <span className="" lang="ar" dir="rtl">({DELIVERY_ETA.ar})</span></p>
                </div>
                <ul className="flex-1 overflow-y-auto px-6 divide-y divide-ramady/50">
                  {rows.map(({ c, p }) => {
                    const v = p!.variants.find((x) => x.id === c.variantId);
                    return (
                      <li key={c.key} className="py-5 flex gap-4">
                        <div className="w-20 h-24 rounded-lg overflow-hidden bg-ramly shrink-0"><ProductImage p={p!} text={c.custom} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between gap-3">
                            <p className="font-medium leading-snug">{p!.name}</p>
                            <p className="tnum shrink-0">{egp(linePrice(p!, c.variantId) * c.qty)}</p>
                          </div>
                          {v && <p className="text-sm text-stone">{v.label}</p>}
                          {c.custom && <p className="text-sm text-stone truncate">“{c.custom}”</p>}
                          <div className="mt-3 inline-flex items-center rounded-full border border-ramady">
                            <button className="w-9 h-9 grid place-items-center" onClick={() => setQty(c.key, c.qty - 1)} aria-label="Decrease quantity"><Minus size={14} /></button>
                            <span className="tnum w-6 text-center text-sm">{c.qty}</span>
                            <button className="w-9 h-9 grid place-items-center disabled:opacity-30" disabled={c.qty >= p!.stock} onClick={() => setQty(c.key, c.qty + 1)} aria-label="Increase quantity"><Plus size={14} /></button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="px-6 py-5 border-t border-ramady/50">
                  <div className="flex justify-between text-lg mb-1"><span>Subtotal</span><span className="tnum font-semibold">{egp(subtotal)}</span></div>
                  <p className="text-sm text-stone mb-4">Pay a deposit from {settings.minDeposit} EGP now, the rest in cash on delivery. Delivery calculated at checkout.</p>
                  <button className="btn-topy w-full" onClick={() => { setCartOpen(false); nav("/checkout"); }}>Go to checkout</button>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Footer() {
  return (
    <footer className="bg-ink text-sand relative z-[2] overflow-hidden">
      <div className="absolute inset-0 lattice text-sand/[0.035] pointer-events-none" aria-hidden />
      <div className="gutter max-w-[1500px] mx-auto pt-20 pb-10 relative">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Lockup className="w-[260px] md:w-[300px] text-sand" />
            <p className=" text-xl text-sand/80 mt-6" lang="ar" dir="rtl">كل تفصيلة ليها أثر</p>
          </div>
          <div>
            <h4 className="text-sand/40 text-xs uppercase tracking-[0.2em] mb-4">Shop</h4>
            <ul className="space-y-2.5 text-[15px]">
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => <li key={k}><Link className="hover:text-topy" to={`/shop?c=${k}`}>{v.en}</Link></li>)}
            </ul>
          </div>
          <div>
            <h4 className="text-sand/40 text-xs uppercase tracking-[0.2em] mb-4">Orders</h4>
            <ul className="space-y-2.5 text-[15px]">
              <li><Link className="hover:text-topy" to="/track">Track your order</Link></li>
              <li><Link className="hover:text-topy" to="/#faq">Payment & delivery</Link></li>
              <li><Link className="hover:text-topy" to="/#faq">Returns</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sand/40 text-xs uppercase tracking-[0.2em] mb-4">Store</h4>
            <ul className="space-y-2.5 text-[15px]">
              <li><a className="hover:text-topy" href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a></li>
              <li><a className="hover:text-topy" href="https://tiktok.com" target="_blank" rel="noreferrer">TikTok</a></li>
              <li><Link className="hover:text-topy" to="/admin">Admin login</Link></li>
            </ul>
          </div>
        </div>
        <Wordmark className="w-full text-sand/[0.06] mt-16 mb-8" />
        <div className="flex flex-wrap justify-between items-center gap-4 text-sm text-sand/40 pt-6 border-t border-sand/10">
          <span className="flex items-center gap-3"><IconMark className="h-5 text-ramady" /> © {new Date().getFullYear()} ATHAR. Made in Egypt.</span>
          <span>Prices in Egyptian pounds (EGP)</span>
        </div>
      </div>
    </footer>
  );
}

export default function StoreLayout() {
  const loc = useLocation();
  const dark = false; // every page opens on Ramly sand
  useEffect(() => {
    if (loc.hash) setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 80);
    else window.scrollTo(0, 0);
  }, [loc.pathname, loc.hash]);
  return (
    <div className={cx("grain min-h-screen flex flex-col", dark && "bg-ink")}>
      <Preloader />
      <Header dark={dark} />
      <main className="flex-1 relative z-[2]"><Outlet /></main>
      <Footer />
      <CartDrawer />
      <Toast />
    </div>
  );
}
