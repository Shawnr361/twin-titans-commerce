export type Platform = 'ALIEXPRESS' | 'ALIBABA' | 'C1688' | 'CJ' | 'MANUAL' | 'OTHER';

/** The result of pointing the importer at a supplier URL. */
export interface ParsedSupplierUrl {
  platform: Platform;
  /** The listing / offer id on that platform. */
  externalId: string;
  /** URL stripped of tracking params — what we store and re-open later. */
  canonicalUrl: string;
  /** True when the URL is a short link that must be resolved before parsing. */
  needsResolution: boolean;
}

export interface NormalizedVariant {
  /** Supplier's own variant/SKU id, needed to re-order the exact same SKU. */
  externalVariantId?: string;
  supplierSku?: string;
  /** { Color: 'Blue', Size: 'XL' } */
  options: Record<string, string>;
  /** Cost in the supplier's currency, minor units. */
  costMinor: number;
  imageUrl?: string;
  stock?: number | null;
}

export interface NormalizedProduct {
  platform: Platform;
  externalId: string;
  sourceUrl: string;

  title: string;
  descriptionHtml: string;
  images: string[];
  /** Option name -> ordered values, in the supplier's own ordering. */
  optionNames: string[];

  currency: string;
  /** Cheapest variant cost, minor units — the headline "from" cost. */
  costMinor: number;
  shippingCostMinor: number;

  variants: NormalizedVariant[];

  supplierName?: string;
  supplierStoreUrl?: string;
  rating?: number;
  reviewCount?: number;
  ordersCount?: number;
  shipsFrom?: string;

  /** Anything the adapter could not map, kept verbatim for later re-mapping. */
  raw?: unknown;
  /** How this data was obtained — surfaced in the admin so trust is explicit. */
  provenance: 'api' | 'page' | 'manual';
  /** Non-fatal problems worth showing before the product is published. */
  warnings: string[];
}

export interface SupplierAdapter {
  platform: Platform;
  label: string;
  /** Does this adapter claim the URL? */
  matches(url: string): boolean;
  parse(url: string): ParsedSupplierUrl | null;
  /** Throws only on unrecoverable failure; otherwise returns a product. */
  fetchProduct(parsed: ParsedSupplierUrl): Promise<NormalizedProduct>;
}
