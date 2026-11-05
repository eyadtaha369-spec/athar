/**
 * ATHAR data layer.
 *
 * Two modes, same interface:
 *  - "sheets": a Google Apps Script backend (google-apps-script/Code.gs) is configured. Orders,
 *    products, settings and admins are shared through one Google Sheet, so an order placed on any
 *    device reaches the admin on any other device. The admin dashboard polls for new orders.
 *  - "local": no backend configured (demo and preview). Everything lives in this browser's
 *    localStorage; other tabs in the same browser stay in sync through the storage event.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AdminUser, CartItem, Notice, Order, OrderStatus, Product, Settings } from "./types";
import { SEED_PRODUCTS, SEED_SETTINGS, seedOrders } from "./seed";
import { CATEGORY_LABEL, sha256, uid } from "./utils";

// Only categories the store sells; anything else (e.g. retired umbrellas) is ignored
const liveCategory = (p: Product) => p.category in CATEGORY_LABEL;
import { fromPrice, normalizeProduct } from "./pricing";
import { ApiError, REMOTE, call } from "./api";
import { showLocalNotification } from "./push";

export type PushResult = { targets: number; sent: number; failed: number; removed: number; skipped?: string };
export type PushLogEntry = { at: string; by: string; title: string; body: string; url: string; audience: string; sent: number; failed: number };
type PushRequest = { kind: "broadcast"; payload: { title: string; body: string; url?: string } } | { kind: "order"; order: { number: string; phone: string; status: OrderStatus; codDue: number } };

const LOCAL_PUSH_LOG = "athar:push-log";
const ORDER_PUSH: Partial<Record<OrderStatus, (n: string, cod: number) => { title: string; body: string }>> = {
  confirmed: (n) => ({ title: `Order ${n} confirmed`, body: "تم تأكيد طلبك. Your deposit is verified and we're preparing your order now." }),
  shipped: (n, cod) => ({ title: `Order ${n} is on its way`, body: `طلبك اتشحن. ${cod > 0 ? `Please have ${cod} EGP in cash ready for the courier.` : "Delivery in 5 to 7 working days."}` }),
  delivered: (n) => ({ title: `Order ${n} delivered`, body: "تم التسليم. Thank you for choosing ATHAR." }),
  cancelled: (n) => ({ title: `Order ${n} cancelled`, body: "Your order was cancelled. Message us on WhatsApp if this looks wrong." }),
};

const KEY = "athar:db:v8";
const CART_KEY = "athar:cart:v2";
const SESSION_KEY = "athar:admin-session";
const TOKEN_KEY = "athar:admin-token";
const CATALOG_KEY = "athar:catalog-cache";
// Product saves/deletes waiting for the server. Kept on the device so closing the app or a dropped
// connection never loses an admin's work; retried automatically when the admin is back online.
const OUTBOX_KEY = "athar:product-outbox";
type OutboxItem = { id: string; op: "save" | "delete"; product?: Product; at: string; error?: string };
const MY_ORDERS_KEY = "athar:my-orders";
const POLL_MS = 12000;

interface DB {
  products: Product[];
  orders: Order[];
  admins: AdminUser[];
  notices: Notice[];
  settings: Settings;
  seq: number;
}

export type NewOrder = Omit<Order, "id" | "number" | "createdAt" | "status" | "history" | "paymentVerified" | "codDue">;

// The old built-in owner account is retired; each admin signs in with their own account.
export const LEGACY_OWNER_EMAIL = "owner@athar.eg";

async function freshDB(): Promise<DB> {
  return {
    products: SEED_PRODUCTS,
    orders: seedOrders(SEED_PRODUCTS),
    admins: [], // the first visit to /admin creates the owner account
    notices: [],
    settings: SEED_SETTINGS,
    seq: 1100,
  };
}

const safeGet = (k: string, s: Storage = localStorage) => { try { return s.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string, s: Storage = localStorage) => { try { s.setItem(k, v); return true; } catch { return false; } };
const safeDel = (k: string, s: Storage = localStorage) => { try { s.removeItem(k); } catch { /* ignore */ } };
const readJSON = <T,>(k: string, fallback: T, s: Storage = localStorage): T => { try { return JSON.parse(safeGet(k, s) || "") as T; } catch { return fallback; } };

