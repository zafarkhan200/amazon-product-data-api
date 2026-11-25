import { load } from 'cheerio';
import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { TTL } from '../cache';
import { fetchAmazonPage } from '../fetcher';
import { clean, firstText } from '../parsers/helpers';
import { parseProductCards } from '../parsers/search';
import { promoCodeInputSchema, promoCodeOutputSchema } from '../schemas';
import { promoCodePath } from '../urls';
import { dataResponse } from './shared';

export const promoCodeRoutes = new Hono<AppEnv>();

promoCodeRoutes.get('/', (c) =>
  dataResponse(c, {
    endpoint: 'promo_code_details',
    input: promoCodeInputSchema,
    output: promoCodeOutputSchema,
    ttl: TTL.promo_code_details,
    load: async (params, country) => {
      const { html } = await fetchAmazonPage(promoCodePath(params.promo_code), country);
      const $ = load(html);
      const products = parseProductCards($, country);
      const pageText = clean($('body').text()).slice(0, 5_000);
      const discountMatch = pageText.match(/(\d+(?:\.\d+)?\s*%|\w+\s*off)/i);
      return {
        promo_code: params.promo_code,
        title: firstText($, ['h1', '[data-hook="coupon-title"]']),
        discount: discountMatch?.[0],
        products,
        total_products: products.length,
        country: country.code,
      };
    },
  }),
);
