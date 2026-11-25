/** Lightweight Node-style Vercel health check without importing the full scraper API. */
import type { IncomingMessage, ServerResponse } from 'node:http';

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'amazon-product-data-api',
  }));
}