/** Shows this device's not-yet-confirmed product changes on top of the server copy. */
const withPending = (products: Product[]) => {
  let out = products;
  readJSON<OutboxItem[]>(OUTBOX_KEY, []).forEach((o) => {
    if (o.op === "delete") out = out.filter((p) => p.id !== o.id);
    else if (o.product) {
      const p = normalizeProduct(o.product);
      out = out.some((x) => x.id === o.id) ? out.map((x) => (x.id === o.id ? p : x)) : [p, ...out];
    }
  });
  return out;
};

const normalizeOrder = (o: Order): Order => ({ ...o, codDue: o.codDue ?? 0, payment: { ...o.payment, deposit: o.payment.deposit ?? o.total } });
const withSettings = (s?: Partial<Settings>): Settings => ({ ...SEED_SETTINGS, ...(s || {}), minDeposit: s?.minDeposit ?? SEED_SETTINGS.minDeposit });

interface Ctx {
  ready: boolean;
  mode: "sheets" | "local";
  db: DB;
  // storefront
  cart: CartItem[];
  addToCart: (i: Omit<CartItem, "key">) => void;
  setQty: (key: string, qty: number) => void;
  clearCart: () => void;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  placeOrder: (o: NewOrder) => Promise<Order>;
  findMyOrder: (number: string) => Order | undefined;
  trackOrder: (number: string, phone: string) => Promise<Order | null>;
  // admin
  me: AdminUser | null;
  adminToken: string | null;
  login: (email: string, password: string) => Promise<string | null>;
  needsOwner: () => Promise<boolean>;
  createFirstOwner: (o: { name: string; email: string; password: string; setupCode: string }) => Promise<string | null>;
  logout: () => void;
  refreshOrders: () => Promise<void>;
  lastSync: number | null;
  syncError: string | null;
  getReceipt: (o: Order) => Promise<string>;
  /** Resolves only once the product is stored on the server; rejects with the reason otherwise. */
  saveProduct: (p: Product, onStep?: (msg: string) => void) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  /** Product changes made on this device that the server hasn't confirmed yet. */
  pendingProducts: { id: string; name: string; op: "save" | "delete"; error?: string }[];
  retryPendingProducts: () => Promise<void>;
  setOrderStatus: (id: string, s: OrderStatus, note?: string) => void;
  verifyPayment: (id: string, v: boolean, amount?: number) => void;
  addAdmin: (a: { name: string; email: string; role: AdminUser["role"]; password: string }) => Promise<string | null>;
  removeAdmin: (id: string) => Promise<string | null>;
  changePassword: (id: string, pw: string) => Promise<void>;
  markNoticesRead: () => void;
  saveSettings: (s: Settings) => void;
  sendPush: (r: PushRequest) => Promise<PushResult>;
  pushStats: () => Promise<{ subscribers: number; log: PushLogEntry[] }>;
  importCatalog: () => Promise<void>;
  clearSamples: () => void;
  resetAll: () => Promise<void>;
  toast: (msg: string) => void;
  toastMsg: string | null;
}

