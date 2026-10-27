import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useStore } from "../lib/store";
import { Forbidden, PageHead, can } from "./AdminLayout";
import { cx, fmtDate } from "../lib/utils";
import type { AdminRole, Settings as S } from "../lib/types";

const ROLE_COPY: Record<AdminRole, string> = {
  owner: "Everything, including team and settings",
  admin: "Orders and products",
  staff: "Orders only",
};

export function Team() {
  const { db, me, addAdmin, removeAdmin, changePassword, toast } = useStore();
  const [f, setF] = useState({ name: "", email: "", role: "staff" as AdminRole, password: "" });
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [pw, setPw] = useState({ a: "", b: "" });
  const [pwMsg, setPwMsg] = useState("");

  const ownPassword = (
    <section className="rounded-2xl bg-paper border border-ramady/50 p-5 md:p-6 mt-4">
      <h2 className="font-semibold mb-4">Change your password</h2>
      <form className="grid sm:grid-cols-[1fr_1fr_auto] gap-3" onSubmit={async (e) => {
        e.preventDefault();
        if (pw.a.length < 8) return setPwMsg("Use at least 8 characters.");
        if (pw.a !== pw.b) return setPwMsg("The two passwords don't match.");
        await changePassword(me!.id, pw.a); setPw({ a: "", b: "" }); setPwMsg(""); toast("Password changed");
      }}>
        <input id="pw-new" type="password" autoComplete="new-password" className="field" placeholder="New password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} aria-label="New password" />
        <input id="pw-confirm" type="password" autoComplete="new-password" className="field" placeholder="Repeat new password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} aria-label="Repeat new password" />
        <button className="btn-dark">Change password</button>
      </form>
      {pwMsg && <p className="text-topy-dark text-sm mt-2" role="alert">{pwMsg}</p>}
    </section>
  );

  if (!can(me?.role, "team")) return <><PageHead title="Team" />{ownPassword}</>;

  return (
    <>
      <PageHead title="Team" sub="People who can sign in to this admin." />
      <div className="grid xl:grid-cols-[1.5fr_1fr] gap-4 items-start">
        <section className="rounded-2xl bg-paper border border-ramady/50 overflow-hidden">
          <ul className="divide-y divide-ramady/50">
            {db.admins.map((a) => (
              <li key={a.id} className="px-5 py-4 flex flex-wrap items-center gap-4">
                <span className="w-10 h-10 rounded-full bg-ramly grid place-items-center font-semibold text-topy-dark">{a.name.slice(0, 1).toUpperCase()}</span>
                <div className="flex-1 min-w-[180px]">
                  <p className="font-medium">{a.name}{a.id === me?.id && <span className="text-stone font-normal"> (you)</span>}</p>
                  <p className="text-sm text-stone break-all">{a.email}</p>
                </div>
                <div className="text-sm">
                  <span className={cx("rounded-full px-2.5 py-1 text-xs capitalize", a.role === "owner" ? "bg-fahmy text-sand" : a.role === "admin" ? "bg-[#E3E7DC] text-zeyti-dark" : "bg-ramly")}>{a.role}</span>
                  <p className="text-xs text-stone mt-1">{a.lastLogin ? `Last in ${fmtDate(a.lastLogin)}` : "Hasn't signed in yet"}</p>
                </div>
                {a.id !== me?.id && (confirm === a.id ? (
                  <span className="flex gap-2 text-sm items-center">
                    Remove access?
                    <button className="btn h-9 px-3 bg-topy-dark text-white" onClick={async () => { const e = await removeAdmin(a.id); toast(e || `${a.name} removed`); setConfirm(null); }}>Remove</button>
                    <button className="btn h-9 px-3" onClick={() => setConfirm(null)}>Keep</button>
                  </span>
                ) : (
                  <button className="text-sm text-topy-dark hover:underline" onClick={() => setConfirm(a.id)}>Remove</button>
                ))}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-paper border border-ramady/50 p-5 md:p-6">
          <h2 className="font-semibold mb-4">Add a team member</h2>
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            if (!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email)) return setErr("Enter a name and a valid email.");
            if (f.password.length < 8) return setErr("Give them a temporary password of at least 8 characters.");
            const r = await addAdmin({ ...f, name: f.name.trim(), email: f.email.trim() });
            if (r) return setErr(r);
            toast(`${f.name} can now sign in`); setErr(""); setF({ name: "", email: "", role: "staff", password: "" });
          }}>
            <input id="tm-name" className="field" placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Full name" />
            <input id="tm-email" type="email" className="field" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-label="Email" />
            <input id="tm-pw" type="text" className="field" placeholder="Temporary password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} aria-label="Temporary password" />
            <fieldset className="space-y-2 pt-1">
              <legend className="label">Role</legend>
              {(Object.keys(ROLE_COPY) as AdminRole[]).map((r) => (
                <label key={r} className={cx("flex gap-3 items-start rounded-xl border p-3 cursor-pointer", f.role === r ? "border-fahmy bg-sand" : "border-ramady/70")}>
                  <input type="radio" name="role" className="mt-1 accent-[#A67B5B]" checked={f.role === r} onChange={() => setF({ ...f, role: r })} />
                  <span><span className="block capitalize font-medium">{r}</span><span className="block text-sm text-stone">{ROLE_COPY[r]}</span></span>
                </label>
              ))}
            </fieldset>
            {err && <p className="text-topy-dark text-sm" role="alert">{err}</p>}
            <button className="btn-dark w-full"><UserPlus size={16} />Add team member</button>
          </form>
        </section>
      </div>
      {ownPassword}
    </>
  );
}

