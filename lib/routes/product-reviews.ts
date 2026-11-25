import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { TTL } from '../cache.js';
import { fetchAmazonReviewsData } from '../fetcher.js';
import { reviewsInputSchema, reviewsOutputSchema } from '../schemas.js';
import { dataResponse } from './shared.js';

type ZenRowsReview = {
  review_id?: unknown;
  author?: unknown;
  rating?: unknown;
  title?: unknown;
  body?: unknown;
  date?: unknown;
  verified_purchase?: unknown;
  helpful_votes?: unknown;
  variation_color?: unknown;
  variation_configuration?: unknown;
};

export const productReviewsRoutes = new Hono<AppEnv>();

productReviewsRoutes.get('/', (c) =>
  dataResponse(c, {
    endpoint: 'product_reviews',
    input: reviewsInputSchema,
    output: reviewsOutputSchema,
    ttl: TTL.product_reviews,
    load: async (params, country) => {
      // ZenRows' Amazon reviews extractor requires the product detail URL (/dp/ASIN).
      // The /product-reviews/ASIN URL is rejected by the provider for this workflow.
      const data = await fetchAmazonReviewsData(params.asin, country);
      const rawReviews = Array.isArray(data.customer_reviews)
        ? (data.customer_reviews as ZenRowsReview[])
        : [];

      let reviews = rawReviews
        .filter((review) => typeof review.review_id === 'string' && review.review_id.length > 0)
        .map((review) => ({
          id: review.review_id as string,
          title: typeof review.title === 'string' ? review.title : undefined,
          text: typeof review.body === 'string' ? review.body : undefined,
          author: typeof review.author === 'string' ? review.author : undefined,
          date: typeof review.date === 'string' ? review.date : undefined,
          rating: typeof review.rating === 'number' ? review.rating : undefined,
          verified: review.verified_purchase === true,
          helpful_votes:
            typeof review.helpful_votes === 'number' && Number.isFinite(review.helpful_votes)
              ? review.helpful_votes
              : 0,
          variation_color:
            typeof review.variation_color === 'string' ? review.variation_color : undefined,
          variation_configuration:
            typeof review.variation_configuration === 'string'
              ? review.variation_configuration
              : undefined,
        }));

      if (params.star_rating && params.star_rating !== 'all') {
        if (params.star_rating === 'positive') reviews = reviews.filter((review) => (review.rating ?? 0) >= 4);
        else if (params.star_rating === 'critical') reviews = reviews.filter((review) => (review.rating ?? 0) <= 2);
        else reviews = reviews.filter((review) => review.rating === Number(params.star_rating));
      }
      if (params.verified_purchases_only) {
        reviews = reviews.filter((review) => review.verified);
      }

      return {
        asin: params.asin,
        reviews: reviews.slice(0, 10),
        country: country.code,
        ratings_summary: data.ratings_summary,
        review_insights: data.review_insights,
      };
    },
  }),
);
