/**
 * Proxy-aware upstream client. Plain HTTP + Cheerio is used by default (no
 * headless browser in serverless). Supports rotating proxy URLs, a scraper
 * provider template, and an unblocker fallback for blocked pages.
 */
import { ProxyAgent, type Dispatcher } from 'undici';
import type { CountryConfig } from './countries.js';
import { amazonBaseUrl } from './countries.js';
import { ApiError, fetchTimeout, notFound, upstreamBlocked, upstreamUnavailable } from './errors.js';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
];

export interface FetchResult {
  html: string;
  url: string;
  status: number;
}

export function isCaptchaPage(html: string): boolean {
  return /captcha|robot check|automated access|api-services-support@amazon\.com|validateCaptcha/i.test(
    html.slice(0, 60_000),
  );
}

function listFromEnv(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function timeoutMs(): number {
  const configured = Number(process.env.FETCH_TIMEOUT_MS ?? 12_000);
  return Number.isFinite(configured) && configured > 0 ? configured : 12_000;
}

function retries(): number {
  const configured = Number(process.env.FETCH_RETRIES ?? 2);
  return Math.min(3, Math.max(0, Number.isFinite(configured) ? configured : 2));
}

function withTemplate(template: string | undefined, targetUrl: string): string | undefined {
  if (!template) return undefined;
  return template.replace('{url}', encodeURIComponent(targetUrl));
}

async function fetchOnce(
  targetUrl: string,
  country: CountryConfig,
  options: { proxyUrl?: string; template?: string },
): Promise<FetchResult> {
  const requestUrl = withTemplate(options.template, targetUrl) ?? targetUrl;
  const headers: Record<string, string> = {
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': `${country.locale.replace('_', '-')},en;q=0.8`,
    'user-agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!,
    'cache-control': 'no-cache',
  };

  let dispatcher: Dispatcher | undefined;
  if (options.proxyUrl && !options.template) {
    dispatcher = new ProxyAgent(options.proxyUrl);
  }

  try {
    const response = await fetch(requestUrl, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs()),
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit);
    const html = await response.text();
    return { html, url: targetUrl, status: response.status };
  } finally {
    void dispatcher?.close();
  }
}

/** Fetch an Amazon page and return its HTML, retrying blocked/transient responses. */
export async function fetchAmazonPage(
  path: string,
  country: CountryConfig,
  options: { extraHeaders?: Record<string, string> } = {},
): Promise<FetchResult> {
  const targetUrl = `${amazonBaseUrl(country)}${path}`;
  const proxies = listFromEnv('PROXY_URLS');
  const scraperTemplate = process.env.SCRAPER_API_URL;
  const unblockerTemplate = process.env.UNBLOCKER_URL_TEMPLATE;
  const attempts = 1 + retries();
  let lastError: Error = upstreamUnavailable();

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const result = await fetchOnce(targetUrl, country, {
        proxyUrl: proxies.length ? proxies[attempt % proxies.length] : undefined,
        template: scraperTemplate,
      });
      if (isCaptchaPage(result.html) || result.status === 403 || result.status === 429) {
        lastError = upstreamBlocked(`Amazon returned a robot check or a ${result.status} response`);
        continue;
      }
      if (result.status >= 500) {
        lastError = upstreamUnavailable(`Amazon returned HTTP ${result.status}`);
        continue;
      }
      if (result.status === 404) throw notFound('The requested Amazon resource was not found');
      // Other 4xx responses are terminal.
      if (result.status >= 400) throw upstreamUnavailable(`Amazon returned HTTP ${result.status}`);
      return result;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) {
        lastError = fetchTimeout();
      } else if (error instanceof Error) {
        lastError = error;
      }
    }
  }

  if (unblockerTemplate) {
    try {
      const result = await fetchOnce(targetUrl, country, { template: unblockerTemplate });
      if (!isCaptchaPage(result.html) && result.status < 400) return result;
      lastError = upstreamBlocked('Unblocker fallback still returned a robot check');
    } catch (error) {
      lastError = error instanceof Error ? error : upstreamUnavailable();
    }
  }

  throw lastError;
}
