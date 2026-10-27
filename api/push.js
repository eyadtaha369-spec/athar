/**
 * ATHAR push sender (Vercel serverless function, POST /api/push).
 *
 * The Google Sheet stores who subscribed; this function signs and encrypts each message with
 * the VAPID private key (Apps Script can't do the required crypto) and sends it.
 *
 * Body: { token, kind: "broadcast", payload: { title, body, url } }
 *    or { token, kind: "order", order: { number, phone, status, codDue } }
 * The admin session token is checked by the Apps Script backend on every call.
 *
 * Vercel environment variables:
 *   VAPID_PRIVATE_KEY  (required)   VAPID_PUBLIC_KEY (optional, defaults to the key in the site)
 *   VAPID_SUBJECT      (optional, e.g. mailto:you@example.com)
 *   SHEETS_API_URL     (optional, defaults to the URL in src/config.ts)
 */
import webpush from "web-push";

const DEFAULT_SHEETS = "https://script.google.com/macros/s/AKfycbxJRcm3zlaT_XJ6Wn534UhjUncb01fSYYo4kYaX7lWoaPhqQvvfADxn2slPdAPW8NnLaA/exec";
const DEFAULT_PUBLIC = "BOG0-4oQqk7fc2jP7wddgNavNk-dpkDr0SkuLfVy1lHgqEmyWiKq5FI3ohdGDQQH6H1LuU8t1Gssmm7qpgis7O8";

async function sheets(action, payload, token) {
  const r = await fetch(process.env.SHEETS_API_URL || DEFAULT_SHEETS, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, token, ...payload }),
    redirect: "follow",
  });
  const j = await r.json();
  if (!j.ok) { const e = new Error(j.error || "Store server error"); e.code = j.code; throw e; }
  return j.data;
}

const ORDER_COPY = {
  confirmed: (o) => ({ title: `Order ${o.number} confirmed`, body: `تم تأكيد طلبك. Your deposit is verified and we're preparing your order now.` }),
  shipped: (o) => ({ title: `Order ${o.number} is on its way`, body: `طلبك اتشحن. ${o.codDue > 0 ? `Please have ${o.codDue} EGP in cash ready for the courier.` : "Delivery in 5 to 7 working days."}` }),
  delivered: (o) => ({ title: `Order ${o.number} delivered`, body: "تم التسليم. Thank you for choosing ATHAR. Enjoy your new piece." }),
  cancelled: (o) => ({ title: `Order ${o.number} cancelled`, body: "Your order was cancelled. Message us on WhatsApp if this looks wrong." }),
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST." });
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) {
    return res.status(503).json({ ok: false, code: "not-configured", error: "Push isn't switched on yet. Add VAPID_PRIVATE_KEY in Vercel → Settings → Environment Variables, then redeploy." });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:owner@athar.eg", process.env.VAPID_PUBLIC_KEY || DEFAULT_PUBLIC, privateKey);

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { token, kind } = body;
  try {
    const subs = await sheets("listSubscriptions", {}, token); // also proves the admin session is valid
    let targets = subs;
    let message;
    if (kind === "order") {
      const o = body.order || {};
      const copy = ORDER_COPY[o.status];
      if (!copy) return res.json({ ok: true, data: { targets: 0, sent: 0, failed: 0, removed: 0, skipped: "no message for this status" } });
      const phone = String(o.phone || "").replace(/\D/g, "");
      targets = subs.filter((s) => s.orders.includes(o.number) || (phone && s.phones.some((p) => p.replace(/\D/g, "") === phone)));
      message = { ...copy(o), url: `/order/${o.number}`, tag: `order-${o.number}` };
    } else {
      const p = body.payload || {};
      if (!p.title || !p.body) return res.status(400).json({ ok: false, error: "Add a title and a message." });
      message = { title: String(p.title).slice(0, 80), body: String(p.body).slice(0, 240), url: p.url || "/", tag: "athar-broadcast" };
    }

    const results = await Promise.allSettled(
      targets.map((s) => webpush.sendNotification(s.subscription, JSON.stringify(message), { TTL: 60 * 60 * 24 * 3, urgency: kind === "order" ? "high" : "normal" }))
    );
    const gone = [];
    let sent = 0, failed = 0;
    results.forEach((r, i) => {
      if (r.status === "fulfilled") sent++;
      else { failed++; if ([404, 410].includes(r.reason?.statusCode)) gone.push(targets[i].id); }
    });
    // browsers that unsubscribed or expired are cleaned out of the sheet
    if (gone.length) await sheets("removeSubscriptions", { ids: gone }, token).catch(() => undefined);
    if (kind !== "order") await sheets("logPush", { ...message, audience: "all", sent, failed }, token).catch(() => undefined);
    return res.json({ ok: true, data: { targets: targets.length, sent, failed, removed: gone.length } });
  } catch (err) {
    const status = err.code === "auth" ? 401 : 500;
    return res.status(status).json({ ok: false, code: err.code, error: err.message || "Couldn't send notifications." });
  }
}
