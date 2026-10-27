/**
 * ATHAR (أثر) — Google Sheets backend
 * -----------------------------------
 * Paste this whole file into Extensions → Apps Script of your ATHAR Google Sheet,
 * run `setup` once, then Deploy → New deployment → Web app (Execute as: Me,
 * Who has access: Anyone). Full steps: google-apps-script/SETUP.md
 *
 * Sheets used (created automatically):
 *   Orders    one row per order (readable columns + full JSON)
 *   Products  one row per product
 *   Settings  store settings as JSON
 *   Admins    admin accounts (password stored as SHA-256 hash)
 *   Subscribers  browsers that turned on push notifications (linked to order numbers / phones)
 *   PushLog      every broadcast sent from the admin
 * Deposit receipts are saved privately in the Drive folder "ATHAR Receipts".
 * Product photos are saved in "ATHAR Product Photos" (viewable by link, so the store can show them).
 */

const SHEET = { orders: "Orders", products: "Products", settings: "Settings", admins: "Admins", subscribers: "Subscribers", pushLog: "PushLog", adminDevices: "AdminDevices" };
const HEADERS = {
  Orders: ["id", "number", "createdAt", "status", "customer", "phone", "governorate", "city", "address", "items", "total", "deposit", "verifiedDeposit", "codDue", "method", "paymentVerified", "receiptFile", "json"],
  Products: ["id", "name", "category", "fromPrice", "stock", "active", "json"],
  Settings: ["json"],
  Admins: ["id", "name", "email", "role", "passwordHash", "createdAt", "lastLogin"],
  Subscribers: ["id", "endpoint", "json", "phones", "orders", "createdAt", "lastSeen"],
  AdminDevices: ["id", "adminId", "adminName", "device", "json", "createdAt", "lastSeen"],
  PushLog: ["at", "by", "title", "body", "url", "audience", "sent", "failed"],
};
const PUBLIC = ["ping", "catalog", "placeOrder", "trackOrder", "login", "subscribePush", "unsubscribePush"];
const SESSION_HOURS = 6;
const CORE_ZONES = ["Cairo", "Giza", "Alexandria"];

/* ---------------- entry points ---------------- */

