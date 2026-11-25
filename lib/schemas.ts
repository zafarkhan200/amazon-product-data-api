import { z } from 'zod';
import { COUNTRY_CODES } from './countries';

/** Helpers for query-string coercion (all query values arrive as strings). */

const normalizedEnum = <T extends string>(values: readonly T[]) =>
  z
    .string()
    .trim()
    .transform((value) => value.toUpperCase().replace(/[\s-]+/g, '_'))
    .pipe(z.enum(values as unknown as [T, ...T[]]));

const booleanParam = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  return value;
}, z.boolean().default(false));

const intParam = (fallback: number, max: number) =>
  z.coerce.number({ invalid_type_error: 'must be a number' })
    .int('must be a whole number')
    .min(1, 'must be at least 1')
    .max(max, `must be at most ${max}`)
    .default(fallback);

const asinSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{10}$/, 'must be a 10-character ASIN')
  .transform((value) => value.toUpperCase());

const gtinSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{8,14}$/, 'must be an 8 to 14 digit GTIN (UPC, EAN or ISBN)');

const rangeParam = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d+)?-\d+(?:\.\d+)?$/, 'must use the format MIN-MAX, e.g. 10-50');

const countrySchema = z.enum(COUNTRY_CODES).default('US');
const common = { country: countrySchema, fresh: booleanParam };

/** ---------- Input schemas ---------- */

export const searchInputSchema = z
  .object({
    query: z.string().trim().min(1, 'query is required').max(200),
    page: intParam(1, 100),
    sort_by: normalizedEnum([
      'RELEVANCE',
      'LOWEST_PRICE',
      'HIGHEST_PRICE',
      'REVIEWS',
      'NEWEST',
      'BEST_SELLERS',
    ] as const)
      .transform((value) => value.toLowerCase())
      .optional(),
    category_id: z.string().trim().max(40).optional(),
    min_price: z.coerce.number().min(0).optional(),
    max_price: z.coerce.number().min(0).optional(),
    brand: z.string().trim().max(120).optional(),
    condition: normalizedEnum(['NEW', 'USED', 'RENEWED'] as const)
      .transform((value) => value.toLowerCase())
      .optional(),
    is_prime: booleanParam.optional(),
    deals_and_discounts: booleanParam.optional(),
    ...common,
  })
  .strict()
  .refine((value) => value.min_price === undefined || value.max_price === undefined || value.min_price <= value.max_price, {
    message: 'min_price must be less than or equal to max_price',
    path: ['min_price'],
  });

export const asinInputSchema = z
  .object({ asin: asinSchema, ...common })
  .strict();

export const offersInputSchema = z
  .object({
    asin: asinSchema,
    condition: normalizedEnum(['NEW', 'USED', 'RENEWED'] as const)
      .transform((value) => value.toLowerCase())
      .optional(),
    page: intParam(1, 20),
    limit: intParam(10, 50),
    delivery: z.string().trim().max(60).optional(),
    ...common,
  })
  .strict();

export const reviewsInputSchema = z
  .object({
    asin: asinSchema,
    cursor: z.string().trim().min(1).max(2048).optional(),
    sort_by: normalizedEnum(['TOP_REVIEWS', 'MOST_RECENT'] as const)
      .transform((value) => value.toLowerCase())
      .optional(),
    star_rating: normalizedEnum(['ALL', '5', '4', '3', '2', '1', 'POSITIVE', 'CRITICAL'] as const)
      .transform((value) => value.toLowerCase())
      .optional(),
    verified_purchases_only: booleanParam.optional(),
    images_or_videos_only: booleanParam.optional(),
    current_format_only: booleanParam.optional(),
    ...common,
  })
  .strict();

export const bestSellersInputSchema = z
  .object({
    category: z.string().trim().max(160).optional(),
    type: normalizedEnum([
      'BEST_SELLERS',
      'NEW_RELEASES',
      'MOVERS_AND_SHAKERS',
      'MOST_WISHED_FOR',
      'GIFT_IDEAS',
    ] as const).default('BEST_SELLERS'),
    page: intParam(1, 20),
    ...common,
  })
  .strict();

