/**
 * Web Push on the customer side: service worker, permission, subscription.
 * Subscriptions are saved in the Google Sheet (Subscribers tab) and linked to the customer's
 * order numbers and phone, so order-status pushes reach the right person.
 * In demo mode (no backend) the subscription is kept in this browser only.
 */
import { VAPID_PUBLIC_KEY } from "../config";
import { REMOTE, call } from "./api";

const LOCAL_KEY = "athar:push-local";
const DISMISS_KEY = "athar:push-dismissed";

export type PushState = "unsupported" | "ios-install" | "blocked" | "off" | "on";

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export const pushSupported = () =>
  !__SINGLE__ && typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

let reg: Promise<ServiceWorkerRegistration | null> | null = null;
export function registerServiceWorker() {
  if (!pushSupported()) return Promise.resolve(null);
  if (!reg) reg = navigator.serviceWorker.register("/sw.js").catch(() => null);
  return reg;
}

export function keyBytes(base64url: string) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function pushState(): Promise<PushState> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return isIOS() && !isStandalone() ? "ios-install" : "unsupported";
  if (!("PushManager" in window)) return isIOS() && !isStandalone() ? "ios-install" : "unsupported";
  if (__SINGLE__) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const r = await registerServiceWorker();
  const sub = await r?.pushManager.getSubscription().catch(() => null);
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** Asks for permission (must run from a click), subscribes, and saves the subscription. */
export async function enablePush(link: { phones?: string[]; orders?: string[] } = {}): Promise<PushState> {
  if (!pushSupported()) return isIOS() && !isStandalone() ? "ios-install" : "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const r = await registerServiceWorker();
  if (!r) return "unsupported";
  await navigator.serviceWorker.ready;
  let sub = await r.pushManager.getSubscription();
  if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
  await saveSubscription(sub, link);
  return "on";
}

async function saveSubscription(sub: PushSubscription, link: { phones?: string[]; orders?: string[] }) {
  const json = sub.toJSON();
  if (REMOTE) {
    await call("subscribePush", { subscription: json, phones: link.phones ?? [], orders: link.orders ?? [] });
    try { localStorage.setItem("athar:push-customer", "1"); } catch { /* ignore */ }
  }
  else {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ endpoint: json.endpoint, ...link })); } catch { /* ignore */ }
  }
}

/** After an order is placed on a subscribed device, attach the order so status updates reach it. */
export async function linkOrderToPush(number: string, phone: string) {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const r = await registerServiceWorker();
  const sub = await r?.pushManager.getSubscription().catch(() => null);
  if (sub) await saveSubscription(sub, { orders: [number], phones: [phone] }).catch(() => undefined);
}

export async function disablePush() {
  const r = await registerServiceWorker();
  const sub = await r?.pushManager.getSubscription().catch(() => null);
  if (!sub) return;
  const endpoint = sub.endpoint;
  // the same browser subscription also carries admin order alerts; keep it alive for those
  let adminAlerts = false;
  try { adminAlerts = localStorage.getItem("athar:admin-push") === "1"; } catch { /* ignore */ }
  if (!adminAlerts) await sub.unsubscribe().catch(() => undefined);
  try { localStorage.removeItem("athar:push-customer"); } catch { /* ignore */ }
  if (REMOTE) await call("unsubscribePush", { endpoint }).catch(() => undefined);
  else try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignore */ }
}

/** Demo mode only: shows a notification on this device, as a stand-in for a real broadcast. */
export async function showLocalNotification(n: { title: string; body: string; url?: string }) {
  const r = await registerServiceWorker();
  if (!r || Notification.permission !== "granted") return false;
  await r.showNotification(n.title, { body: n.body, icon: "/icon-192.png", badge: "/favicon-32.png", data: { url: n.url || "/" }, tag: "athar-demo" });
  return true;
}

export const promptDismissedRecently = () => {
  try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < 14 * 864e5; } catch { return false; }
};
export const dismissPrompt = () => { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ } };
