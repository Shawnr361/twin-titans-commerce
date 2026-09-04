/**
 * Render each customer email to an HTML file so it can be LOOKED at.
 *
 * Email markup cannot be checked by typechecking it — a table that collapses
 * or a colour that vanishes against its own background compiles perfectly.
 * Run this, open the files, and see the thing the customer sees.
 *
 *   npx tsx scripts/preview-emails.ts [outputDirectory]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderEmail } from '../src/lib/email/template';

const out = process.argv[2] ?? join(process.cwd(), '.email-preview');
mkdirSync(out, { recursive: true });

const storeName = 'Twin Titans Emporium';
const supportEmail = 'support@twintitansemporium.store';

const items = [
  {
    title: 'Hoygi Snail Repair Cream 100g — Hydrating Face Moisturiser',
    variant: '1pc / 100g',
    quantity: 1,
    imageUrl: 'https://ae-pic-a1.aliexpress-media.com/kf/S16e355a3ea934222a861a7ab92663149g.jpg',
    price: '₦19,999',
  },
  {
    title: '30 Level Deep Muscle Massage Gun with Carry Case',
    variant: '6 Gear · Black',
    quantity: 2,
    imageUrl: 'https://ae-pic-a1.aliexpress-media.com/kf/S16e355a3ea934222a861a7ab92663149g.jpg',
    price: '₦91,998',
  },
];

const pages: Record<string, ReturnType<typeof renderEmail>> = {
  'confirmation.html': renderEmail({
    storeName,
    supportEmail,
    preheader: 'Order #19 is confirmed. We are placing it with our supplier now.',
    heading: 'Thank you — order #19 is confirmed',
    intro: [
      'We have received your payment, and your order is being prepared.',
      'You will get another email with a tracking number as soon as it ships.',
    ],
    items,
    totals: [
      { label: 'Subtotal', value: '₦111,997' },
      { label: 'Delivery', value: 'Free' },
      { label: 'Total paid', value: '₦111,997', strong: true },
    ],
    cta: { label: 'View your order', href: 'https://twintitansemporium.store/orders/track?number=19' },
    address: ['Chanemunah Bello', '14 Awolowo Road', 'Ikoyi, Lagos', 'Nigeria', 'Tel: 08031234567'],
    outro: [
      'Tracking can take a few days to start updating once a parcel is collected, so do not worry if it looks quiet at first.',
    ],
  }),

  'shipped.html': renderEmail({
    storeName,
    supportEmail,
    preheader: 'Tracking number LP00512345678CN — your parcel is on its way.',
    heading: 'Your order #19 has shipped',
    intro: ['Good news — this part of your order is on its way to you.'],
    items: [items[0]].map((i) => ({ ...i, price: null })),
    callout: { label: 'Tracking', lines: ['LP00512345678CN', 'Carrier: Cainiao Standard'] },
    cta: { label: 'Track your parcel', href: 'https://global.cainiao.com/' },
    outro: [
      'Tracking can take a few days to start updating after a parcel is collected, so do not worry if it looks quiet at first.',
      'If your order had items from more than one of our suppliers, they travel separately and you will get an email for each.',
    ],
  }),

  'delivered.html': renderEmail({
    storeName,
    supportEmail,
    preheader: 'Your parcel has been delivered. How did we do?',
    heading: 'Your order #19 has arrived',
    intro: ['Your parcel has been delivered. We hope it is everything you wanted.'],
    items: items.map((i) => ({ ...i, price: null })),
    cta: { label: 'Leave a review', href: 'https://twintitansemporium.store/orders/track?number=19' },
    outro: [
      'A review takes a minute, and on a young shop it is the main thing that helps the next person decide.',
      'If it has not actually reached you, reply to this email and we will chase it — a carrier occasionally marks a parcel delivered a day early.',
    ],
  }),
};

for (const [name, rendered] of Object.entries(pages)) {
  writeFileSync(join(out, name), rendered.html, 'utf8');
  writeFileSync(join(out, name.replace('.html', '.txt')), rendered.text, 'utf8');
}

console.log(`Wrote ${Object.keys(pages).length} previews to ${out}`);
console.log(Object.keys(pages).join('\n'));
