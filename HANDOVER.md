# Twin Titans Emporium — continuation prompt

Paste everything below into a new session.

---

I'm continuing work on **Twin Titans Emporium**, a self-hosted Next.js dropshipping
store. Read this before doing anything.

## Where things are

- **Repo:** `C:\Users\User\twin-titans-commerce`, branch `mysql-support` (not `main`)
- **Live store:** https://twintitansemporium.store (the `.com` 301s to it, except `/api`)
- **Host:** Go54 / HostAfrica shared hosting, DirectAdmin at `da35.host-ww.net:2222`, user `twintita`, app at `/home/twintita/store`
- **Stack:** Next.js 15 / React 19 / TypeScript / Prisma 6 / MySQL / Tailwind

## How to deploy — use the button, not the terminal

```bash
bash scripts/release.sh     # builds locally, pushes artifact to origin/deploy
```

Then **POST `/api/admin/deploy` with `{"confirm":"DEPLOY"}`** from an admin session,
or press **Deploy latest build** on `/admin`. Poll `GET /api/admin/deploy` until
`state: "done"`, then check `buildId` matches what release.sh printed.

**Do not try to use the DirectAdmin browser terminal.** It renders output but
silently swallows all typed input — proven across three fresh sessions and three
fresh tabs. The panel also logs itself out constantly. The deploy button exists
specifically because of this.

## Verification style that this project expects

Verify claims with measurements, not assertions. Examples that caught real bugs
this session:

- Fetching the OG image and checking status/type/bytes/time
- Sampling computed CSS colour vs page background to prove text was invisible
- Restarting an animation and sampling `transform` twice to prove it moved
- Asking an independent crawler (`api.microlink.io`) what it saw
- Reading the API's own field list back instead of guessing names

Run `npx tsx scripts/verify-logic.ts` after touching pricing, categorising,
titles, option labels or variants. It needs no database.

## Money rules — these bite

- Every monetary value is an **Int in MINOR units**, suffixed `*Minor`
- **Paystack took kobo (minor); Flutterwave takes naira (MAJOR)** — 100x trap
- `supplierCostBasis(list, promo)` = `min(list, promo × 1.2)`. AliExpress "regular"
  prices are frequently fiction (one listing was $44.85 nominal / $8.52 actual and
  reached the storefront at ₦78,999). Never cost at a raw list price again.

## Recently completed (this session)

Fulfilment, in order of how much each mattered:

- **Order emails never sent at all** — raw SMTP to `127.0.0.1:25` returned
  `550 relay not permitted`. Now goes through the server's `sendmail` binary
  (no mailbox, no password needed). Orders #17 and #18 were back-sent.
- **`SKU_NOT_EXIST`** — we were sending `sku_id` in the `sku_attr` field. They are
  different things; both are required. Attr map is now read live at placement.
- **445 supplier SKUs recovered** by matching option values against the API, which
  unblocked automatic ordering (36 products → 2 remaining).
- **Phone rejected by AliExpress** — needs country code separately and 9–12 digits;
  `+447936781278` sent whole failed validation. Now split, leading zero stripped.
- **One button per customer payment.** AliExpress cannot place one order across two
  sellers, so it loops one call per seller and reports each.
- **485 variant photos** recovered (API import had put the same image on every
  variant); **261 option labels** tidied; **94 phantom "Option 2" variants** deleted.
- PayPal receipts now itemised; `/admin/customers` added; catalogue re-costing.

## Open items

1. **Press "Place all" on order #18** (Julie Derby, Sheffield, 2 sellers). Every
   known blocker is fixed but a real placement has never succeeded. The account
   showed `auto-pay: canApply false`, which only a live attempt settles.
2. **`no_reply@twintitansemporium.store` does not exist.** The setting is built
   (Settings → "Send automatic emails from") but the mailbox must be created in
   DirectAdmin first — Exim refuses to send from an unverifiable sender. Email
   works without it, sending from support.
3. **2 products still lack SKUs** (Cat/Dog Carrier, Hair Curling Iron) — their
   supplier changed the options. Re-import via the link importer.
4. **7 products are priced in the queue but unpublished** — waiting on pricing.
5. **`/api/cron/tracking`** runs every 30 min and only works for orders placed
   through the API, since it needs the AliExpress order number.

## Working style the user expects

- Act without asking permission for routine steps; they've granted broad autonomy
- Be blunt about what is broken or unproven — do not soften bad news
- **When a fix doesn't work, say so plainly rather than re-explaining the theory.**
  I was wrong twice in a row on the share-image issue and should have said
  "that didn't fix it" sooner
- Never claim something is fixed without evidence
- They ask for a lot at once, often mid-turn. Finish what's running, then address it
