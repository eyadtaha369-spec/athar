# ATHAR (أثر) — Store + Admin

Vite + React + TypeScript + Tailwind + Framer Motion.

## Run
```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build → dist/ (deploy to Vercel; vercel.json handles routes)
npm run build:single # one-file preview build → dist-single/index.html
```

## Routes
| Store | Admin |
|---|---|
| `/` home · `/shop` · `/p/:slug` · `/checkout` · `/order/:number` · `/track` | `/admin` overview · `/admin/orders` · `/admin/products` · `/admin/team` · `/admin/settings` |

**Demo admin:** `owner@athar.eg` / `athar2026` — change it in Admin → Team, and remove the demo hint in `src/admin/AdminLayout.tsx` (Login) before launch.

## How it works
- **Checkout:** deposit + cash on delivery. Customer pays a deposit (min 100 EGP) by InstaPay / wallet / bank transfer, uploads the receipt, and pays the rest in cash on delivery. Free delivery from 1,500 EGP; delivery in 5 to 7 working days. Stock is reserved on order; returned on cancel.
- **Admin notifications:** live banner, bell badge, chime, tab title and desktop pop-ups for every new order, plus an email (Sheets mode).
- **Orders:** view the deposit receipt full-size → enter the amount it shows → **Confirm order (تأكيد الطلب)** → Shipped → Delivered (cash collected). Cancel with a reason. WhatsApp link per customer.
- **Roles:** owner (everything), admin (orders + products), staff (orders only).
- **Products:** full CRUD, photo upload (up to 6, auto-compressed), sizes with their own selling prices, custom-text field, inline stock edits, show/hide toggle. A neutral placeholder shows until real photos are uploaded.
- **Settings:** payment accounts, delivery fees, free-delivery threshold, WhatsApp number. Sample orders are flagged and can be removed in one click.

## Data: Google Sheets backend
Orders, products, settings and admin accounts are shared through one Google Sheet via a Google Apps Script
web app (`google-apps-script/Code.gs`). Follow **`google-apps-script/SETUP.md`** (about 10 minutes), then put the
`/exec` URL in `src/config.ts` or the `VITE_SHEETS_API_URL` env var on Vercel.

- Every order is saved to the **Orders** sheet the moment the customer submits it. The deposit screenshot goes to a private **ATHAR Receipts** folder in Drive.
- The server re-prices every order from the Products sheet, so totals can't be edited in the browser.
- `/admin` checks for new orders every 12 seconds and on tab focus. New orders show a banner, a bell badge, a chime, a flashing tab title and (if enabled) a desktop pop-up. The owner also gets an email per order.
- Without a URL configured the store runs in **demo mode**: data stays in the browser (useful for previews).

`supabase/schema.sql` is kept as an alternative if you later move to Supabase.

## Push notifications

- Customers opt in from a small prompt (after ~25 s or a few pages, never on checkout), the footer switch, or their order page. `public/sw.js` shows the notifications.
- Subscriptions live in the **Subscribers** sheet; broadcasts are logged in **PushLog**.
- `api/push.js` (Vercel function) signs and sends with Web Push / VAPID. Admin → **Push** broadcasts; changing an order to confirmed / shipped / delivered / cancelled pushes to that customer automatically.
- Setup: Vercel → Settings → Environment Variables → add `VAPID_PRIVATE_KEY` (Production), optionally `VAPID_SUBJECT` (`mailto:you@…`), then redeploy. The public key is in `src/config.ts`.
- iPhone: works only after the customer adds the site to their Home Screen (iOS 16.4+).

## Brand tokens (`tailwind.config.js`)
Official palette: Fahmy `#1A1A1A` · Ramly `#E8E1D6` (page background) · Toby `#A67B5B` (buttons, accents) · Zeyti `#6B705C` · Ramady `#B7B0A6` (borders, secondary text on dark).
Derived shades for accessible small text and surfaces: `topy-dark` `#7D5A40`, `topy-deep` `#9A7253`, `zeyti-dark` `#575B4A`, `stone` `#66615A`, `paper` `#F3EEE6`, `ramly` `#DDD5C8`.

Typography: **Anton** (English headings, hero and buttons: heavy condensed caps), **Aref Ruqaa** (خط الرقعة, all Arabic text, limited to Arabic characters via unicode-range), system sans-serif for English body text. Fonts are Google Fonts, self-hosted via Fontsource.
