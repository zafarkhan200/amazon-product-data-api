/** Lightweight Vercel health check without importing the full scraper API. */
export default function handler(): Response {
  return Response.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'amazon-product-data-api',
  });
}
