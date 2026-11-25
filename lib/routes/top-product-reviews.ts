import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { TTL } from '../cache';
import { fetchAmazonPage } from '../fetcher';
import { parseTopReviews } from '../parsers/reviews';
import { asinInputSchema, reviewsOutputSchema } from '../schemas';
import { productPath } from '../urls';
import { dataResponse } from './shared';

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
