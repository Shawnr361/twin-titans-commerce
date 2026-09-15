# Twin Titans Emporium — continuation prompt (2026-09-15)

Paste everything below the line into a new session.

---

I'm continuing work on **Twin Titans Emporium**, a self-hosted Next.js dropshipping
store. **The store is DOWN right now (502 Bad Gateway on every page). Fixing that is
the only priority.** Read this whole prompt first.

## Before anything else

1. **Use Claude in Chrome** (my real, logged-in Chrome). Load the tools in ONE call:
   `ToolSearch` → `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__find`
   The previous session lost ALL desktop-app built-in tools (Chrome, the browser pane,
   connectors) to a "uses a name reserved for the desktop app's built-in tools" error.
   If that happens again, say so immediately — don't retry in circles.
2. **Never enter my passwords or pull login cookies.** I log in; you drive.

## Where things are

- **Repo:** `C:\Users\User\twin-titans-commerce`, branch **`mysql-support`** (not main).
  Clean tree, HEAD `40c12cb9`.
- **Live store:** https://twintitansemporium.store — the `.com` is `twintitanemporium.com`
- **Host:** Go54 / WhoGoHost, DirectAdmin at **https://da35.host-ww.net:2222** (da35,
  NOT da34), user `twintita`, app at `/home/twintita/store`
- **Stack:** Next.js 15 / React 19 / TypeScript / Prisma 6 (binary engine) / MySQL
- **My real domains (registrar):** `twintitanemporium.com` (titan, singular) and
  `twintitansemporium.store` (titans, plural). **`twintitansemporium.com` (plural + .com)
  is NOT mine** — it resolves to Shopify (23.227.38.32) and answers 402.

## THE OUTAGE — what happened

At some point the DirectAdmin account's **primary domain was renamed** from
`twintitanemporium.com` → **`twintitansemporium.com`** (the Shopify domain). Nobody has
confirmed who did it; the previous Claude session only ever read that page. The `.store`
is a **domain pointer** attached to the primary domain, and the Node app is bound to it.

Timeline of evidence:
- DirectAdmin dashboard showed `twintitansemporium.com` as the account domain
- `twintitanemporium.com` stopped answering at all (HTTP 000) → server no longer knew it
- Later it answered **502** instead of 000 → the rename back appears to have happened
- I then did **Stop → Start** in Setup Node.js App → **still 502** on both domains
  (last checked 2026-09-15 14:58, `/api/health` 502 on `.store` and `.com`)

So the domain is probably reconnected, but **the Node app is not coming up.**

## Diagnose in this order

1. **Domains page** (`/evo/CMD_ADDITIONAL_DOMAINS`): confirm it reads
   `twintitanemporium.com` AND that `twintitansemporium.store` is still listed under it as
   a pointer (`P:`). If the rename isn't reversed, reverse it (Rename Domain). If the
   pointer vanished, re-add it.
2. **Setup Node.js App**: check the `store` app's **domain / application URL**. If it still
   references `twintitansemporium.com`, that alone explains the 502. NOTE: the Node.js
   selector **cannot save settings on da35** (CloudLinux licence check fails) — Stop/Start
   work, Save does not. Recreating the app may need a Go54 support ticket.
3. **Read the actual crash** — File Manager: look for `~/store/stderr.log`, Passenger logs,
   and `~/keepalive.log`. Don't guess; the log will name the error.
4. **Check for a half-finished deploy.** The last verified-live build was
   `YFhDAfRIMmtICYxJsmbyN`. `origin/deploy` holds `xFMKKd_liSz_7J7l4LeDP`, and one deploy
   POST ended in "Failed to fetch" and was never confirmed. In File Manager compare
   `~/store/.next/BUILD_ID` with `~/store/.next-prev/BUILD_ID`. If `.next` is broken or
   partial: rename `.next` → `.next-bad`, `.next-prev` → `.next`, then Stop → Start.
5. **Fork exhaustion** (known history): out of process slots makes `fork()` fail and the
   app won't boot. Close any browser terminal sessions (they each hold a process), then
   Stop → Start again. `~/store/.env` line 20 pins `PRISMA_QUERY_ENGINE_BINARY` — leave it.
6. If still down: **open a Go54 ticket** citing the domain rename and 502 from nginx.

Verify recovery with `/api/health` returning `{"ok":true,"db":true}` AND
`/collections/all` rendering products — not just an HTTP 200.

## Once the store is back — do these immediately

