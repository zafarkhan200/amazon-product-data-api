/** Vercel serverless entry point. All routes are rewritten here by vercel.json. */
import app from '../lib/app.js';

export default async function handler(request: Request): Promise<Response> {
  return app.fetch(request);
}