function doGet() {
  return json_({ ok: true, data: { service: "ATHAR", time: new Date().toISOString() } });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "Bad request." }); }
  const route = ROUTES[body.action];
  if (!route) return json_({ ok: false, error: "Unknown action: " + body.action });
  const lock = LockService.getScriptLock();
  try {
    let admin = null;
    if (PUBLIC.indexOf(body.action) === -1) {
      admin = sessionAdmin_(body.token);
      if (!admin) return json_({ ok: false, code: "auth", error: "Your session expired. Sign in again." });
    }
    lock.waitLock(25000);
    return json_({ ok: true, data: route(body, admin) });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/* ---------------- routes ---------------- */

const ROUTES = {
  ping: () => ({ pong: true }),

  catalog: () => ({ products: listProducts_(), settings: getSettings_() }),

  placeOrder: (b) => {
    const o = b.order || {};
    const settings = getSettings_();
    const products = listProducts_();
    if (!o.lines || !o.lines.length) throw new Error("Your bag is empty.");
    if (!o.payment || !o.payment.receipt) throw new Error("Upload a screenshot of your deposit transfer to place the order.");
    if (!o.customer || !o.customer.name || !o.customer.phone) throw new Error("Enter your name and mobile number.");

    // Re-price every line from the catalog so totals can't be edited in the browser
    const lines = o.lines.map((l) => {
      const p = products.find((x) => x.id === l.productId);
      if (!p || !p.active) throw new Error("One of the items in your bag is no longer available. Remove it and try again.");
      const v = (p.variants || []).find((x) => x.id === l.variantId) || (p.variants || []).find((x) => x.label === l.variant);
      const qty = Math.max(1, Math.floor(Number(l.qty) || 1));
      if (p.stock < qty) throw new Error("Only " + p.stock + " of " + p.name + " left. Lower the quantity in your bag.");
      return { productId: p.id, name: p.name, variantId: v ? v.id : undefined, variant: v ? v.label : undefined, custom: l.custom ? String(l.custom).slice(0, 60) : undefined, unitPrice: v ? v.price : p.price, qty: qty };
    });
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    const gov = String((o.shipping && o.shipping.governorate) || "");
    const shippingFee = subtotal >= settings.freeShippingOver ? 0 : (CORE_ZONES.indexOf(gov) > -1 ? settings.shippingCairoAlex : settings.shippingOther);
    const total = subtotal + shippingFee;
    const minDep = Math.min(settings.minDeposit || 100, total);
    const deposit = Math.round(Number(o.payment.deposit) || 0);
    if (deposit < minDep) throw new Error("The deposit must be at least " + minDep + " EGP.");
    if (deposit > total) throw new Error("The deposit can't be more than the order total (" + total + " EGP).");

    const props = PropertiesService.getScriptProperties();
    const seq = Number(props.getProperty("SEQ") || "1100") + 1;
    props.setProperty("SEQ", String(seq));
    const id = Utilities.getUuid();
    const number = "ATH-" + seq;
    const receiptFile = saveReceipt_(o.payment.receipt, number);
    const now = new Date().toISOString();

    const order = {
      id: id, number: number, createdAt: now,
      customer: { name: String(o.customer.name).slice(0, 80), phone: String(o.customer.phone).slice(0, 20), email: o.customer.email || undefined },
      shipping: { governorate: gov, city: String(o.shipping.city || "").slice(0, 80), address: String(o.shipping.address || "").slice(0, 200), notes: o.shipping.notes ? String(o.shipping.notes).slice(0, 300) : undefined },
      lines: lines, subtotal: subtotal, shippingFee: shippingFee, total: total,
      payment: { method: o.payment.method, reference: o.payment.reference || undefined, senderName: o.payment.senderName || undefined, receipt: "drive:" + receiptFile, deposit: deposit },
      codDue: total - deposit,
      status: "pending", paymentVerified: false,
      history: [{ status: "pending", at: now, note: "Order placed with a " + deposit + " EGP deposit receipt" }],
    };
    writeOrder_(order);

    // Reserve stock
    lines.forEach((l) => {
      const p = products.find((x) => x.id === l.productId);
      p.stock = Math.max(0, p.stock - l.qty);
      writeProduct_(p);
    });

    notifyOwner_(order);
    // Push alert to admins' phones and laptops only. Customers never get this one.
    notifyAdminsPush_({
      kind: "new-order",
      title: "طلب جديد من أثر! 🛒",
      body: "تم استلام أوردر جديد بقيمة " + String(total).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " ج.م. اضغط للمراجعة وتأكيد التحويل.",
      url: "/admin/orders?o=" + id,
      tag: "new-order-" + number,
    });
    return order;
  },

  trackOrder: (b) => {
    const o = listOrders_().find((x) => x.number === String(b.number || "").toUpperCase() && x.customer.phone === String(b.phone || "").replace(/\s/g, ""));
    if (!o) return null;
    return { number: o.number, createdAt: o.createdAt, status: o.status, total: o.total, codDue: o.codDue, codCollected: o.codCollected, shippingFee: o.shippingFee,
      shipping: { governorate: o.shipping.governorate }, lines: o.lines, payment: { deposit: o.payment.deposit, verifiedDeposit: o.payment.verifiedDeposit },
      history: o.history.map((h) => ({ status: h.status, at: h.at })), customer: { name: o.customer.name.split(" ")[0], phone: o.customer.phone } };
  },

  login: (b) => {
    const email = String(b.email || "").trim().toLowerCase();
    const admins = listAdmins_(true);
    const a = admins.find((x) => x.email.toLowerCase() === email);
    if (!a || a.passwordHash !== b.passwordHash) throw new Error("That email and password don't match an admin account.");
    const token = Utilities.getUuid() + Utilities.getUuid();
    CacheService.getScriptCache().put("s_" + token, a.id, SESSION_HOURS * 3600);
    a.lastLogin = new Date().toISOString();
    writeAdmin_(a);
    return { token: token, admin: publicAdmin_(a), admins: listAdmins_(false) };
  },

  me: (b, admin) => ({ admin: publicAdmin_(admin), admins: listAdmins_(false) }),

  logout: (b) => { CacheService.getScriptCache().remove("s_" + b.token); return true; },

  listOrders: () => listOrders_(),

  updateOrder: (b, admin) => {
    const current = listOrders_().find((x) => x.id === b.order.id);
    if (!current) throw new Error("That order no longer exists.");
    const next = b.order;
    // Only workflow fields can change; customer details, items and totals stay as placed
    const verified = next.payment && next.payment.verifiedDeposit != null ? Number(next.payment.verifiedDeposit) : undefined;
    const merged = Object.assign({}, current, {
      status: next.status,
      paymentVerified: !!next.paymentVerified,
      codCollected: !!next.codCollected,
      history: next.history || current.history,
      payment: Object.assign({}, current.payment, { verifiedDeposit: verified }),
    });
    merged.codDue = Math.max(0, merged.total - (verified != null ? verified : merged.payment.deposit));
    if (current.status !== "cancelled" && merged.status === "cancelled") {
      const products = listProducts_();
      merged.lines.forEach((l) => {
        const p = products.find((x) => x.id === l.productId);
        if (p) { p.stock += l.qty; writeProduct_(p); }
      });
    }
    writeOrder_(merged);
    return merged;
  },

  getReceipt: (b) => {
    const o = listOrders_().find((x) => x.id === b.orderId);
    if (!o) throw new Error("That order no longer exists.");
    const ref = o.payment.receipt || "";
    if (ref.indexOf("drive:") !== 0) return ref;
    const blob = DriveApp.getFileById(ref.slice(6)).getBlob();
    return "data:" + blob.getContentType() + ";base64," + Utilities.base64Encode(blob.getBytes());
  },

  saveProduct: (b, admin) => { requireRole_(admin, ["owner", "admin"]); writeProduct_(b.product); return b.product; },

  deleteProduct: (b, admin) => { requireRole_(admin, ["owner", "admin"]); deleteRow_(SHEET.products, b.id); return true; },

  uploadImage: (b, admin) => {
    requireRole_(admin, ["owner", "admin"]);
    const file = saveDataUrl_(b.dataUrl, folder_("ATHAR Product Photos"), "product-" + Date.now());
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return "https://lh3.googleusercontent.com/d/" + file.getId();
  },

  saveSettings: (b, admin) => {
    requireRole_(admin, ["owner"]);
    const s = b.settings;
    s.minDeposit = Math.max(100, Math.round(Number(s.minDeposit) || 100));
    sheet_(SHEET.settings).getRange(2, 1).setValue(JSON.stringify(s));
    return s;
  },

  importCatalog: (b, admin) => {
    requireRole_(admin, ["owner"]);
    if (listProducts_().length) throw new Error("The Products sheet already has products.");
    (b.products || []).forEach(writeProduct_);
    if (b.settings) sheet_(SHEET.settings).getRange(2, 1).setValue(JSON.stringify(b.settings));
    return { products: listProducts_().length };
  },

  addAdmin: (b, admin) => {
    requireRole_(admin, ["owner"]);
    const email = String(b.email || "").trim().toLowerCase();
    if (listAdmins_(true).some((a) => a.email.toLowerCase() === email)) throw new Error("An admin with that email already exists.");
    writeAdmin_({ id: Utilities.getUuid(), name: b.name, email: email, role: b.role, passwordHash: b.passwordHash, createdAt: new Date().toISOString() });
    return listAdmins_(false);
  },

  removeAdmin: (b, admin) => {
    requireRole_(admin, ["owner"]);
    const all = listAdmins_(true);
    const target = all.find((a) => a.id === b.id);
    if (!target) return listAdmins_(false);
    if (target.id === admin.id) throw new Error("You can't remove your own account.");
    if (target.role === "owner" && all.filter((a) => a.role === "owner").length === 1) throw new Error("The store needs at least one owner.");
    deleteRow_(SHEET.admins, b.id);
    adminDevices_().filter((d) => d.adminId === b.id).forEach((d) => deleteRow_(SHEET.adminDevices, d.id));
    return listAdmins_(false);
  },

  /* ---------- push notifications ---------- */

  // A browser turned on notifications. Re-subscribing merges new phones / order numbers into the same row.
  subscribePush: (b) => {
    const sub = b.subscription;
    if (!sub || !sub.endpoint || !sub.keys) throw new Error("That browser didn't send a valid subscription.");
    const id = sha256_(sub.endpoint).slice(0, 24);
    const existing = listSubscribers_().find((s) => s.id === id);
    const merge = (a, extra) => Array.from(new Set((a || []).concat(extra || []).map(String).filter(Boolean))).slice(-20);
    const now = new Date().toISOString();
    upsert_(SHEET.subscribers, id, [id, sub.endpoint, JSON.stringify(sub),
      // leading apostrophe keeps Sheets from turning 010… phone numbers into numbers
      "'" + merge(existing && existing.phones, b.phones).join(","), merge(existing && existing.orders, b.orders).join(","),
      existing ? existing.createdAt : now, now]);
    return { id: id };
  },

  /* ---------- admin new-order alerts (admins only) ---------- */

  // A signed-in admin turned on order alerts on this phone or computer.
  subscribeAdminPush: (b, admin) => {
    const sub = b.subscription;
    if (!sub || !sub.endpoint || !sub.keys) throw new Error("That browser didn't send a valid subscription.");
    const id = sha256_(sub.endpoint).slice(0, 24);
    const existing = adminDevices_().find((d) => d.id === id);
    const now = new Date().toISOString();
    upsert_(SHEET.adminDevices, id, [id, admin.id, admin.name, String(b.device || "").slice(0, 60), JSON.stringify(sub), existing ? existing.createdAt : now, now]);
    return adminPushInfo_(admin);
  },

  unsubscribeAdminPush: (b, admin) => {
    if (b.endpoint) deleteRow_(SHEET.adminDevices, sha256_(b.endpoint).slice(0, 24));
    if (b.id) {
      const d = adminDevices_().find((x) => x.id === b.id);
      if (d && (d.adminId === admin.id || admin.role === "owner")) deleteRow_(SHEET.adminDevices, d.id);
    }
    return adminPushInfo_(admin);
  },

  adminPushInfo: (b, admin) => adminPushInfo_(admin),

  testAdminPush: (b, admin) => notifyAdminsPush_({
    kind: "test", title: "إشعارات الطلبات شغالة ✅", body: "هيوصلك إشعار مع كل أوردر جديد، حتى لو الموقع مقفول.", url: "/admin/orders", tag: "athar-test",
  }, admin.id),

  unsubscribePush: (b) => { if (b.endpoint) deleteRow_(SHEET.subscribers, sha256_(b.endpoint).slice(0, 24)); return true; },

  listSubscriptions: (b, admin) => { requireRole_(admin, ["owner", "admin", "staff"]); return listSubscribers_(); },

  removeSubscriptions: (b, admin) => { (b.ids || []).forEach((id) => deleteRow_(SHEET.subscribers, id)); return true; },

  pushStats: () => ({ subscribers: listSubscribers_().length, log: rows_(SHEET.pushLog).slice(-15).reverse().map((r) => ({
    at: String(r[0]), by: r[1], title: r[2], body: r[3], url: r[4], audience: r[5], sent: r[6], failed: r[7] })) }),

  logPush: (b, admin) => {
    requireRole_(admin, ["owner", "admin"]);
    sheet_(SHEET.pushLog).appendRow([new Date().toISOString(), admin.name, b.title, b.body, b.url || "", b.audience || "all", b.sent || 0, b.failed || 0]);
    return true;
  },

  changePassword: (b, admin) => {
    const all = listAdmins_(true);
    const target = all.find((a) => a.id === b.id);
    if (!target) throw new Error("That admin no longer exists.");
    if (target.id !== admin.id && admin.role !== "owner") throw new Error("Only the owner can change someone else's password.");
    target.passwordHash = b.passwordHash;
    writeAdmin_(target);
    return true;
  },
};

/* ---------------- one-time setup ---------------- */

/** Run once from the Apps Script editor: creates the sheets, the owner account and the Drive folders. */
function setup() {
  Object.keys(HEADERS).forEach(sheet_);
  if (!listAdmins_(true).length) {
    writeAdmin_({ id: Utilities.getUuid(), name: "Store Owner", email: "owner@athar.eg", role: "owner", passwordHash: sha256_("athar2026"), createdAt: new Date().toISOString() });
  }
  const s = sheet_(SHEET.settings);
  if (!s.getRange(2, 1).getValue()) s.getRange(2, 1).setValue(JSON.stringify(DEFAULT_SETTINGS));
  folder_("ATHAR Receipts");
  folder_("ATHAR Product Photos");
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("NOTIFY_EMAIL")) props.setProperty("NOTIFY_EMAIL", Session.getEffectiveUser().getEmail());
  if (!props.getProperty("PUSH_SECRET")) props.setProperty("PUSH_SECRET", Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, ""));
  Logger.log("PUSH_SECRET (copy it into Vercel as ADMIN_PUSH_SECRET): " + props.getProperty("PUSH_SECRET"));
  Logger.log("ATHAR is set up. Owner login: owner@athar.eg / athar2026. Order alerts go to " + props.getProperty("NOTIFY_EMAIL"));
}

