import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { TTL } from '../cache.js';
import { fetchAmazonPage } from '../fetcher.js';
import { parseTopReviews } from '../parsers/reviews.js';
import { asinInputSchema, reviewsOutputSchema } from '../schemas.js';
import { productPath } from '../urls.js';
import { dataResponse } from './shared.js';

export const topProductReviewsRoutes = new Hono<AppEnv>();

topProductReviewsRoutes.get('/', (c) =>
  dataResponse(c, {
    endpoint: 'top_product_reviews',
    input: asinInputSchema,
    output: reviewsOutputSchema,
    ttl: TTL.top_product_reviews,
    load: async (params, country) => {
      const { html } = await fetchAmazonPage(productPath(params.asin), country);
      return parseTopReviews(html, country, params.asin);
    },
  }),
);
