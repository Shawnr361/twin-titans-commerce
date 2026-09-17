import { siteOrigin } from '@/lib/seo';

/**
 * The house style for every email the store sends.
 *
 * WHY A TEMPLATE AND NOT A STRING PER EMAIL
 * -----------------------------------------
 * The three order emails were plain text assembled by hand, and they read like
 * a machine had sent them: no mark, no picture of what was bought, no way back
 * to the order. For a shop nobody has heard of yet, that is not merely plain —
 * it is the same shape as a phishing mail, which is the one impression a first
 * order cannot afford. Everything visual now comes from here, so the
 * confirmation, the shipping notice and the delivery note are recognisably the
 * same shop.
 *
 * HTML AND TEXT ARE GENERATED FROM ONE DESCRIPTION
 * -----------------------------------------------
 * renderEmail returns both halves of the multipart message from a single set
 * of options. Writing them separately is how the plain-text copy quietly stops
 * matching the HTML — and then a customer whose client shows text reads
 * different words from the one who sees the design.
 *
 * WRITTEN FOR MAIL CLIENTS, NOT FOR BROWSERS
 * ------------------------------------------
 * Tables, inline styles, and explicit `bgcolor` attributes. Outlook renders
 * with Word's engine: no flexbox, no grid, no background-image, and `<style>`
 * blocks are unreliable. The layout below is deliberately the boring 600px
 * table that has worked everywhere for fifteen years.
 *
 * DARK, BECAUSE THE SHOP IS DARK
 * ------------------------------
 * The storefront is warm near-black and gold, and an email in white would not
 * look like the same company. The colours are the literal values from
 * src/styles/tokens.css — they cannot be referenced as custom properties here,
 * because no mail client resolves them.
 */

/** Literal copies of the tokens in src/styles/tokens.css. */
const C = {
  bg: '#0E0C09',
  band: '#14110D',
  paper: '#1A1611',
  inset: '#221D16',
  onyx: '#F2EDE3',
  ink: '#E6E0D4',
  greige: '#A8A091',
  quiet: '#8A8274',
  rule: '#2D271F',
  gold: '#C9A227',
} as const;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

/*
 * GMAIL'S IPHONE APP REPAINTS DARK EMAILS
 * --------------------------------------
 * In dark mode the Gmail iOS app inverts an email's colours whatever the email
 * declares: this near-black design arrived cream, with its light text turned
 * dark, while the same message in Gmail on the web stayed black and gold. The
 * crest survived because images are never inverted — and that is the way out.
 *
 * 1. Backgrounds. Gmail leaves background-image alone, so every fill is also a
 *    one-colour gradient. bgcolor and background-color stay underneath for
 *    Outlook, which has no background-image at all.
 * 2. Text. The inverted text is flipped back with two blend layers (Rémi
 *    Parmentier's technique). `u + .body` only matches inside Gmail, where the
 *    doctype becomes a <u>, so no other client sees these rules. It restores
 *    light neutrals faithfully; saturated gold may not survive the round trip,
 *    so gold text is left unwrapped rather than risk a hue shift.
 */
function fill(color: string): string {
  return `background-color:${color};background-image:linear-gradient(${color},${color});`;
}

function keepLight(inner: string): string {
  return `<div class="gm-screen"><div class="gm-diff">${inner}</div></div>`;
}

export interface EmailItem {
  title: string;
  variant?: string | null;
  quantity: number;
  imageUrl?: string | null;
  /** Already formatted, e.g. "₦19,999". Omitted where price is not the point. */
  price?: string | null;
}

export interface EmailTotal {
  label: string;
  value: string;
  strong?: boolean;
}

