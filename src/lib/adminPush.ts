/**
 * Admin-only order alerts. A signed-in admin turns them on per device (phone or laptop);
 * the subscription is saved in the AdminDevices sheet, separate from customer subscribers.
 * When a customer places an order, the Apps Script backend pushes to these devices only.
 */
import { VAPID_PUBLIC_KEY } from "../config";
import { REMOTE, call } from "./api";
import { keyBytes, pushSupported, registerServiceWorker } from "./push";

const FLAG = "athar:admin-push";
const setFlag = (on: boolean) => { try { on ? localStorage.setItem(FLAG, "1") : localStorage.removeItem(FLAG); } catch { /* ignore */ } };
const flag = () => { try { return localStorage.getItem(FLAG) === "1"; } catch { return false; } };

export type AdminPushState = "unsupported" | "ios-install" | "blocked" | "off" | "on";
export type AdminDevice = { id: string; adminName: string; device: string; createdAt: string; mine: boolean };
export type AdminPushInfo = { configured: boolean; devices: AdminDevice[] };

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export function deviceName() {
  const ua = navigator.userAgent;
  const os = /iphone/i.test(ua) ? "iPhone" : /ipad/i.test(ua) ? "iPad" : /android/i.test(ua) ? "Android" : /mac os/i.test(ua) ? "Mac" : /windows/i.test(ua) ? "Windows" : /linux/i.test(ua) ? "Linux" : "Device";
  const br = /edg\//i.test(ua) ? "Edge" : /opr\//i.test(ua) ? "Opera" : /samsungbrowser/i.test(ua) ? "Samsung Internet" : /firefox|fxios/i.test(ua) ? "Firefox" : /chrome|crios/i.test(ua) ? "Chrome" : /safari/i.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}

export async function adminPushState(): Promise<AdminPushState> {
  if (!pushSupported()) return isIOS() && !standalone() ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (!REMOTE) return Notification.permission === "granted" && flag() ? "on" : "off";
  const r = await registerServiceWorker();
  const sub = await r?.pushManager.getSubscription().catch(() => null);
  return sub && flag() && Notification.permission === "granted" ? "on" : "off";
}

/** Must run from a click. In demo mode it only asks for permission (alerts come from the open dashboard). */
export async function enableAdminPush(token: string | null): Promise<AdminPushState> {
  if (!pushSupported()) return isIOS() && !standalone() ? "ios-install" : "unsupported";
  const p = await Notification.requestPermission();
  if (p !== "granted") return p === "denied" ? "blocked" : "off";
  if (REMOTE) {
    const r = await registerServiceWorker();
    if (!r) return "unsupported";
    await navigator.serviceWorker.ready;
    let sub = await r.pushManager.getSubscription();
    if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
    await call("subscribeAdminPush", { subscription: sub.toJSON(), device: deviceName() }, token);
  }
  setFlag(true);
  return "on";
}

export async function disableAdminPush(token: string | null) {
  setFlag(false);
  if (!REMOTE) return;
  const r = await registerServiceWorker();
  const sub = await r?.pushManager.getSubscription().catch(() => null);
  if (!sub) return;
  await call("unsubscribeAdminPush", { endpoint: sub.endpoint }, token).catch(() => undefined);
  // keep the subscription if this browser also gets store updates as a customer
  let customer = false;
  try { customer = !!localStorage.getItem("athar:push-customer"); } catch { /* ignore */ }
  if (!customer) await sub.unsubscribe().catch(() => undefined);
}

export async function adminPushInfo(token: string | null): Promise<AdminPushInfo> {
  if (!REMOTE) return { configured: true, devices: flag() ? [{ id: "local", adminName: "You", device: deviceName(), createdAt: new Date().toISOString(), mine: true }] : [] };
  return call<AdminPushInfo>("adminPushInfo", {}, token);
}

/** Removes a device from the alert list (your own, or anyone's if you're the owner). */
export async function removeAdminDevice(token: string | null, id: string) {
  return call<AdminPushInfo>("unsubscribeAdminPush", { id }, token);
}

export async function testAdminPush(token: string | null): Promise<{ configured: boolean; targets: number; sent: number; error?: string }> {
  if (!REMOTE) {
    const r = await registerServiceWorker();
    if (r && Notification.permission === "granted") {
      await r.showNotification("ATHAR order alerts are on", { body: "New orders will show up here.", icon: "/icon-192.png", badge: "/favicon-32.png", tag: "athar-test", data: { url: "/admin/orders" } });
      return { configured: true, targets: 1, sent: 1 };
    }
    return { configured: true, targets: 0, sent: 0 };
  }
  return call("testAdminPush", {}, token);
}