const DEFAULT_SETTINGS = {
  instapay: { handle: "athar@instapay", name: "ATHAR Store" },
  wallet: { number: "01000000000", name: "ATHAR Store", providers: "Vodafone Cash, Etisalat Cash, Orange Cash, WE Pay" },
  bank: { bank: "CIB", accountName: "ATHAR for Trading", iban: "EG00 0000 0000 0000 0000 0000 0000 0" },
  shippingCairoAlex: 70, shippingOther: 95, freeShippingOver: 1500, minDeposit: 100, whatsapp: "+20 100 000 0000",
};

/* ---------------- helpers ---------------- */

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function rows_(name) {
  const sh = sheet_(name);
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, HEADERS[name].length).getValues() : [];
}

function upsert_(name, id, values) {
  const sh = sheet_(name);
  const ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map((r) => String(r[0])) : [];
  const i = ids.indexOf(String(id));
  if (i > -1) sh.getRange(i + 2, 1, 1, values.length).setValues([values]);
  else sh.appendRow(values);
}

function deleteRow_(name, id) {
  const sh = sheet_(name);
  const ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map((r) => String(r[0])) : [];
  const i = ids.indexOf(String(id));
  if (i > -1) sh.deleteRow(i + 2);
}

function listOrders_() {
  return rows_(SHEET.orders).filter((r) => r[0]).map((r) => JSON.parse(r[17])).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function writeOrder_(o) {
  const items = o.lines.map((l) => l.qty + "× " + l.name + (l.variant ? " (" + l.variant + ")" : "") + (l.custom ? " “" + l.custom + "”" : "")).join("\n");
  upsert_(SHEET.orders, o.id, [o.id, o.number, o.createdAt, o.status, o.customer.name, "'" + o.customer.phone, o.shipping.governorate, o.shipping.city, o.shipping.address,
    items, o.total, o.payment.deposit, o.payment.verifiedDeposit == null ? "" : o.payment.verifiedDeposit, o.codDue, o.payment.method, o.paymentVerified ? "yes" : "no",
    String(o.payment.receipt || "").replace("drive:", "https://drive.google.com/file/d/") + (String(o.payment.receipt || "").indexOf("drive:") === 0 ? "/view" : ""), JSON.stringify(o)]);
}

function listProducts_() {
  return rows_(SHEET.products).filter((r) => r[0]).map((r) => JSON.parse(r[6]));
}

function writeProduct_(p) {
  const from = (p.variants && p.variants.length) ? Math.min.apply(null, p.variants.map((v) => v.price)) : p.price;
  p.price = from;
  upsert_(SHEET.products, p.id, [p.id, p.name, p.category, from, p.stock, p.active ? "yes" : "no", JSON.stringify(p)]);
}

function getSettings_() {
  const v = sheet_(SHEET.settings).getRange(2, 1).getValue();
  return v ? Object.assign({}, DEFAULT_SETTINGS, JSON.parse(v)) : DEFAULT_SETTINGS;
}

function listAdmins_(withHash) {
  return rows_(SHEET.admins).filter((r) => r[0]).map((r) => {
    const a = { id: String(r[0]), name: r[1], email: r[2], role: r[3], createdAt: r[5] ? String(r[5]) : "", lastLogin: r[6] ? String(r[6]) : undefined };
    if (withHash) a.passwordHash = r[4];
    return a;
  });
}

function listSubscribers_() {
  return rows_(SHEET.subscribers).filter((r) => r[0]).map((r) => ({
    id: String(r[0]), subscription: JSON.parse(r[2]),
    phones: String(r[3] || "").replace(/^'/, "").split(",").map((p) => p.replace(/\D/g, "")).filter(Boolean), orders: String(r[4] || "").split(",").filter(Boolean),
    createdAt: String(r[5]),
  }));
}

function adminDevices_() {
  return rows_(SHEET.adminDevices).filter((r) => r[0]).map((r) => ({
    id: String(r[0]), adminId: String(r[1]), adminName: String(r[2]), device: String(r[3]), subscription: JSON.parse(r[4]), createdAt: String(r[5]), lastSeen: String(r[6]),
  }));
}

function pushConfig_() {
  const props = PropertiesService.getScriptProperties();
  const site = String(props.getProperty("ADMIN_URL") || "").replace(/\/+$/, "");
  return { url: props.getProperty("PUSH_URL") || (site ? site + "/api/admin-alert" : ""), secret: props.getProperty("PUSH_SECRET") || "" };
}

function adminPushInfo_(admin) {
  const c = pushConfig_();
  return {
    configured: !!(c.url && c.secret), hasUrl: !!c.url, hasSecret: !!c.secret, pushUrl: c.url,
    devices: adminDevices_().map((d) => ({ id: d.id, adminName: d.adminName, device: d.device, createdAt: d.createdAt, mine: d.adminId === admin.id })),
  };
}

/**
 * Sends a push to every admin device (or one admin's devices) through the site's /api/admin-alert
 * function, which holds the VAPID key. Never throws: an order must save even if push is down.
 */
function notifyAdminsPush_(message, onlyAdminId) {
  const c = pushConfig_();
  if (!c.url || !c.secret) return { configured: false, targets: 0, sent: 0 };
  const devices = adminDevices_().filter((d) => !onlyAdminId || d.adminId === onlyAdminId);
  if (!devices.length) return { configured: true, targets: 0, sent: 0 };
  let res;
  try {
    res = UrlFetchApp.fetch(c.url, {
      method: "post", contentType: "application/json", muteHttpExceptions: true, followRedirects: true,
      payload: JSON.stringify({ secret: c.secret, message: message, subscriptions: devices.map((d) => ({ id: d.id, subscription: d.subscription })) }),
    });
  } catch (e) {
    const msg = String(e && e.message || e);
    return { configured: true, targets: devices.length, sent: 0, error: /permission/i.test(msg)
      ? "Apps Script isn't allowed to contact the site yet. In Apps Script pick setup, click Run and approve the permission, then deploy a new version."
      : "Couldn't reach " + c.url + ": " + msg };
  }
  const code = res.getResponseCode();
  const text = res.getContentText() || "";
  let j = null;
  try { j = JSON.parse(text); } catch (e) {}
  if (!j) {
    return { configured: true, targets: devices.length, sent: 0, error: (code === 401 || code === 403)
      ? "Vercel blocked the alert (HTTP " + code + "). In Vercel → Settings → Deployment Protection, turn off Vercel Authentication, then try again."
      : code === 404 ? "No push function at " + c.url + " (HTTP 404). Check ADMIN_URL and that the latest Vercel deployment is live."
      : "The site answered HTTP " + code + " instead of the push service: " + text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140) };
  }
  if (j.ok === false) {
    return { configured: true, targets: devices.length, sent: 0, error: j.code === "auth"
      ? "PUSH_SECRET in Apps Script and ADMIN_PUSH_SECRET in Vercel don't match. Copy it again with no spaces, then Redeploy in Vercel."
      : j.error };
  }
  (j.gone || []).forEach((id) => deleteRow_(SHEET.adminDevices, id)); // devices that turned alerts off or expired
  const sent = j.sent || 0;
  return { configured: true, targets: devices.length, sent: sent, failed: j.failed || 0,
    error: !sent && j.failed ? "The browsers' push services refused the alert: " + (j.reasons || []).join(" | ") : undefined };
}

function writeAdmin_(a) {
  upsert_(SHEET.admins, a.id, [a.id, a.name, a.email, a.role, a.passwordHash, a.createdAt, a.lastLogin || ""]);
}

function publicAdmin_(a) { return { id: a.id, name: a.name, email: a.email, role: a.role, createdAt: a.createdAt, lastLogin: a.lastLogin }; }

function sessionAdmin_(token) {
  if (!token) return null;
  const id = CacheService.getScriptCache().get("s_" + token);
  if (!id) return null;
  return listAdmins_(false).find((a) => a.id === id) || null;
}

function requireRole_(admin, roles) {
  if (roles.indexOf(admin.role) === -1) throw new Error("Your role doesn't allow this. Ask the store owner.");
}

function folder_(name) {
  const props = PropertiesService.getScriptProperties();
  const key = "FOLDER_" + name;
  const id = props.getProperty(key);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder(name);
  props.setProperty(key, f.getId());
  return f;
}

function saveDataUrl_(dataUrl, folder, name) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || ""));
  if (!m) throw new Error("The image couldn't be read. Try another file.");
  const ext = m[1].split("/")[1] || "jpg";
  return folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name + "." + ext));
}