export interface EmailOptions {
  storeName: string;
  /** The grey line a phone shows under the subject. */
  preheader: string;
  heading: string;
  /** Lead paragraphs, before the items. */
  intro: string[];
  items?: EmailItem[];
  totals?: EmailTotal[];
  /** A boxed aside — a tracking number, a delivery note. */
  callout?: { label: string; lines: string[] } | null;
  cta?: { label: string; href: string } | null;
  /** Delivery address, one line per entry. */
  address?: string[] | null;
  /** Closing paragraphs, after everything else. */
  outro?: string[];
  supportEmail?: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Route a supplier image through our own proxy.
 *
 * The AliExpress CDN content-negotiates and answers WebP, which no mail client
 * renders — the same fault that left every shared product link without a
 * picture. /api/og-image asks for JPEG explicitly and serves it from our own
 * domain, already resized and cached, so these thumbnails actually appear.
 *
 * Anything that is not an https URL is dropped rather than passed through: the
 * proxy would refuse it anyway, and a broken-image icon in a receipt looks
 * worse than no image at all.
 */
export function emailImage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.toLowerCase().startsWith('https://')) return null;
  return `${siteOrigin()}/api/og-image?src=${encodeURIComponent(raw)}`;
}

/**
 * The mark: the crest above the wordmark.
 *
 * WHICH LOGO URL, AND WHY IT MATTERS
 * ----------------------------------
 * /apple-icon.png, NOT the PWA icons. public/ is not part of the deployed
 * artifact — release.sh ships .next and the Prisma client and nothing else —
 * so /icons/icon-192.png and /sw.js both answer 404 on the live site, measured
 * rather than assumed. Next builds src/app/apple-icon.png into .next, so that
 * one is really there: 200, image/png, 50KB. A masthead pointing at a missing
 * file is precisely the broken-image logo this redesign exists to remove.
 *
 * The crest is gold on near-black, so it needs no plate behind it and no
 * inversion handling — it sits on the band as if it were painted there.
 *
 * THE WORDMARK STAYS TEXT
 * -----------------------
 * On the site the name is type with a gold gradient clipped to the glyphs.
 * background-clip:text is unsupported across mail clients, and where it fails
 * the letters render TRANSPARENT — an invisible masthead. A flat gold fill is
 * what survives, and as text it also carries the shop's name when a client
 * blocks images, which is when a logo is least able to help.
 */
function masthead(storeName: string): string {
  const origin = siteOrigin();
  return `
  <tr>
    <td align="center" bgcolor="${C.band}" style="${fill(C.band)}padding:28px 24px 24px;">
      <a href="${origin}" style="text-decoration:none;display:block;">
        <img src="${origin}/apple-icon.png" width="64" alt=""
             style="display:block;width:64px;height:auto;margin:0 auto 14px;border:0;border-radius:10px;" />
        <div style="font-family:${FONT};font-size:16px;font-weight:700;letter-spacing:3.5px;color:${C.gold};text-transform:uppercase;line-height:1.3;">
          ${escapeHtml(storeName)}
        </div>
      </a>
    </td>
  </tr>
  <tr><td bgcolor="${C.gold}" style="${fill(C.gold)}height:2px;line-height:2px;font-size:0;">&nbsp;</td></tr>`;
}

function itemRows(items: EmailItem[]): string {
  return items
    .map((item) => {
      const image = emailImage(item.imageUrl);
      /*
       * Width only, height auto. Supplier photographs are not square, and a
       * fixed height stretches them — `object-fit` is not honoured by mail
       * clients, so the aspect ratio has to be left alone rather than cropped.
       */
      const thumb = image
        ? `<img src="${image}" width="62" alt=""
                style="display:block;width:62px;height:auto;border:0;border-radius:6px;${fill(C.inset)}" />`
        : `<div style="width:62px;height:62px;border-radius:6px;${fill(C.inset)}"></div>`;

      const variant =
        item.variant && item.variant !== 'Default'
          ? `<div style="font-family:${FONT};font-size:12px;color:${C.quiet};padding-top:3px;">${escapeHtml(item.variant)}</div>`
          : '';

      const price = item.price
        ? `<td align="right" valign="top" style="font-family:${FONT};font-size:13px;color:${C.ink};white-space:nowrap;padding:14px 0 14px 10px;">${keepLight(escapeHtml(item.price))}</td>`
        : '<td></td>';

      return `
      <tr>
        <td valign="top" width="62" style="padding:14px 14px 14px 0;">${thumb}</td>
        <td valign="top" style="padding:14px 0;">
          ${keepLight(`<div style="font-family:${FONT};font-size:14px;line-height:1.45;color:${C.onyx};">${escapeHtml(item.title)}</div>
          ${variant}
          <div style="font-family:${FONT};font-size:12px;color:${C.greige};padding-top:4px;">Qty ${item.quantity}</div>`)}
        </td>
        ${price}
      </tr>
      <tr><td colspan="3" bgcolor="${C.rule}" style="${fill(C.rule)}height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr>`;
    })
    .join('');
}

