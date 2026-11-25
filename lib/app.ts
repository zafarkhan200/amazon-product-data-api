import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { authMiddleware } from './auth';
import { ApiError } from './errors';
import { openApiSpec } from './openapi';
import { rateLimitMiddleware } from './rate-limit';
import { asinToGtinRoutes } from './routes/asin-to-gtin';
import { bestSellersRoutes } from './routes/best-sellers';
import { categoryListRoutes } from './routes/product-category-list';
import { dealProductsRoutes } from './routes/deal-products';
import { dealsRoutes } from './routes/deals';
import { gtinToAsinRoutes } from './routes/gtin-to-asin';
import { influencerRoutes } from './routes/influencer-profile';
import { productDetailsRoutes } from './routes/product-details';
import { productOffersRoutes } from './routes/product-offers';
import { productReviewsRoutes } from './routes/product-reviews';
import { promoCodeRoutes } from './routes/promo-code-details';
import { searchRoutes } from './routes/search';
import { topProductReviewsRoutes } from './routes/top-product-reviews';
import type { AppEnv } from './app-env';

const app = new Hono<AppEnv>();
const startedAt = Date.now();

app.use('*', async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? randomUUID();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  await next();
});

app.get('/health', (c) =>
  c.json({
    status: 'OK',
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  }),
);

app.get('/openapi.json', (c) => c.json(openApiSpec));

app.use('*', authMiddleware);
app.use('*', rateLimitMiddleware);

app.route('/search', searchRoutes);
app.route('/product-details', productDetailsRoutes);
app.route('/product-offers', productOffersRoutes);
app.route('/product-reviews', productReviewsRoutes);
app.route('/top-product-reviews', topProductReviewsRoutes);
app.route('/best-sellers', bestSellersRoutes);
app.route('/deals', dealsRoutes);
app.route('/deal-products', dealProductsRoutes);
app.route('/promo-code-details', promoCodeRoutes);
app.route('/asin-to-gtin', asinToGtinRoutes);
app.route('/gtin-to-asin', gtinToAsinRoutes);
app.route('/product-category-list', categoryListRoutes);
app.route('/influencer-profile', influencerRoutes);

app.notFound((c) =>
  c.json(
    {
      status: 'ERROR',
      request_id: c.get('requestId') ?? randomUUID(),
      error: { message: 'Route not found', code: 404 },
    },
    404,
  ),
);

app.onError((error, c) => {
  const requestId = c.get('requestId') ?? randomUUID();
  if (error instanceof ApiError) {
    return c.json(
      {
        status: 'ERROR',
        request_id: requestId,
        error: { message: error.message, code: error.code },
      },
      error.status as never,
    );
  }

  console.error('[unhandled]', error);
  return c.json(
    {
      status: 'ERROR',
      request_id: requestId,
      error: { message: 'Internal server error', code: 500 },
    },
    500,
  );
});

export default app;
