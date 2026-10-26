import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Search, X, ZoomIn } from "lucide-react";
import { useStore } from "../lib/store";
import { PageHead } from "./AdminLayout";
import { STATUS_META, cx, egp, fmtDate } from "../lib/utils";
import type { Order, OrderStatus } from "../lib/types";

const TABS: (OrderStatus | "all")[] = ["all", "pending", "confirmed", "shipped", "delivered", "cancelled"];
const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  pending: { to: "confirmed", label: "Confirm payment" },
  confirmed: { to: "shipped", label: "Mark as shipped" },
  shipped: { to: "delivered", label: "Mark as delivered" },
};
const METHOD: Record<string, string> = { instapay: "InstaPay", wallet: "Mobile wallet", bank: "Bank transfer" };

function Badge({ s }: { s: OrderStatus }) {
  return <span className={cx("inline-block rounded-full px-2.5 py-1 text-xs whitespace-nowrap", STATUS_META[s].cls)}>{STATUS_META[s].label}</span>;
}

function OrderDrawer({ o, onClose }: { o: Order; onClose: () => void }) {
  const { setOrderStatus, verifyPayment, toast } = useStore();
  const [zoom, setZoom] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [note, setNote] = useState("");
  const next = NEXT[o.status];

  const waText = `Hi ${o.customer.name.split(" ")[0]}, this is ATHAR. Your order ${o.number} (${egp(o.total)}) is ${STATUS_META[o.status].label.toLowerCase()}. Thank you!`;

  return (
    <>
      <motion.div className="fixed inset-0 z-[60] bg-fahmy/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside role="dialog" aria-label={`Order ${o.number}`}
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 34, stiffness: 320 }}
        className="fixed right-0 top-0 bottom-0 z-[61] w-full max-w-[640px] bg-sand overflow-y-auto"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="sticky top-0 bg-sand/95 backdrop-blur z-10 px-5 md:px-7 h-16 flex items-center justify-between border-b border-fahmy/10">
          <div className="flex items-center gap-3"><span className="display text-xl tnum">{o.number}</span><Badge s={o.status} /></div>
          <button onClick={onClose} className="w-10 h-10 grid place-items-center rounded-full hover:bg-ramly" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="px-5 md:px-7 py-6 space-y-6">
          {o.sample && <p className="text-xs rounded-lg bg-ramly px-3 py-2 text-stone">Sample order for demonstration.</p>}

          {/* Payment verification — the main job on this screen */}
          <section className="rounded-2xl bg-paper border border-fahmy/10 p-5">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h3 className="font-semibold">Payment</h3>
                <p className="text-sm text-stone mt-0.5">{METHOD[o.payment.method]} from {o.payment.senderName || "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-stone">Expected amount</p>
                <p className="display tnum text-2xl">{egp(o.total)}</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-[160px_1fr] gap-5 mt-4">
              <button onClick={() => setZoom(true)} className="group relative rounded-xl overflow-hidden bg-ramly aspect-[9/14] border border-fahmy/10" aria-label="Open receipt full size">
                <img src={o.payment.receipt} alt="Customer transfer receipt" className="w-full h-full object-cover object-top" />
                <span className="absolute inset-0 bg-fahmy/0 group-hover:bg-fahmy/30 grid place-items-center text-sand opacity-0 group-hover:opacity-100 transition"><ZoomIn /></span>
              </button>
              <div className="space-y-3 text-sm">
                <dl className="space-y-2">
                  <div className="flex justify-between gap-3"><dt className="text-stone">Reference</dt><dd className="tnum select-all">{o.payment.reference || "Not provided"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-stone">Submitted</dt><dd>{fmtDate(o.createdAt, true)}</dd></div>
                </dl>
                <p className="text-stone leading-relaxed">Check the receipt shows <b className="text-fahmy tnum">{egp(o.total)}</b> sent to your account, and that the date is on or before the order date.</p>
                <label className="flex items-center gap-3 rounded-xl border border-fahmy/15 p-3 cursor-pointer select-none">
                  <input type="checkbox" className="w-5 h-5 accent-[#606859]" checked={o.paymentVerified} onChange={(e) => { verifyPayment(o.id, e.target.checked); toast(e.target.checked ? "Payment marked as verified" : "Verification removed"); }} />
                  <span>Payment received and matches</span>
                </label>
              </div>
            </div>
          </section>

          {/* Status actions */}
          {o.status !== "delivered" && o.status !== "cancelled" && (
            <section className="flex flex-wrap gap-3">
              {next && (
                <button
                  className="btn-dark flex-1"
                  disabled={o.status === "pending" && !o.paymentVerified}
                  title={o.status === "pending" && !o.paymentVerified ? "Tick “Payment received and matches” first" : undefined}
                  onClick={() => { setOrderStatus(o.id, next.to); toast(`${o.number} ${STATUS_META[next.to].label.toLowerCase()}`); }}
                >
                  <Check size={16} /> {next.label}
                </button>
              )}
              {!cancelling ? (
                <button className="btn-line" onClick={() => setCancelling(true)}>Cancel order</button>
              ) : null}
            </section>
          )}
          {o.status === "pending" && !o.paymentVerified && <p className="text-sm text-stone -mt-3">Tick “Payment received and matches” to confirm this order.</p>}
          <AnimatePresence>
            {cancelling && (
              <motion.section initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="rounded-2xl border border-topy/40 p-4 space-y-3">
                  <label htmlFor="cancel-note" className="label">Reason (saved in the order history)</label>
                  <input id="cancel-note" className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Transfer amount didn't match" />
                  <div className="flex gap-2">
                    <button className="btn bg-topy text-white hover:bg-topy-dark" onClick={() => { setOrderStatus(o.id, "cancelled", note || undefined); setCancelling(false); toast(`${o.number} cancelled, stock returned`); }}>Cancel order</button>
                    <button className="btn-line" onClick={() => setCancelling(false)}>Keep order</button>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Customer */}
          <section className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-paper border border-fahmy/10 p-5 text-sm">
              <h3 className="font-semibold mb-2 text-base">Customer</h3>
              <p>{o.customer.name}</p>
              <p className="tnum select-all">{o.customer.phone}</p>
              {o.customer.email && <p className="select-all break-all">{o.customer.email}</p>}
              <a href={`https://wa.me/2${o.customer.phone}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer" className="inline-block mt-3 text-topy underline underline-offset-2">Message on WhatsApp</a>
            </div>
            <div className="rounded-2xl bg-paper border border-fahmy/10 p-5 text-sm">
              <h3 className="font-semibold mb-2 text-base">Deliver to</h3>
              <p className="select-all">{o.shipping.address}</p>
              <p>{o.shipping.city}, {o.shipping.governorate}</p>
              {o.shipping.notes && <p className="text-stone mt-2">“{o.shipping.notes}”</p>}
            </div>
          </section>

          {/* Items */}
          <section className="rounded-2xl bg-paper border border-fahmy/10 p-5">
            <h3 className="font-semibold mb-2">Items</h3>
            <ul className="divide-y divide-fahmy/10 text-sm">
              {o.lines.map((l, i) => (
                <li key={i} className="py-2.5 flex justify-between gap-3">
                  <div><p>{l.qty} × {l.name}</p><p className="text-stone">{[l.variant, l.custom && `Custom text: “${l.custom}”`].filter(Boolean).join(" — ")}</p></div>
                  <span className="tnum shrink-0">{egp(l.unitPrice * l.qty)}</span>
                </li>
              ))}
            </ul>
            <dl className="pt-3 border-t border-fahmy/10 text-sm space-y-1 tnum">
              <div className="flex justify-between"><dt className="text-stone">Subtotal</dt><dd>{egp(o.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-stone">Delivery</dt><dd>{o.shippingFee ? egp(o.shippingFee) : "Free"}</dd></div>
              <div className="flex justify-between font-semibold text-base"><dt>Total</dt><dd>{egp(o.total)}</dd></div>
            </dl>
          </section>

          {/* History */}
          <section>
            <h3 className="font-semibold mb-3">History</h3>
            <ol className="space-y-3 text-sm">
              {[...o.history].reverse().map((h, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-2 h-2 rounded-full bg-zeyti mt-1.5 shrink-0" />
                  <div><p><b>{STATUS_META[h.status].label}</b>{h.by && <span className="text-stone"> by {h.by}</span>}</p><p className="text-stone">{fmtDate(h.at, true)}{h.note && ` — ${h.note}`}</p></div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </motion.aside>

      <AnimatePresence>
        {zoom && (
          <motion.div className="fixed inset-0 z-[70] bg-fahmy/90 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoom(false)}>
            <img src={o.payment.receipt} alt="Customer transfer receipt, full size" className="max-h-[90vh] max-w-full rounded-xl" />
            <button className="absolute top-4 right-4 w-11 h-11 grid place-items-center rounded-full bg-sand text-fahmy" aria-label="Close receipt" style={{ marginTop: "env(safe-area-inset-top, 0px)" }}><X size={18} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function Orders() {
  const { db } = useStore();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get("s") as OrderStatus | "all") || "all";
  const openId = sp.get("o");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    let l = db.orders.filter((o) => tab === "all" || o.status === tab);
    const t = q.trim().toLowerCase();
    if (t) l = l.filter((o) => o.number.toLowerCase().includes(t) || o.customer.name.toLowerCase().includes(t) || o.customer.phone.includes(t));
    return l;
  }, [db.orders, tab, q]);
  const open = db.orders.find((o) => o.id === openId);

  const setParam = (k: string, v?: string) => {
    const n = new URLSearchParams(sp);
    v ? n.set(k, v) : n.delete(k);
    setSp(n, { replace: true });
  };

  return (
    <>
      <PageHead title="Orders" sub="Check each receipt, then move the order along." />
      <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
        <div className="flex gap-1 overflow-x-auto no-scrollbar max-w-full">
          {TABS.map((t) => {
            const n = t === "all" ? db.orders.length : db.orders.filter((o) => o.status === t).length;
            return (
              <button key={t} onClick={() => setParam("s", t === "all" ? undefined : t)}
                className={cx("shrink-0 h-9 px-3.5 rounded-full text-sm inline-flex items-center gap-2", tab === t ? "bg-fahmy text-sand" : "text-stone hover:text-fahmy")}>
                {t === "all" ? "All" : STATUS_META[t].label}<span className={cx("tnum text-xs", tab === t ? "text-sand/60" : "text-stone/70")}>{n}</span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone" />
          <input id="order-search" className="field h-10 pl-10" placeholder="Order number, name or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-fahmy/20 py-16 text-center">
          <p className="font-medium">No orders here</p>
          <p className="text-stone text-sm mt-1">{q ? "Try another search." : "New orders appear here the moment a customer checks out."}</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-paper border border-fahmy/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="text-left text-stone border-b border-fahmy/10">
                <tr><th className="font-normal px-4 py-3">Order</th><th className="font-normal px-4 py-3">Customer</th><th className="font-normal px-4 py-3">Items</th><th className="font-normal px-4 py-3">Payment</th><th className="font-normal px-4 py-3">Status</th><th className="font-normal px-4 py-3 text-right">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-fahmy/10">
                {list.map((o) => (
                  <tr key={o.id} onClick={() => setParam("o", o.id)} className="cursor-pointer hover:bg-ramly/40">
                    <td className="px-4 py-3.5"><button className="font-medium tnum hover:text-topy text-left" onClick={(e) => { e.stopPropagation(); setParam("o", o.id); }}>{o.number}</button><p className="text-xs text-stone">{fmtDate(o.createdAt, true)}</p></td>
                    <td className="px-4 py-3.5"><p>{o.customer.name}</p><p className="text-xs text-stone">{o.shipping.governorate}</p></td>
                    <td className="px-4 py-3.5 text-stone max-w-[220px] truncate">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</td>
                    <td className="px-4 py-3.5">
                      {o.paymentVerified ? <span className="inline-flex items-center gap-1 text-zeyti"><Check size={14} />Verified</span> : o.status === "cancelled" ? <span className="text-stone">—</span> : <span className="text-[#7A5317]">To check</span>}
                    </td>
                    <td className="px-4 py-3.5"><Badge s={o.status} /></td>
                    <td className="px-4 py-3.5 text-right tnum font-medium">{egp(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>{open && <OrderDrawer key={open.id} o={open} onClose={() => setParam("o")} />}</AnimatePresence>
    </>
  );
}