function totalRows(totals: EmailTotal[]): string {
  return totals
    .map((t) => {
      const size = t.strong ? '15px' : '13px';
      const weight = t.strong ? '700' : '400';
      return `
      <tr>
        <td style="font-family:${FONT};font-size:${size};font-weight:${weight};color:${t.strong ? C.onyx : C.greige};padding:5px 0;">${keepLight(escapeHtml(t.label))}</td>
        <td align="right" style="font-family:${FONT};font-size:${size};font-weight:${weight};color:${t.strong ? C.gold : C.ink};padding:5px 0;white-space:nowrap;">${t.strong ? escapeHtml(t.value) : keepLight(escapeHtml(t.value))}</td>
      </tr>`;
    })
    .join('');
}

/**
 * A button that survives Outlook.
 *
 * A styled anchor alone collapses to a bare link in the Word engine, so the
 * fill is a table cell's bgcolor and the padding sits on the anchor inside it.
 */
function button(label: string, href: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px;">
    <tr>
      <td bgcolor="${C.gold}" style="${fill(C.gold)}border-radius:4px;">
        <a href="${escapeHtml(href)}"
           style="display:inline-block;padding:13px 30px;font-family:${FONT};font-size:14px;font-weight:700;letter-spacing:0.4px;color:${C.bg};text-decoration:none;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;
}

function paragraphs(lines: string[], color: string): string {
  return lines
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:0 0 13px;font-family:${FONT};font-size:14px;line-height:1.65;color:${color};">${escapeHtml(line)}</p>`
    )
    .join('');
}

function labelledLines(label: string, lines: string[], color: string): string {
  return `<div style="margin-top:26px;">
    <div style="font-family:${FONT};font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:${C.quiet};padding-bottom:8px;">${escapeHtml(label)}</div>
    ${lines
      .filter(Boolean)
      .map(
        (line) =>
          `<div style="font-family:${FONT};font-size:13px;line-height:1.6;color:${color};">${escapeHtml(line)}</div>`
      )
      .join('')}
  </div>`;
}

