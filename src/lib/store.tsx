/**
 * ATHAR data layer.
 * This is a local mock backend (localStorage) with the same shape as the Supabase
 * schema in /supabase/schema.sql. Every mutation goes through `commit`, so swapping
 * to Supabase means replacing the bodies of the actions below with supabase-js calls.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AdminUser, CartItem, Notice, Order, OrderStatus, Product, Settings } from "./types";
import { SEED_PRODUCTS, SEED_SETTINGS, seedOrders } from "./seed";
import { sha256, uid } from "./utils";
import { fromPrice, normalizeProduct } from "./pricing";

const KEY = "athar:db:v6";
const CART_KEY = "athar:cart:v2";
const SESSION_KEY = "athar:admin-session";

interface DB {
  products: Product[];
  orders: Order[];
  admins: AdminUser[];
  notices: Notice[];
  settings: Settings;
  seq: number;
}

// Default owner account (change the password from Admin → Team after first login)
export const DEFAULT_OWNER = { email: "owner@athar.eg", password: "athar2026" };

async function freshDB(): Promise<DB> {
  return {
    products: SEED_PRODUCTS,
    orders: seedOrders(SEED_PRODUCTS),
    admins: [{
      id: "a1", name: "Store Owner", email: DEFAULT_OWNER.email, role: "owner",
      passwordHash: await sha256(DEFAULT_OWNER.password), createdAt: new Date().toISOString(),
    }],
    notices: [],
    settings: SEED_SETTINGS,
    seq: 1100,
  };
}

const safeGet = (k: string, s: Storage = localStorage) => { try { return s.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string, s: Storage = localStorage) => { try { s.setItem(k, v); return true; } catch { return false; } };

interface Ctx {
  ready: boolean;
  db: DB;
  // storefront
  cart: CartItem[];
  addToCart: (i: Omit<CartItem, "key">) => void;
  setQty: (key: string, qty: number) => void;
  clearCart: () => void;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  placeOrder: (o: Omit<Order, "id" | "number" | "createdAt" | "status" | "history" | "paymentVerified" | "codDue">) => Order;
  // admin
  me: AdminUser | null;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
  saveProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  setOrderStatus: (id: string, s: OrderStatus, note?: string) => void;
  verifyPayment: (id: string, v: boolean, amount?: number) => void;
  addAdmin: (a: { name: string; email: string; role: AdminUser["role"]; password: string }) => Promise<string | null>;
  removeAdmin: (id: string) => string | null;
  changePassword: (id: string, pw: string) => Promise<void>;
  markNoticesRead: () => void;
  saveSettings: (s: Settings) => void;
  clearSamples: () => void;
  resetAll: () => Promise<void>;
  toast: (msg: string) => void;
  toastMsg: string | null;
}

const StoreCtx = createContext<Ctx>(null as unknown as Ctx);
export const useStore = () => useContext(StoreCtx);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try { return JSON.parse(safeGet(CART_KEY) || "[]"); } catch { return []; }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [meId, setMeId] = useState<string | null>(() => safeGet(SESSION_KEY, sessionStorage));
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number>();

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  // boot
  useEffect(() => {
    (async () => {
      const raw = safeGet(KEY);
      if (raw) {
        try {
          const d: DB = JSON.parse(raw);
          setDb({
            ...d,
            products: d.products.map(normalizeProduct),
            settings: { ...SEED_SETTINGS, ...d.settings, minDeposit: d.settings.minDeposit ?? SEED_SETTINGS.minDeposit },
            // orders saved before deposits existed were paid in full
            orders: d.orders.map((o) => ({ ...o, codDue: o.codDue ?? 0, payment: { ...o.payment, deposit: o.payment.deposit ?? o.total } })),
          });
          return;
        } catch { /* fall through */ }
      }
      const d = await freshDB();
      safeSet(KEY, JSON.stringify(d));
      setDb(d);
    })();
  }, []);

  // cross-tab sync: an order placed in one tab shows up in the admin tab instantly
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        const next: DB = JSON.parse(e.newValue);
        setDb((prev) => {
          if (prev && next.notices.length > prev.notices.length) {
            const n = next.notices[0];
            if (n) setTimeout(() => toast(n.text), 0);
          }
          return next;
        });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [toast]);

  useEffect(() => { safeSet(CART_KEY, JSON.stringify(cart)); }, [cart]);

  const commit = useCallback((fn: (d: DB) => DB) => {
    setDb((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      if (!safeSet(KEY, JSON.stringify(next))) {
        setTimeout(() => toast("Browser storage is full. Remove old images or clear sample data in Settings."), 0);
      }
      return next;
    });
  }, [toast]);

  const me = useMemo(() => db?.admins.find((a) => a.id === meId) ?? null, [db, meId]);

  const value: Ctx | null = db && {
    ready: true,
    db,
    cart,
    cartOpen,
    setCartOpen,
    addToCart: (i) => {
      const key = [i.productId, i.variantId ?? "", i.custom ?? ""].join("|");
      setCart((c) => {
        const ex = c.find((x) => x.key === key);
        return ex ? c.map((x) => (x.key === key ? { ...x, qty: x.qty + i.qty } : x)) : [...c, { ...i, key }];
      });
    },
    setQty: (key, qty) => setCart((c) => (qty <= 0 ? c.filter((x) => x.key !== key) : c.map((x) => (x.key === key ? { ...x, qty } : x)))),
    clearCart: () => setCart([]),
    placeOrder: (o) => {
      const seq = db.seq + 1;
      const order: Order = {
        ...o, id: uid(), number: "ATH-" + seq, createdAt: new Date().toISOString(),
        status: "pending", paymentVerified: false,
        codDue: Math.max(0, o.total - o.payment.deposit),
        history: [{ status: "pending", at: new Date().toISOString(), note: `Order placed with a ${o.payment.deposit} EGP deposit receipt` }],
      };
      commit((d) => ({
        ...d, seq,
        orders: [order, ...d.orders],
        // reserve stock
        products: d.products.map((p) => {
          const q = o.lines.filter((l) => l.productId === p.id).reduce((s, l) => s + l.qty, 0);
          return q ? { ...p, stock: Math.max(0, p.stock - q) } : p;
        }),
        notices: [{ id: uid(), orderId: order.id, read: false, at: order.createdAt, text: `New order ${order.number} from ${o.customer.name}: ${o.payment.deposit} EGP deposit, ${order.codDue} EGP on delivery` }, ...d.notices].slice(0, 100),
      }));
      return order;
    },
    me,
    login: async (email, password) => {
      const a = db.admins.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
      if (!a || a.passwordHash !== (await sha256(password))) return "That email and password don't match an admin account.";
      safeSet(SESSION_KEY, a.id, sessionStorage);
      setMeId(a.id);
      commit((d) => ({ ...d, admins: d.admins.map((x) => (x.id === a.id ? { ...x, lastLogin: new Date().toISOString() } : x)) }));
      return null;
    },
    logout: () => { try { sessionStorage.removeItem(SESSION_KEY); } catch {} setMeId(null); },
    saveProduct: (raw) => commit((d) => {
      const p = { ...raw, price: fromPrice(raw.variants, raw.price) };
      return {
      ...d, products: d.products.some((x) => x.id === p.id) ? d.products.map((x) => (x.id === p.id ? p : x)) : [p, ...d.products],
      };
    }),
    deleteProduct: (id) => commit((d) => ({ ...d, products: d.products.filter((p) => p.id !== id) })),
    setOrderStatus: (id, s, note) => commit((d) => ({
      ...d, orders: d.orders.map((o) => {
        if (o.id !== id || o.status === s) return o;
        // returning stock when an order is cancelled
        const autoNote = s === "delivered" && o.codDue > 0 ? `Collected ${o.codDue} EGP cash on delivery` : undefined;
        return {
          ...o, status: s,
          paymentVerified: s === "confirmed" ? true : o.paymentVerified,
          codCollected: s === "delivered" ? true : o.codCollected,
          history: [...o.history, { status: s, at: new Date().toISOString(), by: me?.name, note: note ?? autoNote }],
        };
      }),
      products: s === "cancelled"
        ? d.products.map((p) => {
            const o = d.orders.find((x) => x.id === id);
            if (!o || o.status === "cancelled") return p;
            const q = o.lines.filter((l) => l.productId === p.id).reduce((t, l) => t + l.qty, 0);
            return q ? { ...p, stock: p.stock + q } : p;
          })
        : d.products,
    })),
    verifyPayment: (id, v, amount) => commit((d) => ({
      ...d, orders: d.orders.map((o) => {
        if (o.id !== id) return o;
        const verifiedDeposit = v ? (amount ?? o.payment.deposit) : undefined;
        return { ...o, paymentVerified: v, payment: { ...o.payment, verifiedDeposit }, codDue: Math.max(0, o.total - (verifiedDeposit ?? o.payment.deposit)) };
      }),
    })),
    addAdmin: async ({ name, email, role, password }) => {
      if (db.admins.some((a) => a.email.toLowerCase() === email.toLowerCase())) return "An admin with that email already exists.";
      const passwordHash = await sha256(password);
      commit((d) => ({ ...d, admins: [...d.admins, { id: uid(), name, email, role, passwordHash, createdAt: new Date().toISOString() }] }));
      return null;
    },
    removeAdmin: (id) => {
      const a = db.admins.find((x) => x.id === id);
      if (!a) return null;
      if (a.id === me?.id) return "You can't remove your own account.";
      if (a.role === "owner" && db.admins.filter((x) => x.role === "owner").length === 1) return "The store needs at least one owner.";
      commit((d) => ({ ...d, admins: d.admins.filter((x) => x.id !== id) }));
      return null;
    },
    changePassword: async (id, pw) => {
      const h = await sha256(pw);
      commit((d) => ({ ...d, admins: d.admins.map((a) => (a.id === id ? { ...a, passwordHash: h } : a)) }));
    },
    markNoticesRead: () => commit((d) => ({ ...d, notices: d.notices.map((n) => ({ ...n, read: true })) })),
    saveSettings: (s) => commit((d) => ({ ...d, settings: s })),
    clearSamples: () => commit((d) => ({ ...d, orders: d.orders.filter((o) => !o.sample) })),
    resetAll: async () => {
      const d = await freshDB();
      safeSet(KEY, JSON.stringify(d));
      setDb(d);
      setCart([]);
    },
    toast,
    toastMsg,
  };

  if (!value) {
    return (
      <div className="min-h-screen grid place-items-center bg-sand">
        <span className="font-ruqaa text-5xl text-topy animate-pulse">أثر</span>
      </div>
    );
  }
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

/** Price helpers shared by storefront and admin */
export function linePrice(p: Product, variantId?: string) {
  return p.variants.find((v) => v.id === variantId)?.price ?? p.price;
}
