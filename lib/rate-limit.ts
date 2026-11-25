import type { MiddlewareHandler } from 'hono';
import type { AppEnv, PlanName } from './app-env';
import { rateLimited } from './errors';
import { storeIncrementWindow } from './store';

/** Requests per second, per consumer (PRD section 8.3). */
export const PLAN_LIMITS: Record<PlanName, number> = {
  BASIC: Number(process.env.RATE_LIMIT_BASIC ?? 1),
  PRO: Number(process.env.RATE_LIMIT_PRO ?? 5),
  ULTRA: Number(process.env.RATE_LIMIT_ULTRA ?? 10),
  MEGA: Number(process.env.RATE_LIMIT_MEGA ?? 25),
};

const WINDOW_SECONDS = 1;

export const rateLimitMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const plan = c.get('plan') ?? 'BASIC';
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.BASIC;
  const consumerHeaderNames = [
    process.env.CONSUMER_ID_HEADER,
    'x-api-market-key',
  ].filter((name): name is string => Boolean(name));
  const consumer =
    consumerHeaderNames.map((name) => c.req.header(name)).find(Boolean) ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'anonymous';

  const { count, resetInSeconds } = await storeIncrementWindow(
    `ratelimit:${plan}:${consumer}`,
    WINDOW_SECONDS,
  );
  const remaining = Math.max(0, limit - count);
  const reset = Math.floor(Date.now() / 1000) + resetInSeconds;

  c.set('rateLimit', { limit, remaining, reset });
  c.header('x-ratelimit-requests-limit', String(limit));
  c.header('x-ratelimit-requests-remaining', String(remaining));
  c.header('x-ratelimit-requests-reset', String(reset));

  if (count > limit) {
    c.header('retry-after', String(resetInSeconds));
    throw rateLimited(`Rate limit exceeded for the ${plan} plan (${limit} req/sec)`);
  }

  await next();
};
