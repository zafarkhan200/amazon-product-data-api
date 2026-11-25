import { createHash } from 'node:crypto';
import { storeGet, storeSet } from './store.js';

/** TTLs from PRD section 11, in seconds. */
export const TTL = {
  product_details: 30 * 60,
  product_offers: 10 * 60,
  search: 20 * 60,
  product_reviews: 12 * 60 * 60,
  top_product_reviews: 12 * 60 * 60,
  best_sellers: 2 * 60 * 60,
  deals: 8 * 60,
  deal_products: 8 * 60,
  promo_code_details: 8 * 60,
  asin_to_gtin: 30 * 24 * 60 * 60,
  gtin_to_asin: 20 * 60,
  product_category_list: 7 * 24 * 60 * 60,
  influencer_profile: 24 * 60 * 60,
} as const;

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize).sort((a, b) => String(a).localeCompare(String(b)));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined && item !== null && item !== '')
        .map(([key, item]): [string, unknown] => [key, normalize(item)])
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  if (typeof value === 'string') return value.trim().toLowerCase();
  return value;
}

export function buildCacheKey(endpoint: string, params: Record<string, unknown>): string {
  const hash = createHash('sha256')
    .update(JSON.stringify(normalize(params)))
    .digest('hex')
    .slice(0, 24);
  return `amazon-api:v1:${endpoint}:${hash}`;
}

export interface CacheResult<T> {
  data: T;
  cacheHit: boolean;
  fetchedAt: string;
}

export async function cached<T>(options: {
  endpoint: string;
  params: Record<string, unknown>;
  ttl: number;
  fresh?: boolean;
  loader: () => Promise<T>;
}): Promise<CacheResult<T>> {
  const key = buildCacheKey(options.endpoint, options.params);

  if (!options.fresh) {
    const hit = await storeGet(key);
    if (hit) {
      try {
        return { data: JSON.parse(hit.value) as T, cacheHit: true, fetchedAt: hit.fetched_at };
      } catch {
        // Corrupt cache entry: fall through to a live fetch.
      }
    }
  }

  const data = await options.loader();
  const fetchedAt = new Date().toISOString();
  await storeSet(key, JSON.stringify(data), fetchedAt, options.ttl);
  return { data, cacheHit: false, fetchedAt };
}
