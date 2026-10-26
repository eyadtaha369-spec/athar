# Connect ATHAR to Google Sheets (about 10 minutes)

Once connected, every order placed on the live site lands in one Google Sheet and
appears in `/admin` within seconds, on any device. Deposit receipts are saved
privately in your Google Drive, and you get an email for every new order.

## 1. Create the sheet
1. Go to **sheets.new** while signed in to the Google account that should own the store data.
2. Name it **ATHAR Store**.

## 2. Add the script
1. In the sheet: **Extensions → Apps Script**.
2. Delete everything in `Code.gs`, then paste the full contents of `google-apps-script/Code.gs` from this repo.
3. Click **Save** (disk icon).

## 3. Run setup once
1. In the function dropdown at the top, pick **setup**, then click **Run**.
2. Google asks for permission: **Review permissions → your account → Advanced → Go to ATHAR (unsafe) → Allow**.
   ("Unsafe" only means the script is yours and not published by Google.)
3. The sheet now has tabs **Orders, Products, Settings, Admins**, and your Drive has
   **ATHAR Receipts** and **ATHAR Product Photos** folders.

Default owner login: `owner@athar.eg` / `athar2026`. Change it in Admin → Team after you sign in.

## 4. Deploy as a web app
1. **Deploy → New deployment**, gear icon → **Web app**.
2. Description: `ATHAR API`. **Execute as: Me**. **Who has access: Anyone**.
3. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).

## 5. Send the URL to Claude
Paste the `/exec` URL in chat. Claude adds it to the site and pushes; Vercel redeploys.
(Or set it yourself: Vercel → Project → Settings → Environment Variables →
`VITE_SHEETS_API_URL` = the URL, then redeploy.)

## 6. Load the catalog
Sign in at `/admin`. The Overview shows **Load the ATHAR catalog** — click it once to copy
all products, sizes and prices into the Products sheet.

## Optional settings (Apps Script → Project Settings → Script properties)
| Property | What it does |
|---|---|
| `NOTIFY_EMAIL` | Where new-order emails go (setup fills in your Google email). Comma-separate several. |
| `ADMIN_URL` | Your site address, e.g. `https://athar.vercel.app`, so emails include a link to the admin. |

## Updating the script later
After pasting a new `Code.gs`: **Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy**.
The URL stays the same.
