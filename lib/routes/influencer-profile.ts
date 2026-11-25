import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { TTL } from '../cache';
import { fetchAmazonPage } from '../fetcher';
import { parseInfluencerProfile } from '../parsers/influencer';
import { influencerInputSchema, influencerOutputSchema } from '../schemas';
import { influencerPath } from '../urls';
import { dataResponse } from './shared';

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