export const dealsInputSchema = z
  .object({
    page: intParam(1, 20),
    min_product_star_rating: z.coerce.number().min(1).max(5).optional(),
    price_range: rangeParam.optional(),
    discount_range: rangeParam.optional(),
    category: z.string().trim().max(120).optional(),
    deal_state: normalizedEnum(['AVAILABLE', 'UPCOMING', 'ENDED'] as const)
      .transform((value) => value.toLowerCase())
      .optional(),
    ...common,
  })
  .strict();

export const dealProductsInputSchema = z
  .object({ deal_id: z.string().trim().min(1).max(160), page: intParam(1, 20), ...common })
  .strict();

export const promoCodeInputSchema = z
  .object({ promo_code: z.string().trim().min(1).max(120), ...common })
  .strict();

export const asinToGtinInputSchema = z
  .object({
    asin: asinSchema,
    type: normalizedEnum(['EAN-13', 'UPC', 'ISBN'] as const).default('EAN-13'),
    ...common,
  })
  .strict();

export const gtinToAsinInputSchema = z
  .object({ gtin: gtinSchema, ...common })
  .strict();

export const categoryListInputSchema = z.object({ ...common }).strict();

export const influencerInputSchema = z
  .object({ influencer_name: z.string().trim().min(1).max(160), ...common })
  .strict();

export type SearchInput = z.infer<typeof searchInputSchema>;
export type OffersInput = z.infer<typeof offersInputSchema>;
export type ReviewsInput = z.infer<typeof reviewsInputSchema>;
export type BestSellersInput = z.infer<typeof bestSellersInputSchema>;
export type DealsInput = z.infer<typeof dealsInputSchema>;

/** ---------- Output schemas (guard against silently changed upstream markup) ---------- */

const asinOutput = z.string().regex(/^[A-Z0-9]{10}$/);
const priceOutput = z
  .object({ value: z.number(), currency: z.string(), display: z.string() })
  .passthrough();
const productOutput = z.object({ asin: asinOutput }).passthrough();

export const searchOutputSchema = z
  .object({
    products: z.array(productOutput),
    total_products: z.number(),
    country: z.string(),
    page: z.number(),
    query: z.string(),
  })
  .passthrough();

export const productDetailsOutputSchema = z
  .object({ asin: asinOutput, country: z.string() })
  .passthrough();

export const offersOutputSchema = z
  .object({ product: z.object({ asin: asinOutput }).passthrough(), offers: z.array(z.object({}).passthrough()), country: z.string() })
  .passthrough();

export const reviewsOutputSchema = z
  .object({
    asin: asinOutput,
    reviews: z.array(
      z.object({ id: z.string(), verified: z.boolean(), helpful_votes: z.number() }).passthrough(),
    ),
    country: z.string(),
  })
  .passthrough();

export const bestSellersOutputSchema = z
  .object({ products: z.array(z.object({ asin: asinOutput, rank: z.number() }).passthrough()), country: z.string() })
  .passthrough();

export const dealsOutputSchema = z
  .object({ deals: z.array(z.object({ deal_id: z.string() }).passthrough()), country: z.string() })
  .passthrough();

export const dealProductsOutputSchema = z
  .object({ deal_id: z.string(), products: z.array(productOutput), country: z.string() })
  .passthrough();

export const promoCodeOutputSchema = z
  .object({ promo_code: z.string(), products: z.array(productOutput), country: z.string() })
  .passthrough();

export const asinToGtinOutputSchema = z
  .object({ asin: asinOutput, type: z.string(), value: z.string(), country: z.string() })
  .passthrough();

export const gtinToAsinOutputSchema = z
  .object({ gtin: z.string(), products: z.array(productOutput), country: z.string() })
  .passthrough();

export const categoryListOutputSchema = z
  .object({ categories: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()), country: z.string() })
  .passthrough();

export const influencerOutputSchema = z
  .object({ name: z.string(), url: z.string(), country: z.string() })
  .passthrough();

export const priceOutputSchema = priceOutput;

export function describeZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.length ? issue.path.join('.') : 'request'}: ${issue.message}`)
    .join('; ');
}