const StoreCtx = createContext<Ctx>(null as unknown as Ctx);
export const useStore = () => useContext(StoreCtx);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);
  const dbRef = useRef<DB | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => readJSON<CartItem[]>(CART_KEY, []));
  const [cartOpen, setCartOpen] = useState(false);
  const [meId, setMeId] = useState<string | null>(() => safeGet(SESSION_KEY, sessionStorage));
  const [token, setToken] = useState<string | null>(() => (REMOTE ? safeGet(TOKEN_KEY, sessionStorage) : null));
  const [remoteMe, setRemoteMe] = useState<AdminUser | null>(null);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number>();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const receipts = useRef(new Map<string, Promise<string>>());

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 3600);
  }, []);

  /** Applies a change to the in-memory store; in local mode it is also saved to this browser. */
  const commit = useCallback((fn: (d: DB) => DB) => {
    const prev = dbRef.current;
    if (!prev) return;
    const next = fn(prev);
    dbRef.current = next;
    setDb(next);
    if (!REMOTE && !safeSet(KEY, JSON.stringify(next))) {
      toast("Browser storage is full. Remove old images or clear sample data in Settings.");
    }
  }, [toast]);

  const signOutLocal = useCallback(() => {
    safeDel(TOKEN_KEY, sessionStorage); safeDel(SESSION_KEY, sessionStorage);
    setToken(null); setRemoteMe(null); setMeId(null);
  }, []);

  /** Runs backend writes one at a time, in order, so quick successive changes can't overwrite each other. */
  const enqueue = useCallback((job: () => Promise<unknown>) => {
    const run = queue.current.then(job).catch((err: ApiError) => {
      toast(err.message || "That change couldn't be saved. Try again.");
      if (err.code === "auth") signOutLocal();
    });
    queue.current = run;
    return run;
  }, [toast, signOutLocal]);

  /* ---------- boot ---------- */
  useEffect(() => {
    (async () => {
      if (REMOTE) {
        const cached = readJSON<{ products: Product[]; settings: Settings } | null>(CATALOG_KEY, null);
        const base = (c: { products: Product[]; settings: Settings }): DB => ({
          products: withPending(c.products.filter(liveCategory).map(normalizeProduct)), settings: withSettings(c.settings), orders: [], admins: [], notices: [], seq: 0,
        });
        if (cached) { dbRef.current = base(cached); setDb(dbRef.current); }
        try {
          const c = await call<{ products: Product[]; settings: Settings }>("catalog");
          safeSet(CATALOG_KEY, JSON.stringify(c));
          const keep = dbRef.current;
          dbRef.current = { ...base(c), orders: keep?.orders ?? [], admins: keep?.admins ?? [] };
          setDb(dbRef.current);
        } catch (err) {
          setSyncError((err as Error).message);
          if (!dbRef.current) { dbRef.current = base({ products: SEED_PRODUCTS, settings: SEED_SETTINGS }); setDb(dbRef.current); }
        }
        return;
      }
      const raw = safeGet(KEY);
      if (raw) {
        try {
          const d: DB = JSON.parse(raw);
          dbRef.current = { ...d, products: d.products.filter(liveCategory).map(normalizeProduct), settings: withSettings(d.settings), orders: d.orders.map(normalizeOrder),
            admins: d.admins.filter((a) => a.email.toLowerCase() !== LEGACY_OWNER_EMAIL) };
          setDb(dbRef.current);
          return;
        } catch { /* fall through */ }
      }
      const d = await freshDB();
      safeSet(KEY, JSON.stringify(d));
      dbRef.current = d;
      setDb(d);
    })();
  }, []);

  /* ---------- local mode: other tabs in this browser ---------- */
  useEffect(() => {
    if (REMOTE) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        try { dbRef.current = JSON.parse(e.newValue); setDb(dbRef.current); } catch { /* ignore */ }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => { safeSet(CART_KEY, JSON.stringify(cart)); }, [cart]);

  /* ---------- sheets mode: admin session and live orders ---------- */
  const refreshOrders = useCallback(async () => {
    if (!REMOTE) { setLastSync(Date.now()); return; }
    if (!token) return;
    try {
      const orders = await call<Order[]>("listOrders", {}, token);
      commit((d) => ({ ...d, orders: orders.map(normalizeOrder) }));
      setLastSync(Date.now());
      setSyncError(null);
    } catch (err) {
      const e = err as ApiError;
      if (e.code === "auth") { signOutLocal(); toast(e.message); }
      else setSyncError(e.message);
    }
  }, [token, commit, signOutLocal, toast]);

  useEffect(() => {
    if (!REMOTE || !token || !db) return;
    let alive = true;
    (async () => {
      try {
        const r = await call<{ admin: AdminUser; admins: AdminUser[] }>("me", {}, token);
        if (!alive) return;
        setRemoteMe(r.admin);
        commit((d) => ({ ...d, admins: r.admins }));
        refreshOrders();
      } catch (err) {
        if ((err as ApiError).code === "auth") signOutLocal();
        else setSyncError((err as Error).message);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, !!db]);

  useEffect(() => {
    if (!REMOTE || !remoteMe) return;
    // every 12 s while the dashboard is in view, every ~48 s in a background tab
    let tick = 0;
    const t = window.setInterval(() => { tick++; if (document.visibilityState === "visible" || tick % 4 === 0) refreshOrders(); }, POLL_MS);
    const onFocus = () => refreshOrders();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { window.clearInterval(t); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [remoteMe, refreshOrders]);

  const me = useMemo(() => (REMOTE ? remoteMe : db?.admins.find((a) => a.id === meId) ?? null), [db, meId, remoteMe]);

  /* ---------- push ---------- */
  /* ---------- products: saved to the server for real, with an on-device outbox ---------- */
  const [outbox, setOutbox] = useState<OutboxItem[]>(() => (REMOTE ? readJSON<OutboxItem[]>(OUTBOX_KEY, []) : []));
  const writeOutbox = useCallback((f: (o: OutboxItem[]) => OutboxItem[]) => {
    setOutbox((cur) => {
      const next = f(cur);
      // photos not uploaded yet can be large; if the device is full keep the list without them
      if (!safeSet(OUTBOX_KEY, JSON.stringify(next))) safeSet(OUTBOX_KEY, JSON.stringify(next.map((o) => (o.product ? { ...o, product: { ...o.product, images: o.product.images.filter((x) => !String(x).startsWith("data:")) } } : o))));
      return next;
    });
  }, []);

  const putProduct = useCallback((x: Product) => commit((d) => ({
    ...d, products: d.products.some((y) => y.id === x.id) ? d.products.map((y) => (y.id === x.id ? x : y)) : [x, ...d.products],
  })), [commit]);

  /** Pull the catalog back from the server so every screen shows what is really stored. */
  const syncCatalog = useCallback(async () => {
    const c = await call<{ products: Product[]; settings: Settings }>("catalog");
    safeSet(CATALOG_KEY, JSON.stringify(c));
    commit((d) => ({ ...d, products: withPending(c.products.filter(liveCategory).map(normalizeProduct)), settings: withSettings(c.settings) }));
  }, [commit]);

  const uploadPhotos = async (p: Product, onStep?: (m: string) => void): Promise<Product> => {
    const pending = [...p.images, ...Object.values(p.frameImages || {})].filter((x) => String(x || "").startsWith("data:")).length;
    let done = 0;
    const up = async (v: string) => {
      if (!String(v).startsWith("data:")) return v;
      onStep?.(`Uploading photo ${++done} of ${pending}…`);
      return call<string>("uploadImage", { dataUrl: v }, token);
    };
    const images: string[] = [];
    for (const v of p.images) images.push(await up(v)); // one at a time: kinder to phone connections
    let frameImages = p.frameImages;
    if (frameImages) {
      const next: NonNullable<Product["frameImages"]> = {};
      for (const [k, v] of Object.entries(frameImages)) if (v) next[k as keyof typeof next] = await up(v);
      frameImages = next;
    }
    return { ...p, images, frameImages };
  };

  const runProductJob = async (item: OutboxItem, onStep?: (m: string) => void) => {
    inFlight.current.add(item.id);
    try { await runProductJobInner(item, onStep); } finally { inFlight.current.delete(item.id); }
  };
  const runProductJobInner = async (item: OutboxItem, onStep?: (m: string) => void) => {
    if (item.op === "delete") {
      onStep?.("Deleting…");
      await call("deleteProduct", { id: item.id }, token);
      return;
    }
    let p = item.product!;
    p = await uploadPhotos(p, onStep);
    // remember the uploaded links right away, so a retry doesn't upload the same photos again
    writeOutbox((o) => o.map((x) => (x.id === item.id && x.op === "save" ? { ...x, product: p } : x)));
    putProduct(p);
    onStep?.("Saving to the store…");
    const saved = await call<Product>("saveProduct", { product: p }, token);
    if (!saved || saved.id !== p.id) throw new ApiError("The store didn't confirm the save. Try again.");
  };

  const productQueue = useRef<Promise<unknown>>(Promise.resolve());
  const inFlight = useRef(new Set<string>());
  const serial = <T,>(job: () => Promise<T>): Promise<T> => {
    const run = productQueue.current.then(job, job);
    productQueue.current = run.catch(() => undefined);
    return run;
  };

  const saveProductNow = async (raw: Product, onStep?: (m: string) => void) => {
    const p: Product = { ...raw, price: fromPrice(raw.variants, raw.price) };
    putProduct(p);
    if (!REMOTE) return;
    const item: OutboxItem = { id: p.id, op: "save", product: p, at: new Date().toISOString() };
    writeOutbox((o) => [...o.filter((x) => x.id !== p.id), item]);
    await serial(async () => {
      try {
        await runProductJob(item, onStep);
        writeOutbox((o) => o.filter((x) => !(x.id === p.id && x.at === item.at)));
      } catch (err) {
        const e = err as ApiError;
        writeOutbox((o) => o.map((x) => (x.id === p.id ? { ...x, error: e.message } : x)));
        if (e.code === "auth") signOutLocal();
        throw e;
      }
    });
    syncCatalog().catch(() => undefined);
  };

  const deleteProductNow = async (id: string) => {
    commit((d) => ({ ...d, products: d.products.filter((p) => p.id !== id) }));
    if (!REMOTE) return;
    const item: OutboxItem = { id, op: "delete", at: new Date().toISOString() };
    writeOutbox((o) => [...o.filter((x) => x.id !== id), item]);
    await serial(async () => {
      try {
        await runProductJob(item);
        writeOutbox((o) => o.filter((x) => !(x.id === id && x.at === item.at)));
      } catch (err) {
        const e = err as ApiError;
        writeOutbox((o) => o.map((x) => (x.id === id ? { ...x, error: e.message } : x)));
        if (e.code === "auth") signOutLocal();
        throw e;
      }
    });
    syncCatalog().catch(() => undefined);
  };

  /** Re-send everything still waiting (after sign-in, when the connection is back, or from the banner). */
  const flushing = useRef(false);
  const flushOutbox = useCallback(async () => {
    if (!REMOTE || !token || flushing.current) return;
    const items = readJSON<OutboxItem[]>(OUTBOX_KEY, []);
    if (!items.length) return;
    flushing.current = true;
    try {
      for (let item of items) {
        if (inFlight.current.has(item.id)) continue; // already being sent from the editor
        await serial(async () => {
          // use the newest copy (photos may have been uploaded since the list was read)
          const latest = readJSON<OutboxItem[]>(OUTBOX_KEY, []).find((x) => x.id === item.id);
          if (!latest) return; // finished meanwhile
          item = latest;
          try {
            await runProductJob(item);
            writeOutbox((o) => o.filter((x) => !(x.id === item.id && x.at === item.at)));
          } catch (err) {
            const e = err as ApiError;
            writeOutbox((o) => o.map((x) => (x.id === item.id ? { ...x, error: e.message } : x)));
            if (e.code === "auth") { signOutLocal(); throw e; }
          }
        }).catch(() => undefined);
      }
      await syncCatalog().catch(() => undefined);
    } finally { flushing.current = false; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!REMOTE || !remoteMe) return;
    flushOutbox();
    const online = () => flushOutbox();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [remoteMe, flushOutbox]);

  const sendPushNow = async (r: PushRequest): Promise<PushResult> => {
    if (REMOTE) {
      let res: Response;
      try {
        res = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...r }) });
      } catch { throw new ApiError("Can't reach the push server. Check your connection.", "network"); }
      const j = await res.json().catch(() => ({ ok: false, error: "The push server isn't responding yet. It runs on the live Vercel site." }));
      if (!j.ok) throw new ApiError(j.error, j.code);
      return j.data as PushResult;
    }
    // demo mode: the only subscriber is this browser
    if (r.kind !== "broadcast") return { targets: 0, sent: 0, failed: 0, removed: 0 };
    const shown = await showLocalNotification(r.payload);
    const entry: PushLogEntry = { at: new Date().toISOString(), by: me?.name ?? "Admin", title: r.payload.title, body: r.payload.body, url: r.payload.url ?? "/", audience: "all", sent: shown ? 1 : 0, failed: 0 };
    safeSet(LOCAL_PUSH_LOG, JSON.stringify([entry, ...readJSON<PushLogEntry[]>(LOCAL_PUSH_LOG, [])].slice(0, 15)));
    return { targets: shown ? 1 : 0, sent: shown ? 1 : 0, failed: 0, removed: 0 };
  };

  /* ---------- helpers ---------- */
  const updateOrder = (id: string, fn: (o: Order) => Order) => {
    const cur = dbRef.current?.orders.find((o) => o.id === id);
    if (!cur) return;
    const next = fn(cur);
    if (next === cur) return;
    commit((d) => ({ ...d, orders: d.orders.map((o) => (o.id === id ? next : o)) }));
    if (REMOTE) {
      enqueue(async () => {
        const saved = await call<Order>("updateOrder", { order: { ...next, payment: { ...next.payment, receipt: undefined } } }, token);
        commit((d) => ({ ...d, orders: d.orders.map((o) => (o.id === id ? normalizeOrder(saved) : o)) }));
      });
    }
    return { cur, next };
  };

  const value: Ctx | null = db && {
    ready: true,
    mode: REMOTE ? "sheets" : "local",
    db,
    cart,
    cartOpen,
    setCartOpen,
    addToCart: (i) => {
      const key = [i.productId, i.variantId ?? "", i.custom ?? "", i.frame ?? ""].join("|");
      setCart((c) => {
        const ex = c.find((x) => x.key === key);
        return ex ? c.map((x) => (x.key === key ? { ...x, qty: x.qty + i.qty } : x)) : [...c, { ...i, key }];
      });
    },
    setQty: (key, qty) => setCart((c) => (qty <= 0 ? c.filter((x) => x.key !== key) : c.map((x) => (x.key === key ? { ...x, qty } : x)))),
    clearCart: () => setCart([]),

    placeOrder: async (o) => {
      if (REMOTE) {
        const saved = normalizeOrder(await call<Order>("placeOrder", { order: o }));
        // remember it on this device so the confirmation page can show it (without the receipt image)
        const mine = readJSON<Order[]>(MY_ORDERS_KEY, []);
        safeSet(MY_ORDERS_KEY, JSON.stringify([{ ...saved, payment: { ...saved.payment, receipt: "" } }, ...mine].slice(0, 20)));
        // reflect the stock the server reserved
        commit((d) => ({
          ...d, products: d.products.map((p) => {
            const q = saved.lines.filter((l) => l.productId === p.id).reduce((s, l) => s + l.qty, 0);
            return q ? { ...p, stock: Math.max(0, p.stock - q) } : p;
          }),
        }));
        return saved;
      }
      const d0 = dbRef.current!;
      const seq = d0.seq + 1;
      const order: Order = {
        ...o, id: uid(), number: "ATH-" + seq, createdAt: new Date().toISOString(),
        status: "pending", paymentVerified: false,
        codDue: Math.max(0, o.total - o.payment.deposit),
        history: [{ status: "pending", at: new Date().toISOString(), note: `Order placed with a ${o.payment.deposit} EGP deposit receipt` }],
      };
      commit((d) => ({
        ...d, seq,
        orders: [order, ...d.orders],
        products: d.products.map((p) => {
          const q = o.lines.filter((l) => l.productId === p.id).reduce((s, l) => s + l.qty, 0);
          return q ? { ...p, stock: Math.max(0, p.stock - q) } : p;
        }),
      }));
      return order;
    },

    findMyOrder: (number) => db.orders.find((o) => o.number === number) ?? readJSON<Order[]>(MY_ORDERS_KEY, []).find((o) => o.number === number),

    trackOrder: async (number, phone) => {
      const n = number.trim().toUpperCase().replace(/^(\d)/, "ATH-$1");
      const ph = phone.replace(/\s/g, "");
      if (REMOTE) return call<Order | null>("trackOrder", { number: n, phone: ph });
      return dbRef.current?.orders.find((x) => x.number === n && x.customer.phone === ph) ?? null;
    },

    me,
    login: async (email, password) => {
      const passwordHash = await sha256(password);
      if (REMOTE) {
        try {
          const r = await call<{ token: string; admin: AdminUser; admins: AdminUser[] }>("login", { email, passwordHash });
          safeSet(TOKEN_KEY, r.token, sessionStorage);
          setRemoteMe(r.admin);
          commit((d) => ({ ...d, admins: r.admins }));
          setToken(r.token);
          return null;
        } catch (err) { return (err as Error).message; }
      }
      const a = db.admins.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
      if (!a || a.passwordHash !== passwordHash) return "That email and password don't match an admin account.";
      safeSet(SESSION_KEY, a.id, sessionStorage);
      setMeId(a.id);
      commit((d) => ({ ...d, admins: d.admins.map((x) => (x.id === a.id ? { ...x, lastLogin: new Date().toISOString() } : x)) }));
      return null;
    },
    needsOwner: async () => {
      if (REMOTE) { try { return (await call<{ needsOwner: boolean }>("setupStatus", {})).needsOwner; } catch { return false; } }
      return db.admins.length === 0;
    },
    createFirstOwner: async ({ name, email, password, setupCode }) => {
      if (password.length < 8) return "Use a password with at least 8 characters.";
      const passwordHash = await sha256(password);
      if (REMOTE) {
        try {
          const r = await call<{ token: string; admin: AdminUser; admins: AdminUser[] }>("createFirstOwner", { name, email, passwordHash, setupCode });
          safeSet(TOKEN_KEY, r.token, sessionStorage);
          setRemoteMe(r.admin);
          commit((d) => ({ ...d, admins: r.admins }));
          setToken(r.token);
          return null;
        } catch (err) { return (err as Error).message; }
      }
      if (db.admins.length) return "This store already has an owner. Sign in instead.";
      const a: AdminUser = { id: uid(), name: name.trim(), email: email.trim().toLowerCase(), role: "owner", passwordHash, createdAt: new Date().toISOString(), lastLogin: new Date().toISOString() };
      commit((d) => ({ ...d, admins: [a] }));
      safeSet(SESSION_KEY, a.id, sessionStorage);
      setMeId(a.id);
      return null;
    },
    logout: () => {
      if (REMOTE && token) call("logout", {}, token).catch(() => undefined);
      signOutLocal();
    },
    refreshOrders,
    lastSync,
    syncError,

    getReceipt: (o) => {
      const ref = o.payment.receipt || "";
      if (!REMOTE || String(ref).startsWith("data:")) return Promise.resolve(ref);
      const hit = receipts.current.get(o.id);
      if (hit) return hit;
      const p = call<string>("getReceipt", { orderId: o.id }, token);
      receipts.current.set(o.id, p);
      p.catch(() => receipts.current.delete(o.id));
      return p;
    },

    saveProduct: (raw, onStep) => saveProductNow(raw, onStep),
    deleteProduct: (id) => deleteProductNow(id),
    pendingProducts: outbox.map((o) => ({ id: o.id, name: o.product?.name ?? dbRef.current?.products.find((p) => p.id === o.id)?.name ?? "Product", op: o.op, error: o.error })),
    retryPendingProducts: () => flushOutbox(),

    setOrderStatus: (id, s, note) => {
      const r = updateOrder(id, (o) => {
        if (o.status === s) return o;
        const autoNote = s === "delivered" && o.codDue > 0 ? `Collected ${o.codDue} EGP cash on delivery` : undefined;
        return {
          ...o, status: s,
          paymentVerified: s === "confirmed" ? true : o.paymentVerified,
          codCollected: s === "delivered" ? true : o.codCollected,
          history: [...o.history, { status: s, at: new Date().toISOString(), by: me?.name, note: note ?? autoNote }],
        };
      });
      // let the customer know on their phone (sheets mode: via the push server; demo: on this device)
      if (r && r.cur.status !== s && ORDER_PUSH[s]) {
        const o = r.next;
        const req: PushRequest = { kind: "order", order: { number: o.number, phone: o.customer.phone, status: s, codDue: o.codDue } };
        if (REMOTE) {
          // wait for the status change to reach the sheet first, then push
          queue.current = queue.current.then(() => sendPushNow(req).then((res) => { if (res.sent) toast(`${o.number}: customer notified on their phone`); }).catch(() => undefined));
        } else {
          const m = ORDER_PUSH[s]!(o.number, o.codDue);
          showLocalNotification({ ...m, url: `/order/${o.number}` }).catch(() => undefined);
        }
      }
      // cancelling returns the stock (the server does this itself in sheets mode)
      if (r && s === "cancelled" && r.cur.status !== "cancelled") {
        commit((d) => ({
          ...d, products: d.products.map((p) => {
            const q = r.cur.lines.filter((l) => l.productId === p.id).reduce((t, l) => t + l.qty, 0);
            return q ? { ...p, stock: p.stock + q } : p;
          }),
        }));
      }
    },
    verifyPayment: (id, v, amount) => {
      updateOrder(id, (o) => {
        const verifiedDeposit = v ? (amount ?? o.payment.deposit) : undefined;
        return { ...o, paymentVerified: v, payment: { ...o.payment, verifiedDeposit }, codDue: Math.max(0, o.total - (verifiedDeposit ?? o.payment.deposit)) };
      });
    },

    addAdmin: async ({ name, email, role, password }) => {
      const passwordHash = await sha256(password);
      if (REMOTE) {
        try {
          const admins = await call<AdminUser[]>("addAdmin", { name, email, role, passwordHash }, token);
          commit((d) => ({ ...d, admins }));
          if (remoteMe && !admins.some((x) => x.id === remoteMe.id)) {
            // the old built-in account was retired the moment a real owner existed
            window.setTimeout(() => { signOutLocal(); toast("The old default account is deleted. Sign in with your own account."); }, 1500);
          }
          return null;
        } catch (err) { return (err as Error).message; }
      }
      if (db.admins.some((a) => a.email.toLowerCase() === email.toLowerCase())) return "An admin with that email already exists.";
      commit((d) => ({ ...d, admins: [...d.admins, { id: uid(), name, email, role, passwordHash, createdAt: new Date().toISOString() }] }));
      return null;
    },
    removeAdmin: async (id) => {
      if (REMOTE) {
        try {
          const admins = await call<AdminUser[]>("removeAdmin", { id }, token);
          commit((d) => ({ ...d, admins }));
          return null;
        } catch (err) { return (err as Error).message; }
      }
      const a = db.admins.find((x) => x.id === id);
      if (!a) return null;
      if (a.id === me?.id) return "You can't remove your own account.";
      if (a.role === "owner" && db.admins.filter((x) => x.role === "owner").length === 1) return "The store needs at least one owner.";
      commit((d) => ({ ...d, admins: d.admins.filter((x) => x.id !== id) }));
      return null;
    },
    changePassword: async (id, pw) => {
      const h = await sha256(pw);
      if (REMOTE) { await call("changePassword", { id, passwordHash: h }, token); return; }
      commit((d) => ({ ...d, admins: d.admins.map((a) => (a.id === id ? { ...a, passwordHash: h } : a)) }));
    },
    markNoticesRead: () => undefined,
    saveSettings: (s) => {
      commit((d) => ({ ...d, settings: s }));
      if (REMOTE) enqueue(() => call("saveSettings", { settings: s }, token));
    },
    adminToken: token,
    sendPush: (r) => sendPushNow(r),
    pushStats: async () => {
      if (REMOTE) return call<{ subscribers: number; log: PushLogEntry[] }>("pushStats", {}, token);
      let local = false;
      try { local = !!localStorage.getItem("athar:push-local"); } catch { /* ignore */ }
      return { subscribers: local ? 1 : 0, log: readJSON<PushLogEntry[]>(LOCAL_PUSH_LOG, []) };
    },
    importCatalog: async () => {
      if (!REMOTE) return;
      await call("importCatalog", { products: SEED_PRODUCTS, settings: dbRef.current?.settings ?? SEED_SETTINGS }, token);
      const c = await call<{ products: Product[]; settings: Settings }>("catalog");
      safeSet(CATALOG_KEY, JSON.stringify(c));
      commit((d) => ({ ...d, products: c.products.filter(liveCategory).map(normalizeProduct), settings: withSettings(c.settings) }));
    },
    clearSamples: () => commit((d) => ({ ...d, orders: d.orders.filter((o) => !o.sample) })),
    resetAll: async () => {
      if (REMOTE) return;
      const d = await freshDB();
      safeSet(KEY, JSON.stringify(d));
      dbRef.current = d;
      setDb(d);
      setCart([]);
    },
    toast,
    toastMsg,
  };

  if (!value) {
    return (
      <div className="min-h-screen grid place-items-center bg-ink">
        <span className=" text-5xl text-topy animate-pulse">أثر</span>
      </div>
    );
  }
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

/** Price helpers shared by storefront and admin */
export function linePrice(p: Product, variantId?: string) {
  return p.variants.find((v) => v.id === variantId)?.price ?? p.price;
}
