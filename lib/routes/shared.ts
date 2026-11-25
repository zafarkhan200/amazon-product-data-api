import type { ZodTypeAny, z } from 'zod';
import type { AppContext } from '../app-env.js';
import { cached } from '../cache.js';
import { getCountry } from '../countries.js';
import type { CountryConfig } from '../countries.js';
import { ApiError, badRequest } from '../errors.js';
import { ok } from '../response.js';
import { describeZodError } from '../schemas.js';

/**
 * Shared request pipeline: validate query -> cache lookup -> upstream fetch and
 * parse -> validate output -> return the standard envelope.
 */
export async function dataResponse<I extends ZodTypeAny, T>(
  c: AppContext,
  options: {
    endpoint: string;
    input: I;
    output: ZodTypeAny;
    ttl: number;
    load: (params: z.infer<I>, country: CountryConfig) => Promise<T>;
  },
) {
  const parsed = options.input.safeParse(c.req.query());
  if (!parsed.success) {
    throw badRequest(`Invalid parameters: ${describeZodError(parsed.error)}`);
  }

  const params = parsed.data;
  const country = getCountry((params as { country: string }).country)!;

  const result = await cached<T>({
    endpoint: options.endpoint,
    params: params as Record<string, unknown>,
    ttl: options.ttl,
    fresh: (params as { fresh?: boolean }).fresh,
    loader: () => options.load(params, country),
  });

  const validated = options.output.safeParse(result.data);
  if (!validated.success) {
    console.warn(`[${options.endpoint}] upstream schema mismatch`, describeZodError(validated.error));
    throw new ApiError(502, 'Upstream data did not match the expected schema');
  }

  return ok(c, validated.data, {
    parameters: params,
    cacheHit: result.cacheHit,
    fetchedAt: result.fetchedAt,
  });
}
