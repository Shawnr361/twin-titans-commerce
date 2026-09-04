# Twin Titans Emporium — continuation prompt

Paste everything below the line into a new session.

---

I'm continuing work on **Twin Titans Emporium**, a self-hosted Next.js dropshipping
store. Read this before doing anything.

## Do these two things first

1. **Use Chrome, not the in-app browser.** All the logged-in sessions — store admin,
   AliExpress, DirectAdmin — live in the real Chrome profile. Load the tools in ONE
   call: `ToolSearch` with
   `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__find`
2. **Check the open items below.** Real customer money is mid-flight.

## Where things are

- **Repo:** `C:\Users\User\twin-titans-commerce`, branch `mysql-support` (not `main`)
- **Live store:** https://twintitansemporium.store (the `.com` 301s to it, except `/api`)
- **Host:** Go54 / HostAfrica, DirectAdmin at `da35.host-ww.net:2222`, user `twintita`,
  app at `/home/twintita/store`
- **Stack:** Next.js 15 / React 19 / TypeScript / Prisma 6 / MySQL / Tailwind
- **Last deployed build:** `i2USsFg2ytQ1rwGwFuCEs` (commit `3645a4c4`)

## OPEN — do this first, it is real money

Order **#20** (Julie Derby, Sheffield, paid via PayPal) was placed with AliExpress
**three times**, because a parser bug reported created orders as failures. Current state:

| AliExpress ref | Item | Amount | Status |
|---|---|---|---|
| `3076056663392701` | KIKO lip gloss | $6.19 | To pay — **keep** |
| `3076176116292701` | Hair Curling Iron | $19.13 | To pay — **keep** |
| `3076322850022701` | KIKO lip gloss | $6.19 | To pay — **duplicate, cancel** |
| `3076322138852701` | Hair Curling Iron | $19.13 | To pay — **duplicate, cancel** |
| `3076189080552701` | KIKO lip gloss | $6.19 | Canceled ✓ |
| `3076176192412701` | Hair Curling Iron | $19.13 | Canceled ✓ |

Then:

1. The two kept orders must be **paid by hand** on AliExpress (Pay now). Created is not
   paid — see the traps below. They expire on a countdown.
2. Once paid, record them against order #20 with **Mark placed** in the supplier queue,
   or the store keeps thinking both legs are PENDING and the button will offer to buy
   them a fourth time.
3. `/admin/fulfilment` shows order #20 as unplaced until step 2 is done.

**Cancel flow** (there is no API for it — drive Chrome): open
`https://www.aliexpress.com/p/order/detail.html?orderId=<ref>`, verify the ref on the
page, click Cancel → "I do not need this order any more" → "Ordered by mistake" →
Confirm → Submit → "Cancel the order". It opens a second tab that closes itself; verify
by reloading the detail page and reading the status.

## Also open

- **Per-product review section** — asked for and never started. The review system
  already exists (`/reviews`, `/api/reviews`, `/admin/reviews`, display on the product
  page) and is now reachable since deliveries finally set `DELIVERED`. What is missing
  is reviews collected and shown per product page.
- **Orders #17 and #18 got their tracking emails in the OLD plain-text format**
  (sent before the redesign). Everything from now on is the branded HTML. Re-sending
  those two needs a deliberate path — `sendShippingNotice` refuses to send twice for
  the same tracking number.
- **`no_reply@twintitansemporium.store` does not exist.** The setting is built
  (Settings → "Send automatic emails from") but the mailbox must be created in
  DirectAdmin **by the user** — I must not create accounts or handle passwords. Email
  works without it, sending from support.
- **`public/` is not deployed** — `/icons/*` and `/sw.js` are 404 live, so the PWA
  manifest advertises three broken icons and Android will not offer "Install". That is
  why the AliExpress share-target never worked. Fixing it needs a line in `release.sh`
  AND a matching stage/swap in `~/server-deploy.sh`, which is not in the repo, so half
  a fix is a no-op.
- `CAINIAO_FULFILLMENT_STD` is hardcoded as the shipping service for every product and
  destination (`aliexpress-place.ts`). Unproven either way — order creation has never
  got far enough to judge it. First suspect if shipping fails oddly on a non-UK route.

## How to deploy — the button, never the terminal

```bash
bash scripts/release.sh     # builds locally, pushes artifact to origin/deploy
```

Then POST `/api/admin/deploy` with `{"confirm":"DEPLOY"}` from an admin session, or
press **Deploy latest build** on `/admin`. Poll `GET /api/admin/deploy` until
`state: "done"` and confirm the log says `VERIFIED live: <buildId>`.

