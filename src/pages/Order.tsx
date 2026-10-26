import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useStore } from "../lib/store";
import type { Order } from "../lib/types";
import { STATUS_META, cx, egp, fmtDate } from "../lib/utils";

const FLOW = ["pending", "confirmed", "shipped", "delivered"] as const;
const FLOW_COPY: Record<string, string> = {
  pending: "We're checking your transfer",
  confirmed: "Payment confirmed, preparing your order",
  shipped: "With the courier",
  delivered: "Delivered",
};

export function StatusTimeline({ o }: { o: Order }) {
  if (o.status === "cancelled") {
    return <div className="rounded-2xl bg-[#F1DCD3] text-topy-dark p-5">This order was cancelled. If you think this is a mistake, message us on WhatsApp with your order number.</div>;
  }
  const at = FLOW.indexOf(o.status as (typeof FLOW)[number]);
  return (
    <ol className="relative">
      {FLOW.map((s, i) => {
        const done = i <= at;
        const h = o.history.find((x) => x.status === s);
        return (
          <li key={s} className="flex gap-4 pb-7 last:pb-0 relative">
            {i < FLOW.length - 1 && <span className={cx("absolute left-[15px] top-8 bottom-0 w-[2px]", i < at ? "bg-zeyti" : "bg-fahmy/10")} />}
            <span className={cx("w-8 h-8 rounded-full grid place-items-center shrink-0 z-[1]", done ? "bg-zeyti text-sand" : "bg-ramly text-stone")}>
              {done ? <Check size={15} /> : <span className="tnum text-xs">{i + 1}</span>}
            </span>
            <div className="pt-1">
              <p className={cx("font-medium", !done && "text-stone")}>{STATUS_META[s].label} <span className="font-ar text-sm text-stone" lang="ar">· {STATUS_META[s].ar}</span></p>
              <p className="text-sm text-stone">{done && h ? fmtDate(h.at, true) : FLOW_COPY[s]}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderDone() {
  const { number } = useParams();
  const { db } = useStore();
  const loc = useLocation() as { state?: { fresh?: boolean } };
  const o = db.orders.find((x) => x.number === number);
  if (!o) return <Track />;
  const fresh = loc.state?.fresh;

  return (
    <div className="pt-28 md:pt-36 pb-24 gutter max-w-[1100px] mx-auto">
      {fresh && (
        <motion.p initial={{ scale: 0.6, opacity: 0, rotate: -10 }} animate={{ scale: 1, opacity: 1, rotate: -6 }} transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
          className="font-ruqaa text-topy text-7xl md:text-8xl leading-none" lang="ar">شكراً</motion.p>
      )}
      <h1 className="display text-5xl md:text-8xl mt-4">{fresh ? "Order placed" : `Order ${o.number}`}</h1>
      <p className="text-stone mt-3 max-w-[56ch] text-lg">
        {fresh ? <>Your order number is <b className="text-fahmy tnum">{o.number}</b>. We're checking your transfer now and will message you on WhatsApp at <span className="tnum">{o.customer.phone}</span> once it's confirmed.</>
          : <>Placed {fmtDate(o.createdAt, true)}.</>}
      </p>

      <div className="grid md:grid-cols-[1fr_1fr] gap-8 mt-12">
        <div className="rounded-[24px] bg-paper border border-fahmy/10 p-6">
          <h2 className="font-semibold mb-5">Order status</h2>
          <StatusTimeline o={o} />
        </div>
        <div className="rounded-[24px] bg-paper border border-fahmy/10 p-6">
          <h2 className="font-semibold mb-3">What you ordered</h2>
          <ul className="divide-y divide-fahmy/10 text-[15px]">
            {o.lines.map((l, i) => (
              <li key={i} className="py-3 flex justify-between gap-4">
                <div className="min-w-0"><p>{l.qty} × {l.name}</p><p className="text-sm text-stone">{[l.variant, l.custom && `“${l.custom}”`].filter(Boolean).join(", ")}</p></div>
                <span className="tnum shrink-0">{egp(l.unitPrice * l.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="pt-3 border-t border-fahmy/10 space-y-1.5 tnum text-[15px]">
            <div className="flex justify-between"><dt className="text-stone">Delivery to {o.shipping.governorate}</dt><dd>{o.shippingFee ? egp(o.shippingFee) : "Free"}</dd></div>
            <div className="flex justify-between font-semibold text-lg"><dt>Total paid</dt><dd>{egp(o.total)}</dd></div>
          </dl>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 mt-10">
        <Link to="/shop" className="btn-dark">Keep browsing</Link>
        <Link to="/track" className="btn-line">Track another order</Link>
      </div>
    </div>
  );
}

export function Track() {
  const { db } = useStore();
  const [num, setNum] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<Order | null | "none">(null);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const n = num.trim().toUpperCase().replace(/^(\d)/, "ATH-$1");
    const o = db.orders.find((x) => x.number === n && x.customer.phone === phone.replace(/\s/g, ""));
    setResult(o ?? "none");
  };

  return (
    <div className="pt-28 md:pt-36 pb-24 gutter max-w-[900px] mx-auto">
      <p className="font-ar text-topy text-xl" lang="ar">تتبع طلبك</p>
      <h1 className="display text-5xl md:text-8xl">Track your order</h1>
      <p className="text-stone mt-3">Enter the order number from your confirmation and the mobile number you ordered with.</p>
      <form onSubmit={go} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 mt-8">
        <input id="track-num" className="field tnum" placeholder="ATH-1042" value={num} onChange={(e) => setNum(e.target.value)} aria-label="Order number" required />
        <input id="track-phone" className="field tnum" placeholder="01xxxxxxxxx" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Mobile number" required />
        <button className="btn-dark">Find order</button>
      </form>
      {result === "none" && <p className="mt-6 text-topy" role="alert">No order matches that number and mobile. Check both and try again.</p>}
      {result && result !== "none" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-10 rounded-[24px] bg-paper border border-fahmy/10 p-6">
          <div className="flex flex-wrap justify-between gap-2 mb-6">
            <p className="font-semibold tnum">{result.number}</p>
            <p className="text-stone text-sm">{fmtDate(result.createdAt)} · {egp(result.total)}</p>
          </div>
          <StatusTimeline o={result} />
        </motion.div>
      )}
    </div>
  );
}
