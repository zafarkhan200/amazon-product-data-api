/** Vercel Node.js entry point. Adapt Node request/response to Hono's Fetch API. */
import { getRequestListener } from '@hono/node-server';
import app from '../lib/app.js';

export default getRequestListener(app.fetch);