Three things that will otherwise waste your time:

- **`release.sh` can fail to push and still exit 0** if you pipe its output — a broken
  pipe masks the failure. Redirect to a file and grep it, then confirm with
  `git ls-remote origin deploy`. It also hit a plain SSH timeout to GitHub once; re-run.
- **There is a 30-second cooldown** in `src/lib/deploy.ts`. A second press inside it
  silently does nothing and the log still shows the previous run.
- **Never use the DirectAdmin browser terminal.** It renders output but silently
  swallows all typed input.

## Verification style this project expects

Measure, don't assert. Things that caught real bugs this session:

- Reading the order **timeline wording** to prove whether the API or a human placed an
  order — `markPlaced` and the API write different messages, and that is how "the API
  has never once worked" was established
- `curl -o /dev/null -w "%{http_code} %{content_type} %{size_download}"` to prove
  `/icons/icon-192.png` was 404 while `/apple-icon.png` was not
- Rendering the emails to HTML and **looking at them** in a browser
- Reading AliExpress's own order page to discover the orders existed after the code had
  reported failure

Run `npx tsx scripts/verify-logic.ts` after touching pricing, categorising, titles,
option labels, variants, addresses, or the AliExpress reply parsing — it needs no
database. `npx tsx scripts/preview-emails.ts` renders the three customer emails to
`.email-preview/` so they can be looked at.

## Traps that bite

- Every monetary value is an **Int in MINOR units**, suffixed `*Minor`.
  **Paystack took kobo (minor); Flutterwave takes naira (MAJOR)** — 100x trap.
- `supplierCostBasis(list, promo)` = `min(list, promo × 1.2)`. AliExpress "regular"
  prices are frequently fiction.
- **The Bash tool collapses `\\` → `\` in heredocs**, so Python or JS written that way
  gets its regexes and `\n` mangled. Use the Write/Edit tools for anything containing
  backslashes.
- **AliExpress `ds.order.create`:** there is **no add-to-cart API** (only product
  details, shipping calculation, order create — DSers uses the same one). UK/IE province
  must be the literal string `"Other"`. **Created is NOT paid** without auto-pay
  approval. The order number hides at `result.order_list.number[0]`. A false failure
  here is far worse than a false success — it makes a human buy twice. Always check My
  Orders on AliExpress before retrying a placement.
- `sku_id` ≠ `sku_attr` — both are required, and sending the id in the attr field
  returns `SKU_NOT_EXIST`.
- Customer emails: images must go through `/api/og-image` (the AliExpress CDN answers
  WebP, which no mail client renders), and the HTML part must be base64 with wrapped
  lines (SMTP caps a line at 1000 characters).

## Skills and routines available

Reach for these by name rather than improvising:

- **`resume-dropship`** — reload store state at the start of a fresh session.
- **`advanced-task-execution`** — when one message bundles several sub-tasks or spans
  many products. This user routinely asks for four or five things at once, mid-turn;
  decompose, flag blockers honestly instead of skipping them, report per-item status.
- **`winning-product-scout`** — find new products to add; four-signal sourced scorecard.
- **`business-analytics`** — validate a single product, price, margin, supplier or
  trend. Anchors to today's date and cites every source.
- **`predictive-market-score`** — score the store against competitors once live.
- **`frontend-ui-ux`** — storefront and admin UI, motion, dark theming, and the
  z-index/overflow gotchas that break dropdowns.
- **`icon-asset-cleanup`** — trim white padding from generated icons and favicons.
- **`facebook-page`**, **`shopify-theme-dev`** — marketing surface and the legacy
  Shopify store.
- **`code-review`** / **`security-review`** before shipping anything touching money or
  customer data.

## Working style the user expects

- **Act without asking for routine steps, and deploy yourself** — they built the deploy
  button so nobody waits. Send customer emails on sight for real orders.
- **But never spend money or handle credentials without explicit, per-action say-so.**
  I do not sign in, create mailboxes, or type passwords; they do those. A purchase needs
  a specific yes, and the amount must be quoted accurately — I once quoted ₦3,526 for
  what was really ₦24,915, and that kind of error must be corrected loudly and at once.
- **Be blunt about what is broken or unproven.** Do not soften bad news, and when a fix
  does not work say "that didn't work" rather than re-explaining the theory.
- **Never claim something is fixed without evidence.** Check the live state.
- They ask for a lot at once, often mid-turn. Finish what is running, then address it.
- Explain in plain terms — they have said several times that they do not follow the
  jargon.