1. **Fix the no-reply sender.** The mailbox moved with the rename. Store Settings →
   "Send automatic emails from" currently says `no_reply@twintitansemporium.com`, which
   would no longer exist. Set it to the address that actually exists now (probably
   `no_reply@twintitanemporium.com`), then `POST /api/admin/mail/test` and confirm
   `ok: true`. **Exim rejects unverifiable senders and that stops EVERY order email.**
2. **Reconcile payments made during the outage.** Flutterwave webhook
   (`src/app/api/payments/flutterwave/webhook/route.ts`) and PayPal capture
   (`src/app/api/payments/paypal/capture/route.ts`) both go through the site. Check the
   Flutterwave and PayPal dashboards for successful payments whose store orders are still
   UNPAID, and fix each one.
3. **Order #20 (Julie Derby, paid ₦39,998 via PayPal on 4 Sep) is still not fulfilled.**
   All its AliExpress orders expired unpaid; the store still shows both legs PLACED against
   dead refs (`3076322138852701`, `3076322850022701`). `reopenSupplierOrder` was committed
   (`07b8716c`) — confirm there's a button for it, reopen both legs, re-place, and
   **I pay them on AliExpress within the countdown** (created ≠ paid).

## Deploying

```bash
bash scripts/release.sh     # builds locally, pushes artifact to origin/deploy
```
Then POST `/api/admin/deploy` with `{"confirm":"DEPLOY"}` from an admin session and poll
`GET /api/admin/deploy` for `VERIFIED live: <buildId>`. Rules:
- Redirect release output to a file and grep it — piping masks a failed push. Confirm with
  `git fetch origin deploy && git show FETCH_HEAD:.next/BUILD_ID`.
- 30-second cooldown on the deploy button; a second press inside it silently does nothing.
- **Go easy on repeated deploys** — each restart can leave orphaned processes, and a pile
  of them is a known cause of this exact outage.
- Never use the DirectAdmin browser terminal.

## What was built recently (all committed and pushed)

- **True landed cost.** Cost from `offer_sale_price` (the billed field), real shipping from
  `aliexpress.ds.freight.query` (param `queryDeliveryReq`, **`selectedSkuId` required**),
  today's FX. Freight retries with backoff. Old stored costs had no shipping and frozen FX
  — some products sold at a loss (turmeric soap −51%).
- **Pricing rebalance** `POST /api/admin/pricing/rebalance` — dry-run default, cursor-paged
  (`afterId`), re-prices viable variants, delists (DRAFT) products where no variant clears
  2× uplift AND ₦1,500 profit, needs ≥50% of variants costed before delisting, leaves
  uncosted rows alone. **Only partly applied across the catalogue — resume it.**
- **Pricing audit** `POST /api/admin/pricing/audit` and probe `GET /api/admin/pricing/probe`.
- **SKU check runs for ever**: one batch rides along on the tracking cron (`*/30`); it
  blocks variants whose supplier SKU is gone (`inventory = 0`, checkout refuses) and
  restores them if the option returns. Full pass completed; 188 variants blocked.
- **Order placement**: UK/IE province = `"Other"`; order number parsed from
  `result.order_list.number[0]`; refusals logged as `supplier_place_failed` events; uses the
  shipping service code the freight API returns.
- **Branded HTML emails** (crest, product photos, totals). Mail test route
  `POST /api/admin/mail/test` emails only the signed-in admin.
- **Admin lists**: Products (no cap, renders all), Orders, Customers, Mailing list all have
  server-side search, honest counts, and scroll panes. Build `xFMKKd_liSz_7J7l4LeDP` holds
  the uncapped products list and may not be live yet.

## Traps that bite

- Money is **Int in minor units**. Flutterwave takes naira (major) — 100× trap.
- The Bash tool collapses `\\` in heredocs; use Write/Edit for anything with backslashes.
- `public/` isn't deployed; use `/apple-icon.png` for any logo URL.
- There is **no AliExpress add-to-cart API**. `ds.order.create` creates but doesn't pay
  without auto-pay approval, and unpaid orders expire. Check My Orders before retrying.
- Server crons run `$HOME` scripts holding the cron secret — never put the secret in a
  cron line or a new file.

## How I want you to work

- **Fix anything that costs money or breaks an order without waiting to be asked.** Build,
  test, deploy, then tell me. Only spending money and handling credentials need my yes.
- Be blunt about what's broken or unproven. Verify live; never claim fixed without evidence.
- Explain in plain terms — I'm not the developer, you are.
- Relevant skills: `resume-dropship`, `advanced-task-execution`, `business-analytics`,
  `code-review`.