/** Both halves of the message, from one description. */
export function renderEmail(options: EmailOptions): { html: string; text: string } {
  const {
    storeName,
    preheader,
    heading,
    intro,
    items = [],
    totals = [],
    callout = null,
    cta = null,
    address = null,
    outro = [],
    supportEmail,
  } = options;

  const origin = siteOrigin();

  const itemsBlock =
    items.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border-collapse:collapse;">
           <tr><td colspan="3" bgcolor="${C.rule}" style="${fill(C.rule)}height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr>
           ${itemRows(items)}
         </table>`
      : '';

  const totalsBlock =
    totals.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-collapse:collapse;">
           ${totalRows(totals)}
         </table>`
      : '';

  const calloutBlock = callout
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-collapse:collapse;">
         <tr>
           <td bgcolor="${C.inset}" style="${fill(C.inset)}border-left:3px solid ${C.gold};padding:16px 18px;">
             <div style="font-family:${FONT};font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:${C.gold};padding-bottom:7px;">${escapeHtml(callout.label)}</div>
             ${keepLight(
               callout.lines
                 .filter(Boolean)
                 .map(
                   (line) =>
                     `<div style="font-family:${FONT};font-size:14px;line-height:1.6;color:${C.onyx};">${escapeHtml(line)}</div>`
                 )
                 .join('')
             )}
           </td>
         </tr>
       </table>`
    : '';

  const addressBlock =
    address && address.length > 0 ? labelledLines('Delivering to', address, C.greige) : '';

  const supportLine = supportEmail
    ? `Questions? Just reply to this email, or write to <a href="mailto:${escapeHtml(supportEmail)}" style="color:${C.gold};text-decoration:none;">${escapeHtml(supportEmail)}</a>.<br />`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>${escapeHtml(heading)}</title>
<style>
  u + .body .gm-screen { background:#000000; mix-blend-mode:screen; }
  u + .body .gm-diff { background:#000000; mix-blend-mode:difference; }
</style>
</head>
<body class="body" style="margin:0;padding:0;${fill(C.bg)}">
  <!-- The line a phone shows beside the subject, and nowhere else. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         bgcolor="${C.bg}" style="${fill(C.bg)}">
    <tr>
      <td align="center" style="padding:24px 12px 40px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:100%;max-width:600px;border-collapse:collapse;">
          ${masthead(storeName)}

          <tr>
            <td bgcolor="${C.paper}" style="${fill(C.paper)}padding:32px 30px 34px;">

              ${keepLight(`<h1 style="margin:0 0 16px;font-family:${FONT};font-size:21px;line-height:1.3;font-weight:700;color:${C.onyx};">
                ${escapeHtml(heading)}
              </h1>`)}

              ${keepLight(paragraphs(intro, C.ink))}
              ${itemsBlock}
              ${totalsBlock}
              ${calloutBlock}
              ${cta ? button(cta.label, cta.href) : ''}
              ${addressBlock ? keepLight(addressBlock) : ''}
              ${outro.length > 0 ? `<div style="margin-top:24px;">${keepLight(paragraphs(outro, C.greige))}</div>` : ''}

            </td>
          </tr>

          <tr>
            <td bgcolor="${C.band}" style="${fill(C.band)}padding:22px 30px 26px;border-top:1px solid ${C.rule};">
              ${keepLight(`<div style="font-family:${FONT};font-size:12px;line-height:1.7;color:${C.quiet};">
                ${supportLine}
                <a href="${origin}" style="color:${C.greige};text-decoration:none;">${escapeHtml(storeName)}</a>
                &nbsp;&middot;&nbsp;
                <a href="${origin}/orders/track" style="color:${C.greige};text-decoration:none;">Track an order</a>
                &nbsp;&middot;&nbsp;
                <a href="${origin}/policies/returns" style="color:${C.greige};text-decoration:none;">Returns</a>
              </div>`)}
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

  /*
   * The same message as text — for clients that show it, and for spam filters,
   * which treat an HTML-only message as a small negative signal.
   */
  const text = [
    heading,
    '',
    ...intro,
    ...(items.length > 0
      ? [
          '',
          'What you ordered:',
          ...items.map(
            (i) =>
              `  ${i.quantity} x ${i.title}` +
              (i.variant && i.variant !== 'Default' ? ` (${i.variant})` : '') +
              (i.price ? ` - ${i.price}` : '')
          ),
        ]
      : []),
    ...(totals.length > 0 ? ['', ...totals.map((t) => `${t.label}: ${t.value}`)] : []),
    ...(callout ? ['', callout.label.toUpperCase(), ...callout.lines.filter(Boolean)] : []),
    ...(cta ? ['', `${cta.label}: ${cta.href}`] : []),
    ...(address && address.length > 0
      ? ['', 'Delivering to:', ...address.map((line) => `  ${line}`)]
      : []),
    ...(outro.length > 0 ? ['', ...outro] : []),
    '',
    supportEmail ? `Questions? Reply to this email or write to ${supportEmail}.` : '',
    storeName,
    origin,
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  return { html, text };
}
