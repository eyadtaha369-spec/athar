import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellOff, X } from "lucide-react";
import { Mark } from "./ui";
import { useStore } from "../lib/store";
import { cx } from "../lib/utils";
import { PushState, disablePush, dismissPrompt, enablePush, promptDismissedRecently, pushState, pushSupported } from "../lib/push";

const STATE_COPY: Partial<Record<PushState, string>> = {
  blocked: "Notifications are blocked for this site. Allow them from your browser's site settings.",
  "ios-install": "On iPhone, add ATHAR to your Home Screen first (Share → Add to Home Screen), then turn notifications on from there.",
  unsupported: "This browser doesn't support notifications.",
};

export function usePushState() {
  const [state, set] = useState<PushState | null>(null);
  useEffect(() => {
    pushState().then(set);
    const on = (e: Event) => set((e as CustomEvent<PushState>).detail);
    window.addEventListener("athar:push", on);
    return () => window.removeEventListener("athar:push", on);
  }, []);
  // every switch and prompt on the page stays in step
  const setState = (s: PushState) => window.dispatchEvent(new CustomEvent("athar:push", { detail: s }));
  return [state, setState] as const;
}

/**
 * Polite opt-in: appears once, after the visitor has browsed for a while (25 s or a second page),
 * never on checkout, and stays away for 14 days after "Not now".
 */
export function PushPrompt() {
  const loc = useLocation();
  const { toast } = useStore();
  const [state, setState] = usePushState();
  const [show, setShow] = useState(false);
  const [views, setViews] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setViews((v) => v + 1); }, [loc.pathname]);
  useEffect(() => {
    if (state !== "off" || promptDismissedRecently()) return;
    const t = window.setTimeout(() => setShow(true), 25000);
    return () => window.clearTimeout(t);
  }, [state]);
  useEffect(() => { if (state === "off" && views >= 3 && !promptDismissedRecently()) setShow(true); }, [views, state]);

  const hidden = !show || state !== "off" || loc.pathname.startsWith("/checkout");

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          role="dialog" aria-label="Turn on notifications"
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
          className="fixed z-[65] left-4 right-4 sm:right-auto sm:w-[360px] rounded-xl bg-fahmy text-sand p-4 shadow-[0_24px_60px_-20px_rgba(26,26,26,.6)]"
          style={{ bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", marginLeft: "env(safe-area-inset-left, 0px)" }}
        >
          <div className="flex gap-3">
            <Mark className="h-8 text-topy shrink-0 mt-0.5" label="" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Get new drops and order updates</p>
              <p className="text-sm text-ramady mt-1">We'll only send new flags, offers and news about your orders. You can turn it off any time.</p>
              <div className="flex gap-2 mt-3">
                <button
                  className="h-9 px-4 rounded-md bg-topy text-fahmy text-sm font-semibold inline-flex items-center gap-2"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const s = await enablePush();
                      setState(s);
                      toast(s === "on" ? "Notifications on. We'll keep it useful." : STATE_COPY[s] ?? "Notifications weren't turned on.");
                    } catch { toast("Couldn't turn on notifications. Try again in a moment."); }
                    setBusy(false); setShow(false);
                  }}
                >
                  <Bell size={15} />{busy ? "Turning on…" : "Turn on"}
                </button>
                <button className="h-9 px-3 rounded-md text-sm text-ramady hover:text-sand" onClick={() => { dismissPrompt(); setShow(false); }}>Not now</button>
              </div>
            </div>
            <button className="w-8 h-8 grid place-items-center rounded-md hover:bg-sand/10 shrink-0" aria-label="Close" onClick={() => { dismissPrompt(); setShow(false); }}><X size={16} /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Inline switch used in the footer and on the order page. `link` attaches an order to the subscription. */
export function PushToggle({ link, dark = false, label = "Notifications", className = "" }: { link?: { phones: string[]; orders: string[] }; dark?: boolean; label?: string; className?: string }) {
  const { toast } = useStore();
  const [state, setState] = usePushState();
  const [busy, setBusy] = useState(false);
  if (!pushSupported() && state !== "ios-install") return null;
  const on = state === "on";
  return (
    <div className={className}>
      <button
        type="button" role="switch" aria-checked={on} disabled={busy || state === null}
        onClick={async () => {
          setBusy(true);
          try {
            if (on) { await disablePush(); setState("off"); toast("Notifications off"); }
            else { const s = await enablePush(link); setState(s); toast(s === "on" ? "Notifications on" : STATE_COPY[s] ?? "Notifications weren't turned on."); }
          } catch { toast("Couldn't change notifications. Try again in a moment."); }
          setBusy(false);
        }}
        className={cx("inline-flex items-center gap-2.5 text-[15px] hover:text-topy", dark ? "text-sand" : "text-fahmy")}
      >
        {on ? <Bell size={16} /> : <BellOff size={16} className={dark ? "text-ramady" : "text-stone"} />}
        {label}: <span className={on ? (dark ? "text-topy" : "text-zeyti-dark") : dark ? "text-ramady" : "text-stone"}>{busy ? "…" : on ? "On" : "Off"}</span>
      </button>
      {state && STATE_COPY[state] && state !== "unsupported" && <p className={cx("text-xs mt-1 max-w-[34ch]", dark ? "text-ramady" : "text-stone")}>{STATE_COPY[state]}</p>}
    </div>
  );
}
