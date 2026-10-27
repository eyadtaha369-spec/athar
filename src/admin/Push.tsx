import { useEffect, useState } from "react";
import { Bell, Send } from "lucide-react";
import { Mark } from "../components/ui";
import { AdminAlertsCard } from "./AdminAlerts";
import { useStore, type PushLogEntry } from "../lib/store";
import { Forbidden, PageHead, can } from "./AdminLayout";
import { cx, fmtDate } from "../lib/utils";

const TEMPLATES = [
  { label: "New drop", title: "New flags just dropped", body: "Fresh designs are live in the vault. Small runs, so grab yours early. أعلام جديدة نزلت", url: "/shop?c=flags" },
  { label: "Weekend offer", title: "Free delivery this weekend", body: "Every order ships free until Sunday night. التوصيل مجاني لحد الأحد", url: "/shop" },
  { label: "Back in stock", title: "Back in stock", body: "A customer favourite is back. Limited quantity this time.", url: "/shop" },
];
const LINKS = [
  { label: "Homepage", url: "/" },
  { label: "Whole shop", url: "/shop" },
  { label: "Flags", url: "/shop?c=flags" },
  { label: "Posters", url: "/shop?c=posters" },
  { label: "Phone cases", url: "/shop?c=cases" },
];

export default function PushCenter() {
  const { me, mode, sendPush, pushStats, toast } = useStore();
  const [stats, setStats] = useState<{ subscribers: number; log: PushLogEntry[] } | null>(null);
  const [statsErr, setStatsErr] = useState("");
  const [f, setF] = useState({ title: "", body: "", url: "/" });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; setup?: boolean } | null>(null);

  const load = () => pushStats().then((s) => { setStats(s); setStatsErr(""); }).catch((e) => setStatsErr((e as Error).message));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!can(me?.role, "products")) return <Forbidden />;
  const n = stats?.subscribers ?? 0;
  const ready = f.title.trim() && f.body.trim();

  const send = async () => {
    setBusy(true); setResult(null);
    try {
      const r = await sendPush({ kind: "broadcast", payload: { title: f.title.trim(), body: f.body.trim(), url: f.url || "/" } });
      setResult({ ok: true, text: r.targets === 0 ? "Nobody is subscribed yet, so nothing was sent." : `Sent to ${r.sent} of ${r.targets} ${r.targets === 1 ? "subscriber" : "subscribers"}${r.removed ? `. ${r.removed} expired ${r.removed === 1 ? "subscription was" : "subscriptions were"} cleaned up` : ""}.` });
      if (r.sent) toast("Notification sent");
      setF({ title: "", body: "", url: "/" });
      load();
    } catch (e) {
      const err = e as Error & { code?: string };
      setResult({ ok: false, text: err.message, setup: err.code === "not-configured" });
    }
    setBusy(false); setConfirm(false);
  };

  return (
    <>
      <PageHead title="Push notifications" sub="Send new drops and offers to subscribed customers, and get new-order alerts on your own devices." />

      <div className="grid xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        {/* Compose */}
        <section className="rounded-2xl bg-paper border border-ramady/50 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold">New notification</h2>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button key={t.label} type="button" onClick={() => { setF({ title: t.title, body: t.body, url: t.url }); setResult(null); }}
                  className="h-8 px-3 rounded-full border border-ramady text-xs hover:border-fahmy">{t.label}</button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between"><label htmlFor="pn-title" className="label">Title</label><span className="text-xs text-stone tnum">{f.title.length}/60</span></div>
              <input id="pn-title" className="field" maxLength={60} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. New flags just dropped" />
            </div>
            <div>
              <div className="flex justify-between"><label htmlFor="pn-body" className="label">Message</label><span className="text-xs text-stone tnum">{f.body.length}/180</span></div>
              <textarea id="pn-body" rows={3} className="field" maxLength={180} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Keep it short: what's new and why it matters." />
            </div>
            <div>
              <label htmlFor="pn-url" className="label">Opens when tapped</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {LINKS.map((l) => (
                  <button key={l.url} type="button" onClick={() => setF({ ...f, url: l.url })}
                    className={cx("h-8 px-3 rounded-full text-xs border", f.url === l.url ? "bg-fahmy text-sand border-fahmy" : "border-ramady hover:border-fahmy")}>{l.label}</button>
                ))}
              </div>
              <input id="pn-url" className="field tnum" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="/p/aurora-valley or a full link" />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {!confirm ? (
              <button className="btn-dark" disabled={!ready || busy} onClick={() => setConfirm(true)}><Send size={16} />Send notification</button>
            ) : (
              <span className="flex flex-wrap items-center gap-2 text-sm">
                Send to {n} {n === 1 ? "subscriber" : "subscribers"}?
                <button className="btn-topy h-10 px-4" disabled={busy} onClick={send}>{busy ? "Sending…" : "Send now"}</button>
                <button className="btn h-10 px-4" onClick={() => setConfirm(false)}>Keep editing</button>
              </span>
            )}
          </div>
          {result && (
            <div className={cx("mt-4 rounded-xl p-4 text-sm", result.ok ? "bg-[#E3E7DC] text-zeyti-dark" : "bg-[#F1DCD3] text-topy-dark")} role="status">
              {result.text}
              {result.setup && (
                <ol className="list-decimal pl-5 mt-2 space-y-1 text-fahmy">
                  <li>Vercel → your ATHAR project → Settings → Environment Variables.</li>
                  <li>Add <b>VAPID_PRIVATE_KEY</b> with the key from the setup file, for Production.</li>
                  <li>Deployments → the latest one → Redeploy.</li>
                </ol>
              )}
            </div>
          )}
        </section>

        {/* Preview + stats */}
        <div className="space-y-4">
          <AdminAlertsCard />
          <section className="rounded-2xl bg-fahmy text-sand p-5">
            <p className="text-xs text-ramady mb-3">Preview</p>
            <div className="rounded-xl bg-[#2A2927] p-3.5 flex gap-3">
              <span className="w-10 h-10 rounded-lg bg-sand grid place-items-center shrink-0"><Mark className="h-6 text-fahmy" label="" /></span>
              <div className="min-w-0">
                <p className="text-xs text-ramady">ATHAR · now</p>
                <p className="font-semibold text-sm truncate">{f.title || "Your title"}</p>
                <p className="text-sm text-sand/80 line-clamp-2">{f.body || "Your message shows here."}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-paper border border-ramady/50 p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Customer subscribers</h2>
              <span className="display tnum text-4xl">{stats ? n : "–"}</span>
            </div>
            {statsErr && <p className="text-sm text-topy-dark mt-2">{statsErr}</p>}
            <p className="text-sm text-stone mt-2">
              Customers opt in from a small prompt while browsing, the footer, or their order page.
              {mode === "local" && " Demo mode: only this browser can subscribe, and sends show on this device."}
            </p>
            <div className="mt-4 pt-4 border-t border-ramady/50">
              <p className="text-sm font-medium mb-1 flex items-center gap-2"><Bell size={15} />Automatic order updates</p>
              <p className="text-sm text-stone">Customers who turned on notifications get a push when you confirm, ship, deliver or cancel their order.</p>
            </div>
          </section>
        </div>
      </div>

      <section className="rounded-2xl bg-paper border border-ramady/50 p-5 md:p-6 mt-4">
        <h2 className="font-semibold mb-3">Sent</h2>
        {!stats?.log.length ? <p className="text-sm text-stone">Notifications you send show up here.</p> : (
          <ul className="divide-y divide-ramady/50 text-sm">
            {stats.log.map((l, i) => (
              <li key={i} className="py-3 flex flex-wrap justify-between gap-3">
                <div className="min-w-0"><p className="font-medium">{l.title}</p><p className="text-stone truncate max-w-[60ch]">{l.body}</p></div>
                <div className="text-right text-stone shrink-0"><p className="tnum">{l.sent} sent{l.failed ? `, ${l.failed} failed` : ""}</p><p className="text-xs">{fmtDate(l.at, true)} · {l.by}</p></div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
