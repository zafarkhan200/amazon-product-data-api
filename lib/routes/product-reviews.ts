import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { TTL } from '../cache.js';
import { fetchAmazonPage } from '../fetcher.js';
import { parseReviews } from '../parsers/reviews.js';
import { reviewsInputSchema, reviewsOutputSchema } from '../schemas.js';
import { reviewsPath } from '../urls.js';
import { dataResponse } from './shared.js';

export const productReviewsRoutes = new Hono<AppEnv>();

productReviewsRoutes.get('/', (c) =>
  dataResponse(c, {
    endpoint: 'product_reviews',
    input: reviewsInputSchema,
    output: reviewsOutputSchema,
    ttl: TTL.product_reviews,
    load: async (params, country) => {
      const { html } = await fetchAmazonPage(reviewsPath(params), country);
      return parseReviews(html, country, params.asin);
    },
  }),
);
