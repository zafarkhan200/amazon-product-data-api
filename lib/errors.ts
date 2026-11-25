/**
 * Application error. The `code` is the numeric code documented in PRD section 7.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = status;
  }
}

export const badRequest = (message: string) => new ApiError(400, message);
export const unauthorized = (message = 'Invalid or missing API credentials') =>
  new ApiError(401, message);
export const forbidden = (message = 'Not authorized to call this API') =>
  new ApiError(403, message);
export const notFound = (message = 'Resource not found') => new ApiError(404, message);
export const rateLimited = (message = 'Rate limit or quota exceeded') =>
  new ApiError(429, message);
export const upstreamBlocked = (message = 'Upstream blocked the request; retry later') =>
  new ApiError(502, message);
export const upstreamUnavailable = (message = 'Upstream temporarily unavailable; retry later') =>
  new ApiError(503, message);
export const fetchTimeout = (message = 'Upstream fetch timed out; retry later') =>
  new ApiError(504, message);
