import { afterEach, describe, expect, it } from 'vitest';
import app from '../lib/app';
import { buildCacheKey } from '../lib/cache';

const savedEnv = { ...process.env };

afterEach(() => {
  process.env = { ...savedEnv };
});

function enableDirectAccess() {
  process.env.NODE_ENV = 'test';
  process.env.ALLOW_DIRECT_ACCESS = 'true';
}

describe('API envelope, auth and validation', () => {
  it('serves /health and /openapi.json without authentication', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ORIGIN_AUTH_HEADER = 'x-origin-api-key';
    process.env.ORIGIN_AUTH_SECRET = 'secret';
    delete process.env.ALLOW_DIRECT_ACCESS;

    const health = await app.request('/health');
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ status: 'OK' });

    const spec = await app.request('/openapi.json');
    expect(spec.status).toBe(200);
    const document = (await spec.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(document.openapi).toBe('3.0.3');
    expect(Object.keys(document.paths).length).toBe(15);
  });

  it('returns a consistent error envelope for bad parameters', async () => {
    enableDirectAccess();
    const response = await app.request('/search', { headers: { 'x-api-market-key': 'test-validation' } });
    expect(response.status).toBe(400);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    const body = (await response.json()) as Record<string, any>;
    expect(body.status).toBe('ERROR');
    expect(body.request_id).toBeTruthy();
    expect(body.error.code).toBe(400);
    expect(body.error.message).toContain('query');
  });

  it('rejects unknown params and unsupported countries', async () => {
    enableDirectAccess();
    const unknown = await app.request('/search?query=headphones&unexpected=1', {
      headers: { 'x-api-market-key': 'test-unknown' },
    });
    expect(unknown.status).toBe(400);

    const country = await app.request('/search?query=headphones&country=ZZ', {
      headers: { 'x-api-market-key': 'test-country' },
    });
    expect(country.status).toBe(400);
  });

  it('returns a 404 envelope for unknown routes', async () => {
    enableDirectAccess();
    const response = await app.request('/does-not-exist', {
      headers: { 'x-api-market-key': 'test-404' },
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      status: 'ERROR',
      error: { code: 404 },
    });
  });

  it('requires the api.market origin credential in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ORIGIN_AUTH_HEADER = 'x-origin-api-key';
    process.env.ORIGIN_AUTH_SECRET = 'correct-secret';
    delete process.env.ALLOW_DIRECT_ACCESS;

    const missing = await app.request('/search?query=headphones', {
      headers: { 'x-api-market-key': 'test-auth-missing' },
    });
    expect(missing.status).toBe(403);
    expect((await missing.json()) as Record<string, unknown>).toMatchObject({
      status: 'ERROR',
      error: { code: 403 },
    });

    const wrong = await app.request('/search?query=headphones', {
      headers: { 'x-api-market-key': 'test-auth-wrong', 'x-origin-api-key': 'nope' },
    });
    expect(wrong.status).toBe(403);

    const correct = await app.request('/search', {
      headers: {
        'x-api-market-key': 'test-auth-correct',
        'x-origin-api-key': 'correct-secret',
      },
    });
    expect(correct.status).toBe(400);
  });

  it('emits secondary rate limit headers', async () => {
    enableDirectAccess();
    const response = await app.request('/search', {
      headers: { 'x-api-market-key': 'test-headers' },
    });
    expect(response.headers.get('x-ratelimit-requests-limit')).toBe('1');
    expect(response.headers.get('x-ratelimit-requests-remaining')).toBeTruthy();
    expect(response.headers.get('x-ratelimit-requests-reset')).toBeTruthy();
  });

  it('builds stable, order-independent cache keys', () => {
    expect(buildCacheKey('search', { query: 'Sony', country: 'US', page: 1 })).toBe(
      buildCacheKey('search', { page: 1, country: 'us', query: '  sony ' }),
    );
    expect(buildCacheKey('search', { query: 'Sony' })).not.toBe(
      buildCacheKey('product_details', { query: 'Sony' }),
    );
  });
});
