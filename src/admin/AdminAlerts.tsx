import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BellRing, Laptop, Share, Smartphone, Trash2 } from "lucide-react";
import { useStore } from "../lib/store";
import { REMOTE } from "../lib/api";
import { cx, fmtDate } from "../lib/utils";
import {
  AdminPushInfo, AdminPushState, adminPushInfo, adminPushState, disableAdminPush, enableAdminPush, removeAdminDevice, testAdminPush,
} from "../lib/adminPush";

const STATE_COPY: Partial<Record<AdminPushState, string>> = {
  blocked: "Notifications are blocked for this site. Allow them in the browser's site settings, then try again.",
  "ios-install": "On iPhone: in Safari tap Share → Add to Home Screen, open ATHAR from the Home Screen, go to Admin login at the bottom and turn alerts on there.",
  unsupported: "This browser can't receive push alerts. Try Chrome, Edge, Firefox or Safari.",
};

/** Shared state for this device's admin alerts, kept in step across the header button and the settings card. */
export function useAdminPush(onEnabled?: () => void) {
  const { adminToken, toast } = useStore();
  const [state, set] = useState<AdminPushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    adminPushState().then(set);
    const on = (e: Event) => set((e as CustomEvent<AdminPushState>).detail);
    window.addEventListener("athar:admin-push", on);
    return () => window.removeEventListener("athar:admin-push", on);
  }, []);
  const publish = (s: AdminPushState) => window.dispatchEvent(new CustomEvent("athar:admin-push", { detail: s }));

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const s = await enableAdminPush(adminToken);
      publish(s);
      if (s === "on") { onEnabled?.(); toast("Order alerts on for this device"); }
      else toast(STATE_COPY[s] ?? "Alerts weren't turned on.");
    } catch (e) { toast((e as Error).message || "Couldn't turn on alerts. Try again."); }
    setBusy(false);
  }, [adminToken, toast, onEnabled]);

  const disable = useCallback(async () => {
    setBusy(true);
    try { await disableAdminPush(adminToken); publish("off"); toast("Order alerts off for this device"); }
    catch { toast("Couldn't turn alerts off. Try again."); }
    setBusy(false);
  }, [adminToken, toast]);

  return { state, busy, enable, disable };
}

/** Header shortcut, shown until this device has alerts on. */
export function AlertsHeaderButton({ onEnabled }: { onEnabled?: () => void }) {
  const { state, busy, enable } = useAdminPush(onEnabled);
  if (state === null || state === "on" || state === "unsupported") return null;
  return (
    <button onClick={enable} disabled={busy}
      className="inline-flex items-center gap-2 h-9 px-3 rounded-full text-xs border border-ramady/70 hover:border-fahmy"
      title="Get a notification on this phone or computer for every new order, even when the dashboard is closed">
      <BellRing size={14} /><span className="hidden sm:inline">{busy ? "Turning on…" : "Get order alerts"}</span>
    </button>
  );
}