export function Settings() {
  const { db, me, mode, saveSettings, clearSamples, resetAll, importCatalog, toast } = useStore();
  const [importing, setImporting] = useState(false);
  const [s, setS] = useState<S>(db.settings);
  const [confirmReset, setConfirmReset] = useState(false);
  if (!can(me?.role, "settings")) return <Forbidden />;
  const samples = db.orders.filter((o) => o.sample).length;
  const F = ({ id, label, value, on, type = "text" }: { id: string; label: string; value: string | number; on: (v: string) => void; type?: string }) => (
    <div><label htmlFor={id} className="label">{label}</label><input id={id} type={type} className="field tnum" value={value} onChange={(e) => on(e.target.value)} /></div>
  );

  return (
    <>
      <PageHead title="Settings" sub="Payment accounts and delivery fees shown to customers at checkout." action={<button className="btn-dark" onClick={() => { saveSettings({ ...s, minDeposit: Math.max(100, Math.round(s.minDeposit) || 100) }); setS((x) => ({ ...x, minDeposit: Math.max(100, Math.round(x.minDeposit) || 100) })); toast("Settings saved"); }}>Save settings</button>} />
      <div className="grid xl:grid-cols-2 gap-4">
        <section className="rounded-2xl bg-paper border border-ramady/50 p-5 md:p-6 space-y-4">
          <h2 className="font-semibold">InstaPay</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {F({ id: "st-ip", label: "InstaPay address", value: s.instapay.handle, on: (v) => setS({ ...s, instapay: { ...s.instapay, handle: v } }) })}
            {F({ id: "st-ipn", label: "Account name", value: s.instapay.name, on: (v) => setS({ ...s, instapay: { ...s.instapay, name: v } }) })}
          </div>
          <h2 className="font-semibold pt-2">Mobile wallet</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {F({ id: "st-w", label: "Wallet number", value: s.wallet.number, on: (v) => setS({ ...s, wallet: { ...s.wallet, number: v } }) })}
            {F({ id: "st-wn", label: "Name", value: s.wallet.name, on: (v) => setS({ ...s, wallet: { ...s.wallet, name: v } }) })}
          </div>
          {F({ id: "st-wp", label: "Wallets accepted", value: s.wallet.providers, on: (v) => setS({ ...s, wallet: { ...s.wallet, providers: v } }) })}
          <h2 className="font-semibold pt-2">Bank transfer</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {F({ id: "st-b", label: "Bank", value: s.bank.bank, on: (v) => setS({ ...s, bank: { ...s.bank, bank: v } }) })}
            {F({ id: "st-bn", label: "Account name", value: s.bank.accountName, on: (v) => setS({ ...s, bank: { ...s.bank, accountName: v } }) })}
          </div>
          {F({ id: "st-iban", label: "IBAN", value: s.bank.iban, on: (v) => setS({ ...s, bank: { ...s.bank, iban: v } }) })}
        </section>
        <div className="space-y-4">
          <section className="rounded-2xl bg-paper border border-ramady/50 p-5 md:p-6 space-y-4">
            <h2 className="font-semibold">Delivery (EGP)</h2>
            <div className="grid grid-cols-3 gap-3">
              {F({ id: "st-s1", label: "Cairo, Giza, Alex", type: "number", value: s.shippingCairoAlex, on: (v) => setS({ ...s, shippingCairoAlex: Number(v) }) })}
              {F({ id: "st-s2", label: "Other areas", type: "number", value: s.shippingOther, on: (v) => setS({ ...s, shippingOther: Number(v) }) })}
              {F({ id: "st-s3", label: "Free over", type: "number", value: s.freeShippingOver, on: (v) => setS({ ...s, freeShippingOver: Number(v) }) })}
            </div>
            <div className="max-w-[220px]">
              {F({ id: "st-dep", label: "Minimum deposit (EGP)", type: "number", value: s.minDeposit, on: (v) => setS({ ...s, minDeposit: Number(v) }) })}
              <p className="text-xs text-stone mt-1.5">At least 100 EGP. The rest is collected in cash on delivery.</p>
            </div>
            {F({ id: "st-wa", label: "Customer WhatsApp number", value: s.whatsapp, on: (v) => setS({ ...s, whatsapp: v }) })}
          </section>
          <section className="rounded-2xl bg-paper border border-ramady/50 p-5 md:p-6">
            <h2 className="font-semibold mb-1">Store data</h2>
            {mode === "sheets" ? (
              <>
                <p className="text-sm text-stone mb-4">
                  Connected to Google Sheets. Orders, products and settings are shared across every device, and deposit receipts are saved in your Google Drive.
                </p>
                {db.products.length === 0 && (
                  <button className="btn-dark" disabled={importing} onClick={async () => { setImporting(true); try { await importCatalog(); toast("Catalog loaded into Google Sheets"); } catch (e) { toast((e as Error).message); } setImporting(false); }}>
                    {importing ? "Loading catalog…" : "Load the ATHAR catalog"}
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-stone mb-4">Demo mode: data is kept in this browser only. Connect Google Sheets to share orders across devices (google-apps-script/SETUP.md).</p>
                <div className="flex flex-wrap gap-3">
                  <button className="btn-line" disabled={!samples} onClick={() => { clearSamples(); toast("Sample orders removed"); }}>{samples ? `Remove ${samples} sample orders` : "No sample orders"}</button>
                  {confirmReset ? (
                    <span className="flex items-center gap-2 text-sm">Reset all products, orders and team?
                      <button className="btn h-10 px-4 bg-topy-dark text-white" onClick={async () => { await resetAll(); toast("Demo data restored"); setConfirmReset(false); }}>Reset</button>
                      <button className="btn h-10 px-4" onClick={() => setConfirmReset(false)}>Keep</button>
                    </span>
                  ) : <button className="btn text-topy-dark" onClick={() => setConfirmReset(true)}>Reset demo data</button>}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
