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
- **Checkout:** no COD. Customer picks InstaPay / mobile wallet / bank transfer, sees the exact total + account details (copy buttons), and must upload a receipt screenshot to place the order. Stock is reserved on order; returned on cancel.
- **Admin notifications:** new orders show a bell badge + toast instantly (cross-tab in the demo; Supabase Realtime in production).
- **Orders:** view receipt full-size → tick "Payment received and matches" → Confirm → Shipped → Delivered. Cancel with a reason. WhatsApp link per customer.
- **Roles:** owner (everything), admin (orders + products), staff (orders only).
- **Products:** full CRUD, photo upload (up to 6, auto-compressed), options with price changes, custom-text field, inline stock edits, show/hide toggle. Generated artwork is used until real photos are uploaded.
- **Settings:** payment accounts, delivery fees, free-delivery threshold, WhatsApp number. Sample orders are flagged and can be removed in one click.

## Data
`src/lib/store.tsx` is a localStorage mock backend — data lives in one browser only. For production:
1. Create a Supabase project and run `supabase/schema.sql`.
2. Replace the action bodies in `store.tsx` with `supabase-js` calls (tables + `receipts` private bucket + `product-images` public bucket are defined in the schema).
3. Use Supabase Auth for admin sign-in (the `admins` table links to `auth.users`).
4. For email/WhatsApp order alerts, add a Database Webhook on `orders` INSERT → Edge Function.

## Brand tokens (`tailwind.config.js`)
sand `#EFECE6` · ramly `#E3DAC9` · topy `#A85B3E` · fahmy `#222222` · zeyti `#606859`
Fonts: Archivo (variable width) for English, Aref Ruqaa for the أثر mark, IBM Plex Sans Arabic for Arabic text.
