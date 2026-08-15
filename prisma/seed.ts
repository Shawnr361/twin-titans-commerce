/**
 * Seed: creates the owner account, baseline settings, FX rates, starter
 * collections and the standard policy pages.
 *
 * Safe to run repeatedly — everything is an upsert, and it never touches
 * products or orders.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'owner@twintitans.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? '';

const COLLECTIONS = [
  ['home-living', 'Home & Living'],
  ['beauty-skincare', 'Beauty & Skincare'],
  ['pet-supplies', 'Pet Supplies'],
  ['gadgets-lighting', 'Gadgets & Lighting'],
];

const PAGES: [string, string, string][] = [
  [
    'shipping',
    'Shipping & delivery',
    `<p>Orders are dispatched within 1–3 business days. Delivery usually takes 7–21 days depending on your location and the item.</p>
     <h2>Tracking</h2>
     <p>You receive a tracking number by email as soon as your parcel ships. You can also check it any time on our <a href="/orders/track">tracking page</a>.</p>
     <h2>Delivery times</h2>
     <p>Estimates are given in good faith but customs and courier delays are outside our control. If your order is significantly late, contact us and we will chase it.</p>`,
  ],
  [
    'returns',
    'Returns & refunds',
    `<p>If an item arrives damaged, faulty, or materially different from its description, contact us within 7 days of delivery with photos and we will arrange a replacement or a full refund.</p>
     <h2>Change of mind</h2>
     <p>Because items ship directly from our suppliers, change-of-mind returns are assessed case by case. Contact us first — do not ship anything back without agreeing it with us.</p>`,
  ],
  [
    'contact',
    'Contact us',
    `<p>Questions about an order, a product, or a delivery? We reply to every message.</p>
     <p>Include your order number if you have one — it gets you an answer much faster.</p>`,
  ],
  [
    'privacy',
    'Privacy policy',
    `<p>We collect only what we need to fulfil your order: your name, email, phone number and delivery address.</p>
     <h2>Who we share it with</h2>
     <p>Your delivery address is shared with the supplier shipping your item, and your payment details are handled entirely by our payment provider — we never see or store your card number.</p>
     <h2>Your rights</h2>
     <p>You can ask us for a copy of your data, or ask us to delete it, at any time.</p>`,
  ],
  [
    'terms',
    'Terms of service',
    `<p>By placing an order you agree to these terms.</p>
     <h2>Pricing</h2>
     <p>Prices may be displayed in your local currency for convenience. Payment is taken in the store's settlement currency, shown at checkout.</p>
     <h2>Availability</h2>
     <p>If an item becomes unavailable after you order, we will contact you and refund you in full.</p>`,
  ],
];

async function main() {
  // --- Owner account -------------------------------------------------------
  if (!ADMIN_PASSWORD) {
    console.warn(
      '\n⚠  SEED_ADMIN_PASSWORD is not set — skipping admin account creation.\n' +
        '   Run:  SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD="a-strong-password" npm run db:seed\n'
    );
  } else if (ADMIN_PASSWORD.length < 10) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 10 characters.');
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await prisma.adminUser.upsert({
      where: { email: ADMIN_EMAIL.toLowerCase() },
      create: { email: ADMIN_EMAIL.toLowerCase(), passwordHash, name: 'Owner', role: 'owner' },
      update: { passwordHash },
    });
    console.log(`✓ Admin account ready: ${ADMIN_EMAIL}`);
  }

  // --- Settings ------------------------------------------------------------
  await prisma.setting.upsert({
    where: { key: 'store' },
    create: {
      key: 'store',
      value: {
        storeName: 'Twin Titans Emporium',
        tagline: 'Premium finds, delivered to your door.',
        baseCurrency: 'NGN',
        supportEmail: '',
        supportPhone: '',
        shippingFlatMinor: 0,
        freeShippingOverMinor: 0,
        displayCurrencies: ['NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD'],
        paypalCurrency: 'USD',
        announcement: 'Free delivery nationwide • Tracked on every order',
      },
    },
    update: {},
  });

  await prisma.setting.upsert({
    where: { key: 'pricing' },
    create: {
      key: 'pricing',
      value: {
        strategy: 'MARGIN',
        marginPct: 45,
        minMarginPct: 20,
        profitMinor: 0,
        multiplier: 2.5,
        overheadMinor: 0,
        overheadPct: 0,
        roundToMinor: 100000,
        roundEndingMinor: 99900,
        compareAtMultiplier: 1.45,
        fees: {
          percent: 0.015,
          flatMinor: 10000,
          flatWaivedBelowMinor: 250000,
          capMinor: 200000,
        },
      },
    },
    update: {},
  });
  console.log('✓ Settings seeded');

  // --- FX ------------------------------------------------------------------
  // Rates are "foreign units per 1 NGN". These are placeholders — set the real
  // ones in admin settings before pricing anything for real money.
  const rates: [string, number, string][] = [
    ['NGN', 1, '₦'],
    ['USD', 1 / 1500, '$'],
    ['GBP', 1 / 1900, '£'],
    ['EUR', 1 / 1650, '€'],
    ['CAD', 1 / 1100, 'CA$'],
    ['AUD', 1 / 1000, 'A$'],
    ['CNY', 1 / 210, '¥'],
  ];
  for (const [code, rate, symbol] of rates) {
    await prisma.fxRate.upsert({
      where: { code },
      create: { code, rate, symbol },
      update: {},
    });
  }
  console.log('✓ FX rates seeded (placeholder values — update them in Settings)');

  // --- Collections ---------------------------------------------------------
  for (const [index, [handle, title]] of COLLECTIONS.entries()) {
    await prisma.collection.upsert({
      where: { handle },
      create: { handle, title, position: index },
      update: {},
    });
  }
  console.log(`✓ ${COLLECTIONS.length} collections seeded`);

  // --- Pages ---------------------------------------------------------------
  for (const [handle, title, bodyHtml] of PAGES) {
    await prisma.page.upsert({
      where: { handle },
      create: { handle, title, bodyHtml },
      update: {},
    });
  }
  console.log(`✓ ${PAGES.length} policy pages seeded`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
