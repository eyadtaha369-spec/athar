import { useCallback, useEffect, useRef, useState } from "react";
import type { Order } from "../lib/types";
import { useStore } from "../lib/store";

const SEEN_KEY = "athar:admin-last-seen";
const SOUND_KEY = "athar:admin-sound";

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

/** Short two-note chime made with Web Audio, so there's no sound file to load. */
function useChime() {
  const ctx = useRef<AudioContext | null>(null);
  useEffect(() => {
    const unlock = () => {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!ctx.current && AC) ctx.current = new AC();
        ctx.current?.resume();
      } catch { /* audio not available */ }
    };
    unlock(); // works right after the sign-in click
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);
  return useCallback(() => {
    const ac = ctx.current;
    if (!ac || ac.state !== "running") return;
    const now = ac.currentTime;
    [[880, 0], [1318.5, 0.16]].forEach(([f, t]) => {
      const o = ac.createOscillator(); const g = ac.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.25, now + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.5);
      o.connect(g).connect(ac.destination);
      o.start(now + t); o.stop(now + t + 0.55);
    });
  }, []);
}

/**
 * Watches the order list and raises an alert for every order that arrives while the
 * dashboard is open: banner, chime, tab title and (if allowed) a desktop notification.
 * Orders placed while the admin was away are counted as unread on the bell.
 */
export function useOrderAlerts(onOpen: (id: string) => void) {
  const { db, mode, lastSync, refreshOrders, toast } = useStore();
  const known = useRef<Set<string> | null>(null);
  const [alerts, setAlerts] = useState<Order[]>([]);
  const [lastSeen, setLastSeen] = useState<string>(() => {
    const v = get(SEEN_KEY);
    if (v) return v;
    const now = new Date().toISOString();
    set(SEEN_KEY, now);
    return now;
  });
  const [sound, setSound] = useState(() => get(SOUND_KEY) !== "off");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => ("Notification" in window ? Notification.permission : "unsupported"));
  const chime = useChime();
  const baseTitle = useRef(document.title);

  // Start watching once the first order list is in (sheets mode) or right away (demo mode)
  const ready = mode === "local" || lastSync !== null;

  useEffect(() => {
    if (!ready) return;
    const ids = db.orders.map((o) => o.id);
    if (!known.current) { known.current = new Set(ids); return; }
    const fresh = db.orders.filter((o) => !known.current!.has(o.id));
    if (!fresh.length) return;
    fresh.forEach((o) => known.current!.add(o.id));
    setAlerts((a) => [...fresh, ...a].slice(0, 4));
    toast(fresh.length === 1 ? `New Order Received! #${fresh[0].number} - Check Dashboard` : `${fresh.length} new orders received - Check Dashboard`);
    if (sound) chime();
    // When this device gets real push alerts, the system notification comes from the server already
    let pushOn = false;
    try { pushOn = mode === "sheets" && localStorage.getItem("athar:admin-push") === "1"; } catch { /* ignore */ }
    if (permission === "granted" && !pushOn) {
      fresh.forEach((o) => {
        try {
          const n = new Notification(`New Order Received! #${o.number} - Check Dashboard`, {
            body: `${o.customer.name} · ${o.total} EGP · ${o.payment.deposit} EGP deposit to verify`,
            tag: o.id,
          });
          n.onclick = () => { window.focus(); onOpen(o.id); n.close(); };
        } catch { /* notifications blocked in this context */ }
      });
    }
  }, [db.orders, ready, sound, permission, chime, onOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // A push for a new order reached this browser: pull the order list now instead of at the next check
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => { if (e.data?.type === "athar:new-order") refreshOrders(); };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [refreshOrders]);

  // Flash the tab title while alerts are waiting and the tab isn't in view
  useEffect(() => {
    if (!alerts.length) { document.title = baseTitle.current; return; }
    let on = false;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") { document.title = `(${alerts.length}) New order · ATHAR Admin`; return; }
      on = !on;
      document.title = on ? `● ${alerts[0].number} new order` : `(${alerts.length}) New order · ATHAR Admin`;
    }, 1200);
    return () => { window.clearInterval(t); document.title = baseTitle.current; };
  }, [alerts]);

  const unread = db.orders.filter((o) => o.createdAt > lastSeen).length;

  return {
    alerts,
    dismiss: (id: string) => setAlerts((a) => a.filter((o) => o.id !== id)),
    dismissAll: () => setAlerts([]),
    unread,
    lastSeen,
    markAllRead: () => { const now = new Date().toISOString(); set(SEEN_KEY, now); setLastSeen(now); setAlerts([]); },
    sound,
    toggleSound: () => setSound((s) => { set(SOUND_KEY, s ? "off" : "on"); if (!s) setTimeout(chime, 0); return !s; }),
    permission,
    enableDesktop: async () => {
      if (!("Notification" in window)) return;
      try { setPermission(await Notification.requestPermission()); } catch { /* blocked */ }
    },
  };
}
