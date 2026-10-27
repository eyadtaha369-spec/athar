import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellRing, BarChart3, LogOut, Megaphone, Package, Settings as Cog, ShoppingCart, Store, Users, Volume2, VolumeX, X } from "lucide-react";
import { useOrderAlerts } from "./alerts";
import { useStore, DEFAULT_OWNER } from "../lib/store";
import { Lockup, Logo, Toast } from "../components/ui";
import { STATUS_META, cx, egp, fmtDate } from "../lib/utils";
import type { AdminRole } from "../lib/types";

export const can = (role: AdminRole | undefined, what: "products" | "team" | "settings") =>
  role === "owner" || (role === "admin" && what === "products");

function Login() {
  const { login } = useStore();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="min-h-screen bg-fahmy text-sand grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12">
        <span />
        <Lockup className="w-[min(360px,80%)] text-sand self-center" />
        <p className="text-ramady">Store admin</p>
      </div>
      <div className="bg-sand text-fahmy flex items-center justify-center gutter py-16">
        <form
          className="w-full max-w-[380px]"
          onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr((await login(email, pw)) || ""); setBusy(false); }}
        >
          <div className="lg:hidden mb-10"><Logo /></div>
          <h1 className="display text-3xl">Sign in to admin</h1>
          <p className="text-stone mt-2 mb-8">Manage orders, products and your team.</p>
          <label htmlFor="ad-email" className="label">Email</label>
          <input id="ad-email" type="email" autoComplete="username" className="field mb-4" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="ad-pw" className="label">Password</label>
          <input id="ad-pw" type="password" autoComplete="current-password" className="field" value={pw} onChange={(e) => setPw(e.target.value)} required />
          {err && <p className="text-topy-dark text-sm mt-3" role="alert">{err}</p>}
          <button className="btn-dark w-full mt-6" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <div className="mt-8 rounded-xl bg-ramly/70 p-4 text-sm">
            <p className="font-medium">Demo owner account</p>
            <p className="text-stone tnum mt-1 select-all">{DEFAULT_OWNER.email} / {DEFAULT_OWNER.password}</p>
            <button type="button" className="mt-2 underline underline-offset-2" onClick={() => { setEmail(DEFAULT_OWNER.email); setPw(DEFAULT_OWNER.password); }}>Fill in</button>
          </div>
          <Link to="/" className="block text-sm text-stone mt-8 hover:text-fahmy">Back to the store</Link>
        </form>
      </div>
    </div>
  );
}

type Alerts = ReturnType<typeof useOrderAlerts>;

