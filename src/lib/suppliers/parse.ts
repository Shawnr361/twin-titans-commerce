import type { ParsedSupplierUrl, Platform } from './types';

/**
 * Turn a pasted supplier URL into { platform, externalId }.
 *
 * Kenny pastes whatever he copied — a share sheet short link, a mobile URL with
 * 40 tracking params, an app deep link. All of it has to land on the same
 * canonical listing id, because that id is what we re-order against months
 * later when a customer actually buys.
 */

const TRACKING_PARAMS = [
  'spm', 'pdp_npi', 'gatewayAdapt', 'algo_pvid', 'algo_exp_id', 'aem_p4p_detail',
  'scm', 'scm_id', 'scm-url', 'pvid', 'utparam', 'sk', 'aff_fcid', 'aff_fsk',
  'aff_platform', 'aff_trace_key', 'terminal_id', 'afSmartRedirect', 'srcSns',
  'businessType', 'templateId', 'utm_source', 'utm_medium', 'utm_campaign',
  'utm_term', 'utm_content', 'gclid', 'fbclid', '_randl_currency', '_randl_shipto',
  'curPageLogUid', 'ws_ab_test', 'tracelog', 'cosite', 'trace', 'sourceType',
];

export function stripTracking(url: string): string {
  try {
    const u = new URL(url);
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
    // Anything left that looks like tracking noise.
    for (const key of [...u.searchParams.keys()]) {
      if (/^(spm|scm|algo|aff_|utm_|pdp_|_randl|tt_)/i.test(key)) u.searchParams.delete(key);
    }
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

const SHORT_LINK_HOSTS = [
  'a.aliexpress.com',
  's.click.aliexpress.com',
  'star.aliexpress.com',
  'm.tb.cn',
  'qr.1688.com',
];

export function isShortLink(url: string): boolean {
  try {
    return SHORT_LINK_HOSTS.includes(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

interface Rule {
  platform: Platform;
  hosts: RegExp;
  extract: RegExp[];
  canonical: (id: string) => string;
}

const RULES: Rule[] = [
  {
    platform: 'ALIEXPRESS',
    hosts: /(^|\.)(aliexpress\.(com|us|ru|es|fr|it|pl|nl|co\.kr|com\.br))$/i,
    extract: [
      /\/item\/(?:[^/]*?_)?(\d{8,})\.html/i, // /item/1005007635123586.html
      /\/i\/(\d{8,})\.html/i,
      /[?&]productId=(\d{8,})/i,
    ],
    canonical: (id) => `https://www.aliexpress.com/item/${id}.html`,
  },
  {
    platform: 'ALIBABA',
    hosts: /(^|\.)alibaba\.com$/i,
    extract: [
      /\/product-detail\/[^/]*?_?(\d{10,})\.html/i, // ..._1600123456789.html
      /\/offer\/(\d{8,})\.html/i,
      /[?&](?:productId|offerId)=(\d{8,})/i,
    ],
    canonical: (id) => `https://www.alibaba.com/product-detail/_${id}.html`,
  },
  {
    platform: 'C1688',
    hosts: /(^|\.)1688\.com$/i,
    extract: [/\/offer\/(\d{6,})\.html/i, /[?&]offerId=(\d{6,})/i],
    canonical: (id) => `https://detail.1688.com/offer/${id}.html`,
  },
  {
    platform: 'CJ',
    hosts: /(^|\.)cjdropshipping\.com$/i,
    extract: [/-p-(\d+)\.html/i, /\/product\/[^/]*?-p-([A-Za-z0-9-]+)/i, /[?&]pid=([A-Za-z0-9-]+)/i],
    canonical: (id) => `https://cjdropshipping.com/product/-p-${id}.html`,
  },
];

export function parseSupplierUrl(input: string): ParsedSupplierUrl | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let u: URL;
  try {
    u = new URL(withProtocol);
  } catch {
    return null;
  }

  if (isShortLink(withProtocol)) {
    return {
      platform: 'OTHER',
      externalId: '',
      canonicalUrl: withProtocol,
      needsResolution: true,
    };
  }

  const host = u.hostname.toLowerCase();
  const full = u.pathname + u.search;

  for (const rule of RULES) {
    if (!rule.hosts.test(host)) continue;
    for (const pattern of rule.extract) {
      const m = full.match(pattern);
      if (m?.[1]) {
        return {
          platform: rule.platform,
          externalId: m[1],
          canonicalUrl: rule.canonical(m[1]),
          needsResolution: false,
        };
      }
    }
    // Right marketplace, unrecognised URL shape — keep the platform, let the
    // caller fall back to page parsing rather than rejecting Kenny's link.
    return {
      platform: rule.platform,
      externalId: '',
      canonicalUrl: stripTracking(withProtocol),
      needsResolution: false,
    };
  }

  return {
    platform: 'OTHER',
    externalId: '',
    canonicalUrl: stripTracking(withProtocol),
    needsResolution: false,
  };
}

/** Follow a share-sheet short link to the real listing URL. */
export async function resolveShortLink(url: string, timeoutMs = 12000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': BROWSER_UA },
    });
    return res.url || url;
  } catch {
    return url;
  } finally {
    clearTimeout(timer);
  }
}

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
