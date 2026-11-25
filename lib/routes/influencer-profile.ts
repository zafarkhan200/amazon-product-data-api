import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { TTL } from '../cache.js';
import { fetchAmazonPage } from '../fetcher.js';
import { parseInfluencerProfile } from '../parsers/influencer.js';
import { influencerInputSchema, influencerOutputSchema } from '../schemas.js';
import { influencerPath } from '../urls.js';
import { dataResponse } from './shared.js';

export const influencerRoutes = new Hono<AppEnv>();

influencerRoutes.get('/', (c) =>
  dataResponse(c, {
    endpoint: 'influencer_profile',
    input: influencerInputSchema,
    output: influencerOutputSchema,
    ttl: TTL.influencer_profile,
    load: async (params, country) => {
      const { html } = await fetchAmazonPage(influencerPath(params.influencer_name), country);
      return parseInfluencerProfile(html, country, params.influencer_name);
    },
  }),
);