/** Card on the Push page: this device's switch, a test button and every admin device that gets alerts. */
export function AdminAlertsCard({ onEnabled }: { onEnabled?: () => void }) {
  const { adminToken, me, toast } = useStore();
  const { state, busy, enable, disable } = useAdminPush(onEnabled);
  const [info, setInfo] = useState<AdminPushInfo | null>(null);
  const [testing, setTesting] = useState(false);
  const load = useCallback(() => { adminPushInfo(adminToken).then(setInfo).catch(() => undefined); }, [adminToken]);
  useEffect(() => { load(); }, [load, state]);

  const on = state === "on";
  return (
    <section className="rounded-2xl bg-paper border border-ramady/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><BellRing size={16} />New-order alerts</h2>
          <p className="text-sm text-stone mt-1">For you and your team only. Customers never get these.</p>
        </div>
        <button type="button" role="switch" aria-checked={on} disabled={busy || state === null || state === "unsupported"}
          onClick={on ? disable : enable}
          className={cx("relative w-12 h-7 rounded-full shrink-0 transition-colors", on ? "bg-zeyti" : "bg-ramady")}
          aria-label="Order alerts on this device">
          <span className={cx("absolute top-1 w-5 h-5 rounded-full bg-paper transition-all", on ? "left-6" : "left-1")} />
        </button>
      </div>
      <p className="text-sm mt-3"><span className="text-stone">This device:</span> {busy ? "…" : on ? "On" : "Off"}</p>
      {state && STATE_COPY[state] && <p className="text-xs text-topy-dark mt-1">{STATE_COPY[state]}</p>}
      <p className="text-xs text-stone mt-2">You'll get "طلب جديد من أثر! 🛒" with the order total the moment a customer submits an order, even with the site closed.</p>

      {on && (
        <button className="btn-dark h-9 px-4 mt-3 text-xs" disabled={testing}
          onClick={async () => {
            setTesting(true);
            try {
              const r = await testAdminPush(adminToken);
              if (!r.configured) toast("Alerts aren't connected yet. Finish the setup below.");
              else if (r.error) toast(r.error);
              else toast(r.sent ? `Test sent to ${r.sent} ${r.sent === 1 ? "device" : "devices"}` : "No device received it. Turn alerts off and on again.");
            } catch (e) { toast((e as Error).message); }
            setTesting(false); load();
          }}>
          {testing ? "Sending…" : "Send a test alert"}
        </button>
      )}

      {REMOTE && info && !info.configured && (
        <div className="mt-4 rounded-xl bg-[#F1DCD3] p-3 text-sm text-fahmy">
          <p className="font-medium">Finish the setup so alerts reach phones</p>
          <ol className="list-decimal pl-5 mt-1 space-y-1 text-xs">
            <li>Apps Script → Project Settings → Script properties: add <b>ADMIN_URL</b> (your site address) and <b>PUSH_SECRET</b>.</li>
            <li>Vercel → Settings → Environment Variables: add <b>ADMIN_PUSH_SECRET</b> (same value) and <b>VAPID_PRIVATE_KEY</b>, then redeploy.</li>
          </ol>
        </div>
      )}

      {info && info.devices.length > 0 && (
        <div className="mt-4 pt-4 border-t border-ramady/50">
          <p className="text-sm font-medium mb-2">Devices getting alerts</p>
          <ul className="space-y-2">
            {info.devices.map((d) => {
              const phone = /iphone|ipad|android/i.test(d.device);
              const canRemove = REMOTE && (d.mine || me?.role === "owner");
              return (
                <li key={d.id} className="flex items-center gap-3 text-sm">
                  {phone ? <Smartphone size={16} className="text-stone shrink-0" /> : <Laptop size={16} className="text-stone shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{d.device || "Device"}{d.mine ? "" : ` · ${d.adminName}`}</p>
                    <p className="text-xs text-stone">Since {fmtDate(d.createdAt)}</p>
                  </div>
                  {canRemove && (
                    <button className="w-8 h-8 grid place-items-center rounded-md hover:bg-ramly" aria-label={`Stop alerts on ${d.device}`}
                      onClick={async () => { try { setInfo(await removeAdminDevice(adminToken, d.id)); toast("Device removed"); } catch (e) { toast((e as Error).message); } }}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

const PROMPT_KEY = "athar:admin-push-asked";
const askedRecently = () => { try { return Date.now() - Number(localStorage.getItem(PROMPT_KEY) || 0) < 3 * 864e5; } catch { return false; } };
const markAsked = () => { try { localStorage.setItem(PROMPT_KEY, String(Date.now())); } catch { /* ignore */ } };

/**
 * Shown once after an admin signs in on a device that doesn't get order alerts yet.
 * "Later" hides it for 3 days; the header button stays available any time.
 */
export function AdminPushPrompt({ onEnabled }: { onEnabled?: () => void }) {
  const { state, busy, enable } = useAdminPush(onEnabled);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if ((state === "off" || state === "ios-install") && !askedRecently()) {
      const t = window.setTimeout(() => setOpen(true), 900);
      return () => window.clearTimeout(t);
    }
    if (state === "on") setOpen(false);
  }, [state]);
  const close = () => { markAsked(); setOpen(false); };
  const ios = state === "ios-install";

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] grid place-items-end sm:place-items-center bg-fahmy/50 p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="ap-title"
            className="w-full max-w-[420px] rounded-2xl bg-paper p-6 shadow-[0_30px_80px_-30px_rgba(26,26,26,.7)]"
            style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
            initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
            <span className="w-12 h-12 rounded-xl bg-fahmy text-sand grid place-items-center"><BellRing size={22} /></span>
            <h2 id="ap-title" className="text-xl font-semibold mt-4">Enable push notifications</h2>
            <p className="text-lg mt-0.5 w-fit" lang="ar" dir="rtl">فعّل إشعارات الطلبات</p>
            {ios ? (
              <p className="text-sm text-stone mt-3">
                On iPhone, alerts work from the Home Screen app: tap <Share size={14} className="inline -mt-0.5" /> Share → <b>Add to Home Screen</b>,
                open ATHAR from there, tap <b>Admin login</b> at the bottom, sign in and turn alerts on.
              </p>
            ) : (
              <p className="text-sm text-stone mt-3">
                Get a notification on this {/android|iphone|ipad/i.test(navigator.userAgent) ? "phone" : "computer"} the moment a customer places an order,
                with sound, even when the site is closed. Only admins get these.
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {ios ? (
                <button className="btn-dark h-11 px-5" onClick={close}>Got it</button>
              ) : (
                <button className="btn-dark h-11 px-5" disabled={busy} onClick={async () => { await enable(); close(); }}>
                  <BellRing size={16} />{busy ? "Turning on…" : "Enable notifications"}
                </button>
              )}
              <button className="h-11 px-4 rounded-md text-sm text-stone hover:text-fahmy" onClick={close}>Later</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
