/**
 * ATHAR admin order alerts (Vercel serverless function, POST /api/admin-alert).
 *
 * Called only by the Google Apps Script backend when a customer places an order. The script sends
 * the admins' device subscriptions and the message; this function signs and delivers them with the
 * VAPID key (Apps Script can't do that crypto). Customers are never targeted here.
 *
 * Body: { secret, message: { title, body, url, tag, kind }, subscriptions: [{ id, subscription }] }
 * Vercel environment variables: ADMIN_PUSH_SECRET (same value as PUSH_SECRET in Apps Script),
 * VAPID_PRIVATE_KEY, optional VAPID_PUBLIC_KEY / VAPID_SUBJECT.
 */
import crypto from "crypto";
import webpush from "web-push";

const DEFAULT_PUBLIC = "BOG0-4oQqk7fc2jP7wddgNavNk-dpkDr0SkuLfVy1lHgqEmyWiKq5FI3ohdGDQQH6H1LuU8t1Gssmm7qpgis7O8";

// Values pasted into Vercel often pick up spaces or quote marks; strip them.
const env = (k) => String(process.env[k] || "").trim().replace(/^["']|["']$/g, "").trim();
const keyOk = (k) => { try { return Buffer.from(k.replace(/-/g, "+").replace(/_/g, "/"), "base64").length === 32; } catch { return false; } };

const sameSecret = (a, b) => {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
};

export default async function handler(req, res) {
  // GET = setup check for the admin dashboard (says which keys exist, never their values)
  if (req.method === "GET") return res.json({ ok: true, vapid: !!env("VAPID_PRIVATE_KEY"), vapidValid: keyOk(env("VAPID_PRIVATE_KEY")), secret: !!env("ADMIN_PUSH_SECRET") });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST." });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const expected = env("ADMIN_PUSH_SECRET");
  const privateKey = env("VAPID_PRIVATE_KEY");
  if (!expected || !privateKey) return res.status(503).json({ ok: false, code: "not-configured", error: "Add ADMIN_PUSH_SECRET and VAPID_PRIVATE_KEY in Vercel, then redeploy." });
  if (!sameSecret(String(body.secret || "").trim(), expected)) return res.status(401).json({ ok: false, code: "auth", error: "Wrong secret." });
  try {
    webpush.setVapidDetails(env("VAPID_SUBJECT") || "mailto:owner@athar.eg", env("VAPID_PUBLIC_KEY") || DEFAULT_PUBLIC, privateKey);
  } catch (e) {
    return res.status(500).json({ ok: false, code: "bad-key", error: "VAPID_PRIVATE_KEY (or VAPID_PUBLIC_KEY) in Vercel isn't valid: " + e.message + " Paste it again exactly, then Redeploy." });
  }
  const m = body.message || {};
  const message = JSON.stringify({
    title: String(m.title || "New order").slice(0, 100),
    body: String(m.body || "").slice(0, 240),
    url: String(m.url || "/admin/orders"),
    tag: String(m.tag || "athar-admin"),
    kind: String(m.kind || "new-order"),
  });
  const subs = Array.isArray(body.subscriptions) ? body.subscriptions.slice(0, 50) : [];
  const results = await Promise.allSettled(subs.map((s) => webpush.sendNotification(s.subscription, message, { TTL: 60 * 60 * 24, urgency: "high" })));
  const gone = [];
  let sent = 0, failed = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") sent++;
    else { failed++; if ([404, 410].includes(r.reason?.statusCode)) gone.push(subs[i].id); }
  });
  const reasons = results.filter((r) => r.status === "rejected").slice(0, 3)
    .map((r) => `${r.reason?.statusCode || ""} ${String(r.reason?.body || r.reason?.message || "").slice(0, 120)}`.trim());
  return res.json({ ok: true, sent, failed, gone, reasons });
}