function Notifications({ al }: { al: Alerts }) {
  const { db } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const recent = db.orders.slice(0, 15);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative w-10 h-10 grid place-items-center rounded-full hover:bg-ramly" aria-label={`Order notifications, ${al.unread} new`}>
        <motion.span key={al.unread} animate={al.unread ? { rotate: [0, -18, 14, -8, 0] } : {}} transition={{ duration: 0.6 }} className="grid place-items-center">
          <Bell size={18} />
        </motion.span>
        {al.unread > 0 && <span className="absolute top-0.5 right-0.5 min-w-[19px] h-[19px] px-1 rounded-full bg-topy-dark text-white text-[11px] grid place-items-center tnum ring-2 ring-sand">{al.unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 mt-2 w-[min(360px,calc(100vw-32px))] rounded-2xl bg-paper border border-ramady/50 shadow-[0_20px_50px_-20px_rgba(34,34,34,.35)] z-50 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-ramady/50">
              <span className="font-medium">Orders <span className="text-stone font-normal">· {al.unread} new</span></span>
              {al.unread > 0 && <button className="text-sm text-topy-dark" onClick={al.markAllRead}>Mark all read</button>}
            </div>
            <ul className="max-h-96 overflow-y-auto">
              {recent.length === 0 && <li className="px-4 py-6 text-sm text-stone">New orders show up here the moment a customer checks out.</li>}
              {recent.map((o) => {
                const isNew = o.createdAt > al.lastSeen;
                return (
                  <li key={o.id}>
                    <button className="w-full text-left px-4 py-3 hover:bg-ramly/60 flex gap-3" onClick={() => { setOpen(false); nav(`/admin/orders?o=${o.id}`); }}>
                      <span className={cx("w-2 h-2 rounded-full mt-2 shrink-0", isNew ? "bg-topy" : "bg-transparent")} />
                      <span className="min-w-0 flex-1">
                        <span className="flex justify-between gap-2 text-sm"><b className="tnum">{o.number}</b><span className="tnum">{egp(o.total)}</span></span>
                        <span className="block text-sm truncate">{o.customer.name} · {o.shipping.governorate}</span>
                        <span className="block text-xs text-stone mt-0.5">{fmtDate(o.createdAt, true)} · {STATUS_META[o.status].label}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SyncStatus() {
  const { mode, lastSync, syncError, refreshOrders } = useStore();
  const [, tick] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = window.setInterval(() => tick((x) => x + 1), 5000); return () => window.clearInterval(t); }, []);
  if (mode === "local") return <span className="hidden sm:inline-flex items-center gap-2 text-xs text-stone px-2"><span className="w-2 h-2 rounded-full bg-ramady" />Demo mode</span>;
  const ago = lastSync ? Math.max(0, Math.round((Date.now() - lastSync) / 1000)) : null;
  return (
    <button
      onClick={async () => { setBusy(true); await refreshOrders(); setBusy(false); }}
      className="hidden sm:inline-flex items-center gap-2 text-xs text-stone px-2 h-9 rounded-full hover:bg-ramly"
      title="Check for new orders now"
    >
      <span className={cx("w-2 h-2 rounded-full", syncError ? "bg-topy" : "bg-zeyti", !syncError && "animate-pulse")} />
      {busy ? "Checking…" : syncError ? "Offline, retrying" : ago === null ? "Connecting…" : ago < 10 ? "Live" : `Live · ${ago < 60 ? ago + "s" : Math.round(ago / 60) + "m"} ago`}
    </button>
  );
}

function AlertBanner({ al, onOpen }: { al: Alerts; onOpen: (id: string) => void }) {
  return (
    <div className="space-y-2 mb-6 empty:hidden" aria-live="assertive">
      <AnimatePresence initial={false}>
        {al.alerts.map((o) => (
          <motion.div key={o.id} layout initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="rounded-xl bg-topy-dark text-white px-4 md:px-5 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 shadow-[0_16px_40px_-20px_rgba(168,91,62,.9)]" role="alert">
            <BellRing size={18} className="shrink-0" />
            <p className="flex-1 min-w-[220px] text-[15px]">
              <b>New order {o.number}</b> from {o.customer.name} · {egp(o.total)} · <span className="tnum">{egp(o.payment.deposit)}</span> deposit to verify
            </p>
            <div className="flex gap-2">
              <button className="h-9 px-4 rounded-md bg-white text-topy-dark text-sm font-semibold" onClick={() => { onOpen(o.id); al.dismiss(o.id); }}>Review and confirm</button>
              <button className="h-9 w-9 grid place-items-center rounded-md hover:bg-white/15" aria-label="Dismiss" onClick={() => al.dismiss(o.id)}><X size={16} /></button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function AdminLayout() {
  const { me, logout, db } = useStore();
  const go = useNavigate();
  const openOrder = useCallback((id: string) => go(`/admin/orders?o=${id}`), [go]);
  const al = useOrderAlerts(openOrder);
  if (!me) return <><Login /><Toast /></>;
  const pending = db.orders.filter((o) => o.status === "pending").length;
  const nav = [
    { to: "/admin", label: "Overview", icon: BarChart3, end: true, show: true },
    { to: "/admin/orders", label: "Orders", icon: ShoppingCart, badge: pending, show: true },
    { to: "/admin/products", label: "Products", icon: Package, show: can(me.role, "products") },
    { to: "/admin/push", label: "Push", icon: Megaphone, show: can(me.role, "products") },
    { to: "/admin/team", label: "Team", icon: Users, show: can(me.role, "team") },
    { to: "/admin/settings", label: "Settings", icon: Cog, show: can(me.role, "settings") },
  ].filter((n) => n.show);

  return (
    <div className="min-h-screen bg-sand lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden lg:flex flex-col bg-fahmy text-sand sticky top-0 h-screen p-5">
        <Link to="/admin" className="px-2 pt-1 pb-8"><Logo light /></Link>
        <nav className="flex flex-col gap-1">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => cx("flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] transition-colors", isActive ? "bg-sand/10 text-sand" : "text-ramady hover:text-sand")}>
              <n.icon size={18} />{n.label}
              {!!n.badge && <span className="ml-auto tnum text-xs bg-topy-dark text-white rounded-full px-2 py-0.5">{n.badge}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-1">
          <Link to="/" className="flex items-center gap-3 h-11 px-3 rounded-xl text-ramady hover:text-sand"><Store size={18} />View store</Link>
          <button onClick={logout} className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-ramady hover:text-sand"><LogOut size={18} />Sign out</button>
        </div>
      </aside>

      <div className="min-w-0 flex flex-col">
        <header className="sticky z-40 bg-sand/90 backdrop-blur border-b border-ramady/50" style={{ top: "env(safe-area-inset-top, 0px)" }}>
          <div className="gutter h-16 flex items-center justify-between gap-4">
            <Link to="/admin" className="lg:hidden"><Logo /></Link>
            <p className="hidden lg:block text-stone text-sm">Signed in as <span className="text-fahmy">{me.name}</span> <span className="capitalize">({me.role})</span></p>
            <div className="flex items-center gap-1">
              <SyncStatus />
              {al.permission === "default" && (
                <button onClick={al.enableDesktop} className="hidden md:inline-flex items-center gap-2 h-9 px-3 rounded-full text-xs border border-ramady/70 hover:border-fahmy" title="Get a pop-up on this computer for every new order">
                  <BellRing size={14} />Turn on pop-ups
                </button>
              )}
              <button onClick={al.toggleSound} className="w-10 h-10 grid place-items-center rounded-full hover:bg-ramly" aria-label={al.sound ? "Mute new-order sound" : "Turn on new-order sound"} title={al.sound ? "Sound on for new orders" : "Sound off"}>
                {al.sound ? <Volume2 size={18} /> : <VolumeX size={18} className="text-stone" />}
              </button>
              <Notifications al={al} />
              <button onClick={logout} className="lg:hidden w-10 h-10 grid place-items-center rounded-full hover:bg-ramly" aria-label="Sign out"><LogOut size={18} /></button>
            </div>
          </div>
          <nav className="lg:hidden gutter flex gap-1 overflow-x-auto no-scrollbar pb-2">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => cx("shrink-0 inline-flex items-center gap-2 h-9 px-3 rounded-full text-sm", isActive ? "bg-fahmy text-sand" : "text-stone")}>
                {n.label}{!!n.badge && <span className="tnum text-xs bg-topy-dark text-white rounded-full px-1.5">{n.badge}</span>}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="gutter py-8 md:py-10 flex-1 max-w-[1400px] w-full">
          <AlertBanner al={al} onOpen={openOrder} />
          <Outlet />
        </main>
      </div>
      <Toast />
    </div>
  );
}

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="display text-4xl md:text-6xl">{title}</h1>
        {sub && <p className="text-stone mt-1">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Forbidden() {
  return <p className="text-stone">Your role doesn't have access to this page. Ask the store owner to change your role.</p>;
}
