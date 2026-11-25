import { serve } from '@hono/node-server';

// Load local .env before importing the app so modules that read env vars at
// startup (e.g. the Redis client) see the configured values.
try {
  process.loadEnvFile?.('.env');
} catch {
  // .env is optional; Vercel injects environment variables in production.
}

const { default: app } = await import('./lib/app');

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Amazon Product Data API listening on http://localhost:${info.port}`);
  console.log('Docs: http://localhost:' + info.port + '/openapi.json');
});
