import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ImageUp, Landmark, Smartphone, Wallet, X } from "lucide-react";
import { linePrice, useStore } from "../lib/store";
import { CopyRow, FreeDeliveryBar, ProductImage } from "../components/ui";
import { DELIVERY_ETA, GOVERNORATES, compressImage, cx, egp, shippingFee } from "../lib/utils";
import type { PayMethod } from "../lib/types";

const PHONE = /^01[0125]\d{8}$/;

export default function Checkout() {
  const { db, cart, placeOrder, clearCart } = useStore();
  const s = db.settings;
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [f, setF] = useState({ name: "", phone: "", email: "", governorate: "", city: "", address: "", notes: "", sender: "", reference: "" });
  const [method, setMethod] = useState<PayMethod>("instapay");
  const [receipt, setReceipt] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [drag, setDrag] = useState(false);
  const [depositStr, setDepositStr] = useState(String(s.minDeposit));

  const rows = cart.map((c) => ({ c, p: db.products.find((p) => p.id === c.productId)! })).filter((r) => r.p);
  const subtotal = rows.reduce((t, r) => t + linePrice(r.p, r.c.variantId) * r.c.qty, 0);
  // Free delivery from the threshold up, applied before a governorate is even chosen
  const fee = useMemo(() => {
    if (subtotal >= s.freeShippingOver) return 0;
    return f.governorate ? shippingFee(subtotal, f.governorate, s) : null;
  }, [f.governorate, subtotal, s]);
  const total = subtotal + (fee ?? 0);
  // Deposit: at least the minimum (or the whole order if it costs less), never more than the total
  const minDep = Math.min(s.minDeposit, total || s.minDeposit);
  const deposit = Math.round(Number(depositStr) || 0);
  const cod = Math.max(0, total - deposit);
  const depositError =
    !depositStr.trim() ? `Enter the deposit you transferred. The minimum is ${egp(minDep)}.`
    : deposit < minDep ? `The deposit must be at least ${egp(minDep)}.`
    : fee !== null && deposit > total ? `The deposit can't be more than the order total (${egp(total)}).`
    : "";

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setF((x) => ({ ...x, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: "" }));
  };

  const onFile = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { setErrors((e) => ({ ...e, receipt: "That file is over 12 MB. Upload a screenshot instead of a photo of the screen." })); return; }
    setUploading(true);
    try {
      setReceipt(await compressImage(file, 1200, 0.8));
      setErrors((e) => ({ ...e, receipt: "" }));
    } catch (err) {
      setErrors((e) => ({ ...e, receipt: (err as Error).message }));
    } finally { setUploading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.name.trim().length < 3) er.name = "Enter your full name.";
    if (!PHONE.test(f.phone.replace(/\s/g, ""))) er.phone = "Enter an 11-digit Egyptian mobile number, starting with 010, 011, 012 or 015.";
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) er.email = "Check the email address, or leave it empty.";
    if (!f.governorate) er.governorate = "Choose your governorate.";
    if (!f.city.trim()) er.city = "Enter your city or area.";
    if (f.address.trim().length < 8) er.address = "Add the street, building and apartment number.";
    if (!f.sender.trim()) er.sender = "Enter the name on the account you transferred from.";
    if (depositError) er.deposit = depositError;
    if (!receipt) er.receipt = "Upload a screenshot of your deposit transfer to place the order.";
    const short = rows.find(({ c, p }) => c.qty > p.stock);
    if (short) er.stock = `Only ${short.p.stock} of ${short.p.name} left. Lower the quantity in your bag to continue.`;
    setErrors(er);
    if (Object.keys(er).length) {
      const first = document.querySelector(`[data-field="${Object.keys(er)[0]}"]`);
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    let order;
    try {
      order = await placeOrder({
      customer: { name: f.name.trim(), phone: f.phone.replace(/\s/g, ""), email: f.email.trim() || undefined },
      shipping: { governorate: f.governorate, city: f.city.trim(), address: f.address.trim(), notes: f.notes.trim() || undefined },
      lines: rows.map(({ c, p }) => ({
        productId: p.id, name: p.name, variantId: c.variantId, variant: p.variants.find((v) => v.id === c.variantId)?.label,
        custom: c.custom, unitPrice: linePrice(p, c.variantId), qty: c.qty,
      })),
      subtotal, shippingFee: fee ?? 0, total,
      payment: { method, receipt, deposit, senderName: f.sender.trim(), reference: f.reference.trim() || undefined },
      });
    } catch (err) {
      setSubmitting(false);
      setErrors({ submit: (err as Error).message || "Your order couldn't be placed. Try again." });
      return;
    }
    clearCart();
    nav(`/order/${order.number}`, { state: { fresh: true } });
  };

  if (rows.length === 0) {
    return (
      <div className="pt-40 pb-32 gutter text-center">
        <h1 className="display text-4xl">Your bag is empty</h1>
        <p className="text-stone mt-2">Add something to your bag to check out.</p>
        <Link to="/shop" className="btn-dark mt-8">Browse the collection</Link>
      </div>
    );
  }

  const methods: { k: PayMethod; label: string; sub: string; icon: JSX.Element }[] = [
    { k: "instapay", label: "InstaPay", sub: "Instant, from any bank app", icon: <Smartphone size={18} /> },
    { k: "wallet", label: "Mobile wallet", sub: "Vodafone, Etisalat, Orange, WE", icon: <Wallet size={18} /> },
    { k: "bank", label: "Bank transfer", sub: "To our CIB account", icon: <Landmark size={18} /> },
  ];

  const Err = ({ k }: { k: string }) => errors[k] ? <p className="text-topy-dark text-sm mt-1.5" role="alert">{errors[k]}</p> : null;

  return (
    <div className="pt-24 md:pt-32 pb-24 gutter max-w-[1300px] mx-auto">
      <h1 className="display text-5xl md:text-8xl">Checkout</h1>
      <p className="text-stone mt-3 max-w-[60ch]">Pay a deposit of at least {egp(s.minDeposit)} by transfer to place your order. You pay the rest in cash when it arrives.</p>

      <form onSubmit={submit} noValidate className="grid lg:grid-cols-[1.5fr_1fr] gap-10 lg:gap-14 mt-10 items-start">
        <div className="space-y-12">
          {/* Delivery */}
          <section>
            <h2 className="text-xl font-semibold mb-5 flex items-center gap-3"><span className="tnum w-7 h-7 rounded-full bg-fahmy text-sand text-sm grid place-items-center">1</span>Delivery details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div data-field="name" className="sm:col-span-2">
                <label htmlFor="name" className="label">Full name</label>
                <input id="name" autoComplete="name" className="field" value={f.name} onChange={set("name")} />
                <Err k="name" />
              </div>
              <div data-field="phone">
                <label htmlFor="phone" className="label">Mobile number (WhatsApp)</label>
                <input id="phone" inputMode="tel" autoComplete="tel" placeholder="01xxxxxxxxx" className="field tnum" value={f.phone} onChange={set("phone")} />
                <Err k="phone" />
              </div>
              <div data-field="email">
                <label htmlFor="email" className="label">Email <span className="text-stone/70">(optional)</span></label>
                <input id="email" type="email" autoComplete="email" className="field" value={f.email} onChange={set("email")} />
                <Err k="email" />
              </div>
              <div data-field="governorate">
                <label htmlFor="gov" className="label">Governorate</label>
                <select id="gov" className="field" value={f.governorate} onChange={set("governorate")}>
                  <option value="">Choose…</option>
                  {GOVERNORATES.map((g) => <option key={g}>{g}</option>)}
                </select>
                <Err k="governorate" />
              </div>
              <div data-field="city">
                <label htmlFor="city" className="label">City / area</label>
                <input id="city" className="field" value={f.city} onChange={set("city")} placeholder="e.g. Smouha" />
                <Err k="city" />
              </div>
              <div data-field="address" className="sm:col-span-2">
                <label htmlFor="address" className="label">Street address</label>
                <input id="address" autoComplete="street-address" className="field" value={f.address} onChange={set("address")} placeholder="Street, building, floor, apartment" />
                <Err k="address" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="notes" className="label">Notes for the courier <span className="text-stone/70">(optional)</span></label>
                <textarea id="notes" rows={2} className="field" value={f.notes} onChange={set("notes")} placeholder="Landmark, best time to call…" />
              </div>
            </div>
          </section>

          {/* Payment */}
          <section>
            <h2 className="text-xl font-semibold mb-5 flex items-center gap-3"><span className="tnum w-7 h-7 rounded-full bg-fahmy text-sand text-sm grid place-items-center">2</span>Pay your deposit</h2>
            <div data-field="deposit" className="rounded-2xl border border-ramady/70 bg-paper p-4 md:p-5 mb-4">
              <label htmlFor="deposit" className="label">Deposit amount (EGP)</label>
              <div className="flex flex-wrap gap-2 items-center">
                <input id="deposit" type="number" inputMode="numeric" min={minDep} max={total || undefined} step={10}
                  className={cx("field tnum w-40 text-lg font-semibold", errors.deposit && "border-topy")}
                  value={depositStr} onChange={(e) => { setDepositStr(e.target.value); if (errors.deposit) setErrors((er) => ({ ...er, deposit: "" })); }} />
                {[
                  { l: `Minimum ${egp(minDep)}`, v: minDep },
                  ...(fee !== null && total > minDep * 2 ? [{ l: "Half", v: Math.ceil(total / 2) }] : []),
                  ...(fee !== null ? [{ l: "Full amount", v: total }] : []),
                ].map((c) => (
                  <button key={c.l} type="button" onClick={() => { setDepositStr(String(c.v)); setErrors((er) => ({ ...er, deposit: "" })); }}
                    className={cx("h-10 px-3 rounded-md border text-sm tnum", deposit === c.v ? "bg-fahmy text-sand border-fahmy" : "border-ramady hover:border-fahmy")}>
                    {c.l}
                  </button>
                ))}
              </div>
              <Err k="deposit" />
              {!errors.deposit && depositError && fee !== null && <p className="text-topy-dark text-sm mt-1.5">{depositError}</p>}
              <p className="text-sm text-stone mt-3">
                {fee === null ? "Choose your governorate above to see what's left to pay on delivery."
                  : cod > 0 ? <>You'll pay <b className="text-fahmy tnum">{egp(cod)}</b> in cash to the courier when your order arrives.</>
                  : <>You're paying the full amount now. Nothing to pay on delivery.</>}
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Payment method">
              {methods.map((m) => (
                <button type="button" role="radio" aria-checked={method === m.k} key={m.k} onClick={() => setMethod(m.k)}
                  className={cx("text-left rounded-2xl border p-4 transition-colors", method === m.k ? "border-fahmy bg-paper" : "border-ramady/70 hover:border-fahmy/40")}>
                  <div className="flex items-center justify-between">
                    <span className={method === m.k ? "text-topy-dark" : "text-stone"}>{m.icon}</span>
                    <span className={cx("w-5 h-5 rounded-full border grid place-items-center", method === m.k ? "bg-fahmy border-fahmy text-sand" : "border-fahmy/30")}>{method === m.k && <Check size={12} />}</span>
                  </div>
                  <p className="font-medium mt-3">{m.label}</p>
                  <p className="text-xs text-stone mt-0.5">{m.sub}</p>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={method} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                className="mt-4 rounded-2xl bg-fahmy text-sand p-5 md:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4 border-b border-sand/15">
                  <span className="text-sand/70">Transfer your deposit</span>
                  <span className="display tnum text-3xl">{deposit >= minDep ? egp(deposit) : "—"}</span>
                </div>
                {fee !== null && cod > 0 && <p className="text-sm text-sand/60 pt-3">Then <span className="text-sand tnum">{egp(cod)}</span> in cash on delivery.</p>}
                <div className="[&_.text-stone]:text-sand/50 [&_button]:border-sand/25 [&_button:hover]:border-sand divide-y divide-sand/10">
                  {method === "instapay" && <><CopyRow label="InstaPay address" value={s.instapay.handle} /><CopyRow label="Account name" value={s.instapay.name} /></>}
                  {method === "wallet" && <><CopyRow label="Wallet number" value={s.wallet.number} /><CopyRow label="Name" value={s.wallet.name} /></>}
                  {method === "bank" && <><CopyRow label="Bank" value={s.bank.bank} /><CopyRow label="Account name" value={s.bank.accountName} /><CopyRow label="IBAN" value={s.bank.iban} /></>}
                </div>
                {method === "wallet" && <p className="text-xs text-sand/50 mt-2">Works from {s.wallet.providers}.</p>}
              </motion.div>
            </AnimatePresence>
          </section>

          {/* Receipt */}
          <section>
            <h2 className="text-xl font-semibold mb-5 flex items-center gap-3"><span className="tnum w-7 h-7 rounded-full bg-fahmy text-sand text-sm grid place-items-center">3</span>Upload your deposit receipt</h2>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div data-field="sender">
                <label htmlFor="sender" className="label">Name on the sending account</label>
                <input id="sender" className="field" value={f.sender} onChange={set("sender")} />
                <Err k="sender" />
              </div>
              <div>
                <label htmlFor="ref" className="label">Transaction reference <span className="text-stone/70">(optional)</span></label>
                <input id="ref" className="field tnum" value={f.reference} onChange={set("reference")} placeholder="From your transfer screen" />
              </div>
            </div>
            <div data-field="receipt">
              <input ref={fileRef} id="receipt" type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
              {receipt ? (
                <div className="flex gap-4 items-center rounded-2xl border border-ramady/70 bg-paper p-3">
                  <img src={receipt} alt="Your transfer receipt" className="w-20 h-28 object-cover rounded-lg bg-ramly" />
                  <div className="flex-1">
                    <p className="font-medium flex items-center gap-2"><Check size={16} className="text-zeyti-dark" /> Receipt attached</p>
                    <p className="text-sm text-stone">Make sure the amount ({egp(deposit)}) and date are readable.</p>
                  </div>
                  <button type="button" onClick={() => { setReceipt(""); if (fileRef.current) fileRef.current.value = ""; }} className="w-10 h-10 grid place-items-center rounded-full hover:bg-ramly" aria-label="Remove receipt"><X size={18} /></button>
                </div>
              ) : (
                <label htmlFor="receipt"
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); }}
                  className={cx("flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors",
                    drag ? "border-topy bg-topy/5" : errors.receipt ? "border-topy/60" : "border-ramady hover:border-fahmy/50")}>
                  <ImageUp className="text-topy-dark mb-3" size={28} />
                  <span className="font-medium">{uploading ? "Preparing image…" : "Choose a screenshot or drop it here"}</span>
                  <span className="text-sm text-stone mt-1">JPG or PNG, up to 12 MB</span>
                </label>
              )}
              <Err k="receipt" />
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 rounded-[24px] bg-paper border border-ramady/50 p-5 md:p-7">
          <h2 className="text-lg font-semibold mb-4">Order summary</h2>
          <ul className="divide-y divide-ramady/50">
            {rows.map(({ c, p }) => (
              <li key={c.key} className="py-3 flex gap-3">
                <div className="relative w-14 h-[70px] rounded-lg overflow-hidden bg-ramly shrink-0">
                  <ProductImage p={p} text={c.custom} />
                  <span className="absolute -top-0 -right-0 tnum text-[11px] bg-fahmy text-sand rounded-bl-lg px-1.5">{c.qty}</span>
                </div>
                <div className="flex-1 min-w-0 text-sm">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-stone truncate">{[p.variants.find((v) => v.id === c.variantId)?.label, c.custom && `“${c.custom}”`].filter(Boolean).join(", ")}</p>
                </div>
                <span className="text-sm tnum shrink-0">{egp(linePrice(p, c.variantId) * c.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 pt-4 border-t border-ramady/50 space-y-2 text-[15px] tnum">
            <div className="flex justify-between"><dt className="text-stone">Subtotal</dt><dd>{egp(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone">Delivery</dt><dd>{fee === 0 ? <span className="text-zeyti-dark font-medium">Free</span> : fee === null ? "Choose governorate" : egp(fee)}</dd></div>
            <div className="flex justify-between text-lg font-semibold pt-2 border-t border-ramady/50"><dt>Total</dt><dd>{egp(total)}</dd></div>
            <div className="flex justify-between pt-2"><dt className="text-stone">Deposit now</dt><dd className="font-medium">{deposit >= minDep ? egp(Math.min(deposit, total || deposit)) : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-stone">Cash on delivery</dt><dd className="font-medium">{fee === null ? "—" : egp(cod)}</dd></div>
          </dl>
          <FreeDeliveryBar subtotal={subtotal} threshold={s.freeShippingOver} className="mt-5 rounded-lg bg-ramly/60 p-3.5" />
          <p className="text-sm text-stone mt-3">Delivery in <b className="text-fahmy">{DELIVERY_ETA.en}</b> <span className="" lang="ar" dir="rtl">({DELIVERY_ETA.ar})</span> after we confirm your deposit.</p>
          {errors.stock && <p className="text-topy-dark text-sm mt-4" role="alert" data-field="stock">{errors.stock}</p>}
          {errors.submit && <p className="text-topy-dark text-sm mt-4" role="alert">{errors.submit} Nothing was charged on our side; your details are still here.</p>}
          <button type="submit" className="btn-topy w-full mt-6" disabled={submitting || uploading}>{submitting ? "Sending your order…" : "Place order"}</button>
          <p className="text-xs text-stone mt-3 leading-relaxed">Your order is reserved as soon as you place it. It stays pending until we verify your deposit, usually within a few hours, and we confirm on WhatsApp.</p>
        </aside>
      </form>
    </div>
  );
}
