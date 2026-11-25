import type { Context } from 'hono';

export type PlanName = 'BASIC' | 'PRO' | 'ULTRA' | 'MEGA';

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export type AppEnv = {
  Variables: {
    requestId: string;
    plan: PlanName;
    rateLimit: RateLimitInfo;
  };
};

export type AppContext = Context<AppEnv>;
