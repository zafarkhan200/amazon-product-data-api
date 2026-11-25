import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { TTL } from '../cache';
import { fetchAmazonPage } from '../fetcher';
import { parseReviews } from '../parsers/reviews';
import { reviewsInputSchema, reviewsOutputSchema } from '../schemas';
import { reviewsPath } from '../urls';
import { dataResponse } from './shared';

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
