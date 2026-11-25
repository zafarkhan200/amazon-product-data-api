import type { AppContext } from './app-env';

/** Standard response envelope described in PRD section 7. */
export function ok(
  c: AppContext,
  data: unknown,
  meta: { parameters: unknown; cacheHit: boolean; fetchedAt: string },
) {
  const requestId = c.get('requestId');
  c.header('x-request-id', requestId);
  c.header('x-cache', meta.cacheHit ? 'HIT' : 'MISS');
  c.header('cache-control', 'no-store');
  return c.json({
    status: 'OK',
    request_id: requestId,
    parameters: meta.parameters,
    meta: { cache_hit: meta.cacheHit, fetched_at: meta.fetchedAt },
    data,
  });
}
