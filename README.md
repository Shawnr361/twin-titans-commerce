# Twin Titans Commerce

A self-hosted store + dropshipping engine. No Shopify, no monthly platform fee, no
app subscriptions, and no third party who can switch the storefront off.

Built with Next.js 15 (App Router), TypeScript, Postgres via Prisma, and Tailwind.
It runs anywhere that runs Node or Docker: a VPS, Railway, Render, Fly, or Vercel.

---

## What it does

**Storefront** — home, collections, product pages, cart, checkout, order tracking,
content/landing pages. Server-rendered for SEO. Dark premium theme with a canvas
particle field and cursor-tilt product cards.

**Dropshipping** — paste an AliExpress / Alibaba / 1688 product URL and it reads the
listing, maps every variant, converts the cost into your currency, prices each variant
off its *own* landed cost, and saves it as a draft. When a customer pays, the order is
automatically split by supplier and queued with the customer's address as the ship-to.

**Admin** — import wizard, catalog, orders, supplier fulfilment queue, margin audit
across every variant, and store settings.

---

## The money rules this codebase enforces

These are encoded, not documented-and-hoped-for:

1. **Every monetary value is an integer in minor units** (kobo, cents). No floats
   touch money. Columns are suffixed `*Minor` so a raw-naira value cannot be assigned
   by accident.
2. **Price is derived per variant, from that variant's own cost.** A single flat price
   across SKUs with different supplier costs is what produced live loss-making variants
   on the old store three separate times.
3. **The gateway fee is part of the price solve**, not subtracted afterwards.
4. **A product with a below-cost variant cannot be published** — refused by the API,
   not just greyed out in the UI.
5. **Prices are rendered through one component** that carries the true value in a
   `data-base-minor` attribute. The currency switcher rewrites the *text*; anything
   that needs the real number reads the attribute. This is why the display-currency
   feature cannot corrupt a charge amount.
6. **Imports always land as drafts.** Nothing goes live without a human publishing it.
7. **Payment webhooks are idempotent by reference** — gateways retry, and double-routing
   an order means double-buying the goods.

---

## Setup

```bash
npm install
cp .env.example .env.local          # fill in DATABASE_URL and AUTH_SECRET at minimum
npx prisma db push                  # create the schema
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='a-strong-password' npm run db:seed
npm run dev                         # http://localhost:3400
```

Generate an auth secret with `openssl rand -base64 48`.

No Postgres locally? `docker compose up -d db` gives you one on :5432.

### Verify the money logic at any time

```bash
npx tsx scripts/verify-logic.ts
```

24 checks covering URL parsing, gateway fees, the pricing solver and the margin audit.
Run it after touching anything in `src/lib/pricing.ts` or `src/lib/suppliers/`.

---

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `AUTH_SECRET` | yes | Signs admin sessions, 32+ chars |
| `NEXT_PUBLIC_SITE_URL` | yes | Public origin, no trailing slash |
| `PAYSTACK_SECRET_KEY` / `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | for NGN | Cards, transfer, USSD |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_ENV` | for USD | PayPal cannot process NGN — a hard platform limit |
| `SCRAPER_ENDPOINT` / `SCRAPER_API_KEY` | optional | Gateway for supplier pages that block datacentre IPs |
| `SMTP_URL` / `MAIL_FROM` | optional | Order + tracking emails |

Nothing hard-fails on a missing optional key — the feature degrades and says so.

---

## How the dropshipping flow works

```
Paste supplier URL
   ↓  parse platform + listing id (short links resolved, tracking stripped)
   ↓  fetch listing (direct → scraping gateway → manual form; never invents data)
   ↓  normalize title, images, variant matrix, per-SKU costs
   ↓  convert cost to base currency at a buy-side rate (+3% buffer)
   ↓  price EVERY variant from its own landed cost + fees + target margin
   ↓  save as DRAFT with margin warnings attached
   ↓  you review and publish

Customer pays
   ↓  webhook verifies the payment (idempotent by reference)
   ↓  order split into one supplier order per supplier
   ↓  ship-to = the CUSTOMER's address
   ↓  supplier queue shows a ready-to-paste order sheet
   ↓  you place it, record the supplier ref, add tracking
   ↓  customer sees tracking on /orders/track
```

### On automatic order placement

Placement is **assisted**, not automatic, by default. AliExpress's dropshipping order
API is approval-gated and Alibaba/1688 have no equivalent for single-unit orders. A
half-working auto-placer that silently fails is worse than a 30-second paste: a customer
who paid and never gets shipped is the one failure this business cannot absorb.

The adapter interface in `src/lib/dropship/fulfilment.ts` is built for auto-placement —
if you get API access later, it drops in without touching anything else.

### Platform caveats worth knowing

- **Alibaba** is B2B. MOQs are often above 1 and pricing is tiered — confirm the supplier
  will ship single units direct to a customer before you sell. The importer warns you.
- **1688** sells domestically inside China and does not ship internationally. You need a
  sourcing agent or freight forwarder. The importer warns you, and the listings are in
  Chinese, so titles need rewriting.
- **AliExpress** is the only one of the three that works out of the box for single-unit
  direct-to-customer dropshipping.

---

## Deploying

**Docker** (any VPS, Railway, Render, Fly):

```bash
docker compose up -d --build
```

**Vercel/Netlify:** point at the repo, set the environment variables, and use a hosted
Postgres (Neon or Supabase). Build command `npm run build`.

Either way, after the first deploy:

```bash
npx prisma db push && npm run db:seed
```

Then set the Paystack webhook to `https://yourdomain.com/api/payments/paystack/webhook`.

---

## Layout

```
prisma/schema.prisma          data model
src/lib/money.ts              minor-unit money helpers
src/lib/pricing.ts            pricing solver + margin audit
src/lib/fx.ts                 sourcing vs display FX
src/lib/suppliers/            URL parsing, fetching, per-platform adapters, import
src/lib/dropship/fulfilment.ts  order → supplier routing, order sheets, tracking
src/lib/orders.ts             order creation, payment confirmation
src/lib/payments/             Paystack, PayPal
src/app/                      storefront + admin + API routes
scripts/verify-logic.ts       money-logic verification harness
```
