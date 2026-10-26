import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { PageHead } from "./AdminLayout";
import { ProductImage } from "../components/ui";
import { CATEGORY_LABEL, STATUS_META, cx, egp, fmtDate } from "../lib/utils";

const PAID = ["confirmed", "shipped", "delivered"];

function RevenueChart({ days }: { days: { label: string; value: number; orders: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.value));
  const nice = Math.ceil(max / 500) * 500 || 500;
  const W = 720, H = 240, pl = 48, pb = 28, pt = 12;
  const bw = (W - pl) / days.length;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px] h-auto" role="img" aria-label="Revenue per day">
        {[0, 0.5, 1].map((t) => {
          const y = pt + (H - pb - pt) * (1 - t);
          return (
            <g key={t}>
              <line x1={pl} x2={W} y1={y} y2={y} stroke="#222" strokeOpacity=".08" />
              <text x={pl - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#7A736A" className="tnum">{(nice * t).toLocaleString()}</text>
            </g>
          );
        })}
        {days.map((d, i) => {
          const h = ((H - pb - pt) * d.value) / nice;
          const x = pl + i * bw + bw * 0.18;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pl + i * bw} y={pt} width={bw} height={H - pb - pt} fill="transparent" />
              <rect x={x} y={H - pb - h} width={bw * 0.64} height={Math.max(h, d.value ? 2 : 0)} rx="4" fill={hover === i || (hover === null && i === days.length - 1) ? "#A85B3E" : "#606859"} opacity={hover === null || hover === i ? 1 : 0.55} />
              {(i % Math.ceil(days.length / 7) === 0 || i === days.length - 1) && (
                <text x={x + bw * 0.32} y={H - 8} textAnchor="middle" fontSize="11" fill="#7A736A">{d.label}</text>
              )}
            </g>
          );
        })}
        {hover !== null && (() => {
          const d = days[hover];
          const x = Math.min(W - 130, Math.max(pl, pl + hover * bw - 40));
          return (
            <g pointerEvents="none">
              <rect x={x} y={pt} width="130" height="44" rx="8" fill="#222" />
              <text x={x + 10} y={pt + 18} fontSize="12" fill="#EFECE6" className="tnum">{d.value.toLocaleString()} EGP</text>
              <text x={x + 10} y={pt + 34} fontSize="11" fill="#EFECE6" opacity=".6">{d.label}, {d.orders} {d.orders === 1 ? "order" : "orders"}</text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

export default function Overview() {
  const { db, mode, importCatalog, toast } = useStore();
  const [range, setRange] = useState(14);
  const [importing, setImporting] = useState(false);

  const stats = useMemo(() => {
    const since = Date.now() - range * 864e5;
    const inRange = db.orders.filter((o) => new Date(o.createdAt).getTime() >= since);
    const paid = inRange.filter((o) => PAID.includes(o.status));
    const revenue = paid.reduce((s, o) => s + o.total, 0);
    const pending = db.orders.filter((o) => o.status === "pending");
    const toCollect = db.orders.filter((o) => o.status === "confirmed" || o.status === "shipped");
    const prevSince = since - range * 864e5;
    const prevRevenue = db.orders.filter((o) => { const t = new Date(o.createdAt).getTime(); return t >= prevSince && t < since && PAID.includes(o.status); }).reduce((s, o) => s + o.total, 0);

    const days = Array.from({ length: range }).map((_, i) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (range - 1 - i));
      const next = d.getTime() + 864e5;
      const os = paid.filter((o) => { const t = new Date(o.createdAt).getTime(); return t >= d.getTime() && t < next; });
      return { label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), value: os.reduce((s, o) => s + o.total, 0), orders: os.length };
    });

    const top = new Map<string, { units: number; revenue: number; orders: number }>();
    inRange.filter((o) => o.status !== "cancelled").forEach((o) => o.lines.forEach((l) => {
      const t = top.get(l.productId) || { units: 0, revenue: 0, orders: 0 };
      t.units += l.qty; t.revenue += l.unitPrice * l.qty; t.orders += 1;
      top.set(l.productId, t);
    }));
    const topList = [...top.entries()].map(([id, v]) => ({ p: db.products.find((p) => p.id === id), ...v })).filter((x) => x.p).sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, 6);

    const byCat = new Map<string, number>();
    paid.forEach((o) => o.lines.forEach((l) => {
      const c = db.products.find((p) => p.id === l.productId)?.category || "other";
      byCat.set(c, (byCat.get(c) || 0) + l.unitPrice * l.qty);
    }));

    const statusCount = Object.keys(STATUS_META).map((s) => ({ s, n: inRange.filter((o) => o.status === s).length }));
    return {
      revenue, prevRevenue, orders: inRange.length, paidOrders: paid.length, aov: paid.length ? Math.round(revenue / paid.length) : 0,
      pending, pendingValue: pending.reduce((s, o) => s + o.payment.deposit, 0),
      codOpen: toCollect.reduce((s, o) => s + o.codDue, 0), codOrders: toCollect.filter((o) => o.codDue > 0).length, days, topList, byCat: [...byCat.entries()].sort((a, b) => b[1] - a[1]), statusCount,
    };
  }, [db, range]);

  const delta = stats.prevRevenue ? Math.round(((stats.revenue - stats.prevRevenue) / stats.prevRevenue) * 100) : null;
  const lowStock = db.products.filter((p) => p.active && p.stock <= 5).sort((a, b) => a.stock - b.stock);
  const maxUnits = Math.max(1, ...stats.topList.map((t) => t.units));
  const catTotal = stats.byCat.reduce((s, [, v]) => s + v, 0) || 1;
  const hasSamples = db.orders.some((o) => o.sample);

  return (
    <>
      <PageHead
        title="Overview"
        sub={hasSamples ? "Includes sample orders. Clear them from Settings when you go live." : "Sales and orders at a glance."}
        action={
          <div className="inline-flex rounded-full border border-fahmy/15 p-1 bg-paper">
            {[7, 14, 30].map((r) => (
              <button key={r} onClick={() => setRange(r)} className={cx("h-9 px-4 rounded-full text-sm tnum", range === r ? "bg-fahmy text-sand" : "text-stone hover:text-fahmy")}>{r} days</button>
            ))}
          </div>
        }
      />

      {mode === "sheets" && db.products.length === 0 && (
        <div className="rounded-2xl bg-fahmy text-sand px-5 py-5 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Your Google Sheet has no products yet</p>
            <p className="text-sand/60 text-sm">Copy the full ATHAR catalog, with every size and price, into the Products sheet.</p>
          </div>
          <button className="btn rounded-md bg-sand text-ink hover:bg-white" disabled={importing}
            onClick={async () => { setImporting(true); try { await importCatalog(); toast("Catalog loaded into Google Sheets"); } catch (e) { toast((e as Error).message); } setImporting(false); }}>
            {importing ? "Loading…" : "Load the ATHAR catalog"}
          </button>
        </div>
      )}
      {stats.pending.length > 0 && (
        <Link to="/admin/orders?s=pending" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-topy text-white px-5 py-4 mb-6 hover:bg-topy-dark">
          <span><b className="tnum">{stats.pending.length}</b> {stats.pending.length === 1 ? "order is" : "orders are"} waiting for deposit verification ({egp(stats.pendingValue)} in deposits)</span>
          <span className="text-sm underline underline-offset-4">Review deposit receipts</span>
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3 md:gap-4">
        {[
          { l: "Revenue", v: egp(stats.revenue), s: delta === null ? "Confirmed, shipped and delivered" : `${delta >= 0 ? "+" : ""}${delta}% vs previous ${range} days`, good: delta === null ? undefined : delta >= 0 },
          { l: "Orders", v: stats.orders.toString(), s: `${stats.paidOrders} paid` },
          { l: "Average order", v: egp(stats.aov), s: "Paid orders only" },
          { l: "Awaiting verification", v: stats.pending.length.toString(), s: egp(stats.pendingValue) + " in deposits to check" },
          { l: "Cash to collect", v: egp(stats.codOpen), s: `On ${stats.codOrders} confirmed or shipped ${stats.codOrders === 1 ? "order" : "orders"}` },
        ].map((k, i) => (
          <div key={k.l} className={cx("rounded-2xl p-5", i === 0 ? "bg-fahmy text-sand" : "bg-paper border border-fahmy/10")}>
            <p className={cx("text-sm", i === 0 ? "text-sand/60" : "text-stone")}>{k.l}</p>
            <p className="display tnum text-2xl md:text-3xl mt-2">{k.v}</p>
            <p className={cx("text-xs mt-1.5", k.good === true ? "text-[#9fb08f]" : k.good === false ? "text-[#e3a58c]" : i === 0 ? "text-sand/50" : "text-stone")}>{k.s}</p>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-[1.6fr_1fr] gap-4 mt-4">
        <section className="rounded-2xl bg-paper border border-fahmy/10 p-5 md:p-6 min-w-0">
          <div className="flex justify-between items-baseline mb-4">
            <h2 className="font-semibold">Revenue per day</h2>
            <span className="text-sm text-stone">EGP, paid orders</span>
          </div>
          <RevenueChart days={stats.days} />
        </section>

        <section className="rounded-2xl bg-paper border border-fahmy/10 p-5 md:p-6">
          <h2 className="font-semibold mb-4">Sales by category</h2>
          {stats.byCat.length === 0 ? <p className="text-sm text-stone">No paid orders in this period yet.</p> : (
            <>
              <div className="flex h-3 rounded-full overflow-hidden mb-5">
                {stats.byCat.map(([c, v], i) => <div key={c} style={{ width: `${(v / catTotal) * 100}%`, background: ["#A85B3E", "#606859", "#222222", "#C9A77C", "#8C9483", "#B9B0A2"][i % 6] }} />)}
              </div>
              <ul className="space-y-2.5">
                {stats.byCat.map(([c, v], i) => (
                  <li key={c} className="flex items-center gap-3 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: ["#A85B3E", "#606859", "#222222", "#C9A77C", "#8C9483", "#B9B0A2"][i % 6] }} />
                    <span className="flex-1">{CATEGORY_LABEL[c]?.en ?? c}</span>
                    <span className="tnum text-stone">{Math.round((v / catTotal) * 100)}%</span>
                    <span className="tnum w-24 text-right">{egp(v)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="grid xl:grid-cols-[1.6fr_1fr] gap-4 mt-4">
        <section className="rounded-2xl bg-paper border border-fahmy/10 p-5 md:p-6">
          <h2 className="font-semibold">Best sellers</h2>
          <p className="font-ar text-sm text-stone mb-4" lang="ar">أكتر حاجة اتباعت وعليها طلب</p>
          {stats.topList.length === 0 ? <p className="text-sm text-stone">No orders in this period yet.</p> : (
            <ul className="space-y-3">
              {stats.topList.map((t, i) => (
                <li key={t.p!.id} className="flex items-center gap-3">
                  <span className="tnum text-sm text-stone w-5">{i + 1}</span>
                  <div className="w-10 h-12 rounded-md overflow-hidden bg-ramly shrink-0"><ProductImage p={t.p!} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{t.p!.name}</span>
                      <span className="tnum shrink-0">{t.units} sold · {egp(t.revenue)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-fahmy/5 mt-1.5 overflow-hidden"><div className="h-full rounded-full bg-topy" style={{ width: `${(t.units / maxUnits) * 100}%` }} /></div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl bg-paper border border-fahmy/10 p-5 md:p-6">
            <h2 className="font-semibold mb-4">Orders by status</h2>
            <div className="grid grid-cols-5 gap-2">
              {stats.statusCount.map(({ s, n }) => (
                <Link key={s} to={`/admin/orders?s=${s}`} className="text-center rounded-xl py-3 hover:bg-ramly/60">
                  <p className="display tnum text-2xl">{n}</p>
                  <p className="text-[11px] text-stone mt-1">{STATUS_META[s].label}</p>
                </Link>
              ))}
            </div>
          </section>
          <section className="rounded-2xl bg-paper border border-fahmy/10 p-5 md:p-6">
            <h2 className="font-semibold mb-3">Low stock</h2>
            {lowStock.length === 0 ? <p className="text-sm text-stone">Everything has more than 5 in stock.</p> : (
              <ul className="divide-y divide-fahmy/10 text-sm">
                {lowStock.map((p) => (
                  <li key={p.id} className="py-2.5 flex justify-between gap-3">
                    <Link to={`/admin/products?edit=${p.id}`} className="hover:text-topy truncate">{p.name}</Link>
                    <span className={cx("tnum shrink-0", p.stock === 0 ? "text-topy font-medium" : "text-stone")}>{p.stock === 0 ? "Sold out" : `${p.stock} left`}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="rounded-2xl bg-paper border border-fahmy/10 p-5 md:p-6 mt-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold">Latest orders</h2>
          <Link to="/admin/orders" className="text-sm text-topy">All orders</Link>
        </div>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm min-w-[560px]">
            <tbody className="divide-y divide-fahmy/10">
              {db.orders.slice(0, 6).map((o) => (
                <tr key={o.id} className="hover:bg-ramly/40">
                  <td className="py-3 px-2"><Link to={`/admin/orders?o=${o.id}`} className="font-medium tnum hover:text-topy">{o.number}</Link></td>
                  <td className="py-3 px-2">{o.customer.name}</td>
                  <td className="py-3 px-2 text-stone">{fmtDate(o.createdAt, true)}</td>
                  <td className="py-3 px-2"><span className={cx("rounded-full px-2.5 py-1 text-xs", STATUS_META[o.status].cls)}>{STATUS_META[o.status].label}</span></td>
                  <td className="py-3 px-2 text-right tnum">{egp(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
