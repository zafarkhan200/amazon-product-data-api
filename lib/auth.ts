import type { MiddlewareHandler } from 'hono';
import { forbidden } from './errors';
import type { AppEnv, PlanName } from './app-env';

const PLANS: PlanName[] = ['BASIC', 'PRO', 'ULTRA', 'MEGA'];

/**
 * Gateway authentication for api.market.
 *
 * api.market authenticates its own subscribers and forwards a shared credential
 * to this origin (configured in the API Source as an API Key header, Bearer
 * token, or query parameter). Requests without the matching value are rejected
 * so the Vercel function cannot bypass marketplace billing.
 */
export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const allowDirect = !isProduction && process.env.ALLOW_DIRECT_ACCESS === 'true';

  if (!allowDirect) {
    const headerName = process.env.ORIGIN_AUTH_HEADER || 'x-origin-api-key';
    const expected = process.env.ORIGIN_AUTH_SECRET;
    const queryParam = process.env.ORIGIN_AUTH_QUERY_PARAM || undefined;

    if (!expected) {
      throw forbidden('Origin authentication secret is not configured');
    }

    const received =
      c.req.header(headerName) ?? (queryParam ? c.req.query(queryParam) : undefined);

    if (!received || received !== expected) {
      throw forbidden('Invalid or missing origin credential');
    }
  }

  // api.market enforces plans at the gateway; the origin limiter uses the
  // configured default plan unless a plan header is forwarded.
  const planHeaderName = process.env.PLAN_HEADER || undefined;
  const planFromHeader = planHeaderName ? c.req.header(planHeaderName) : undefined;
  const requestedPlan = (planFromHeader ?? process.env.DEFAULT_PLAN ?? 'BASIC').trim().toUpperCase();
  c.set('plan', (PLANS.includes(requestedPlan as PlanName) ? requestedPlan : 'BASIC') as PlanName);
  await next();
};