function saveReceipt_(dataUrl, number) {
  return saveDataUrl_(dataUrl, folder_("ATHAR Receipts"), number + "-deposit").getId();
}

function sha256_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map((b) => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
}

function notifyOwner_(o) {
  const to = PropertiesService.getScriptProperties().getProperty("NOTIFY_EMAIL");
  if (!to) return;
  const items = o.lines.map((l) => "<li>" + l.qty + " × " + l.name + (l.variant ? " (" + l.variant + ")" : "") + " — " + l.unitPrice * l.qty + " EGP</li>").join("");
  const adminUrl = PropertiesService.getScriptProperties().getProperty("ADMIN_URL");
  try {
    MailApp.sendEmail({
      to: to,
      subject: "New ATHAR order " + o.number + " — " + o.payment.deposit + " EGP deposit to verify",
      htmlBody:
        "<h2>New order " + o.number + "</h2>" +
        "<p><b>" + o.customer.name + "</b> · " + o.customer.phone + "<br>" + o.shipping.address + ", " + o.shipping.city + ", " + o.shipping.governorate + "</p>" +
        "<ul>" + items + "</ul>" +
        "<p>Total: <b>" + o.total + " EGP</b><br>Deposit to verify: <b>" + o.payment.deposit + " EGP</b> (" + o.payment.method + ")<br>Cash on delivery: <b>" + o.codDue + " EGP</b></p>" +
        (adminUrl ? '<p><a href="' + adminUrl + '/admin/orders">Open the admin to confirm the order</a></p>' : ""),
    });
  } catch (e) { /* email quota reached; the order is still saved */ }
}
