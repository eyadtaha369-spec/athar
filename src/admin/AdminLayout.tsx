import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BarChart3, LogOut, Package, Settings as Cog, ShoppingCart, Store, Users } from "lucide-react";
import { useStore, DEFAULT_OWNER } from "../lib/store";
import { Logo, Mark, Toast } from "../components/ui";
import { cx, fmtDate } from "../lib/utils";
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
        <Logo light />
        <Mark className="h-56 text-topy" />
        <p className="text-sand/50">Store admin</p>
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
          {err && <p className="text-topy text-sm mt-3" role="alert">{err}</p>}
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

function Notifications() {
  const { db, markNoticesRead } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const unread = db.notices.filter((n) => !n.read).length;
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative w-10 h-10 grid place-items-center rounded-full hover:bg-ramly" aria-label={`Notifications, ${unread} unread`}>
        <Bell size={18} />
        {unread > 0 && <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-topy text-white text-[11px] grid place-items-center tnum">{unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 mt-2 w-[min(340px,calc(100vw-32px))] rounded-2xl bg-paper border border-fahmy/10 shadow-[0_20px_50px_-20px_rgba(34,34,34,.35)] z-50 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-fahmy/10">
              <span className="font-medium">New orders</span>
              {unread > 0 && <button className="text-sm text-topy" onClick={markNoticesRead}>Mark all read</button>}
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {db.notices.length === 0 && <li className="px-4 py-6 text-sm text-stone">You'll see a notice here as soon as a customer places an order.</li>}
              {db.notices.slice(0, 20).map((n) => (
                <li key={n.id}>
                  <button className="w-full text-left px-4 py-3 hover:bg-ramly/60 flex gap-3" onClick={() => { setOpen(false); nav(`/admin/orders?o=${n.orderId}`); }}>
                    <span className={cx("w-2 h-2 rounded-full mt-2 shrink-0", n.read ? "bg-transparent" : "bg-topy")} />
                    <span><span className="block text-sm">{n.text}</span><span className="block text-xs text-stone mt-0.5">{fmtDate(n.at, true)}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AdminLayout() {
  const { me, logout, db } = useStore();
  if (!me) return <><Login /><Toast /></>;
  const pending = db.orders.filter((o) => o.status === "pending").length;
  const nav = [
    { to: "/admin", label: "Overview", icon: BarChart3, end: true, show: true },
    { to: "/admin/orders", label: "Orders", icon: ShoppingCart, badge: pending, show: true },
    { to: "/admin/products", label: "Products", icon: Package, show: can(me.role, "products") },
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
              className={({ isActive }) => cx("flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] transition-colors", isActive ? "bg-sand/10 text-sand" : "text-sand/60 hover:text-sand")}>
              <n.icon size={18} />{n.label}
              {!!n.badge && <span className="ml-auto tnum text-xs bg-topy text-white rounded-full px-2 py-0.5">{n.badge}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-1">
          <Link to="/" className="flex items-center gap-3 h-11 px-3 rounded-xl text-sand/60 hover:text-sand"><Store size={18} />View store</Link>
          <button onClick={logout} className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sand/60 hover:text-sand"><LogOut size={18} />Sign out</button>
        </div>
      </aside>

      <div className="min-w-0 flex flex-col">
        <header className="sticky z-40 bg-sand/90 backdrop-blur border-b border-fahmy/10" style={{ top: "env(safe-area-inset-top, 0px)" }}>
          <div className="gutter h-16 flex items-center justify-between gap-4">
            <Link to="/admin" className="lg:hidden"><Logo /></Link>
            <p className="hidden lg:block text-stone text-sm">Signed in as <span className="text-fahmy">{me.name}</span> <span className="capitalize">({me.role})</span></p>
            <div className="flex items-center gap-1">
              <Notifications />
              <button onClick={logout} className="lg:hidden w-10 h-10 grid place-items-center rounded-full hover:bg-ramly" aria-label="Sign out"><LogOut size={18} /></button>
            </div>
          </div>
          <nav className="lg:hidden gutter flex gap-1 overflow-x-auto no-scrollbar pb-2">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => cx("shrink-0 inline-flex items-center gap-2 h-9 px-3 rounded-full text-sm", isActive ? "bg-fahmy text-sand" : "text-stone")}>
                {n.label}{!!n.badge && <span className="tnum text-xs bg-topy text-white rounded-full px-1.5">{n.badge}</span>}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="gutter py-8 md:py-10 flex-1 max-w-[1400px] w-full"><Outlet /></main>
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
