/**
 * Amazon marketplace configuration.
 * Launch markets: US, UK, DE, CA, IN, AE. Additional domains are available
 * for the v1/v2 expansion described in the PRD.
 */

export interface CountryConfig {
  code: string;
  domain: string;
  currency: string;
  locale: string;
  language: string;
  name: string;
  launch: boolean;
}

const country = (
  code: string,
  domain: string,
  currency: string,
  locale: string,
  language: string,
  name: string,
  launch = false,
): CountryConfig => ({ code, domain, currency, locale, language, name, launch });

export const COUNTRIES = {
  US: country('US', 'amazon.com', 'USD', 'en_US', 'en', 'United States', true),
  UK: country('UK', 'amazon.co.uk', 'GBP', 'en_GB', 'en', 'United Kingdom', true),
  DE: country('DE', 'amazon.de', 'EUR', 'de_DE', 'de', 'Germany', true),
  CA: country('CA', 'amazon.ca', 'CAD', 'en_CA', 'en', 'Canada', true),
  IN: country('IN', 'amazon.in', 'INR', 'en_IN', 'en', 'India', true),
  AE: country('AE', 'amazon.ae', 'AED', 'en_AE', 'en', 'United Arab Emirates', true),
  FR: country('FR', 'amazon.fr', 'EUR', 'fr_FR', 'fr', 'France'),
  IT: country('IT', 'amazon.it', 'EUR', 'it_IT', 'it', 'Italy'),
  ES: country('ES', 'amazon.es', 'EUR', 'es_ES', 'es', 'Spain'),
  AU: country('AU', 'amazon.com.au', 'AUD', 'en_AU', 'en', 'Australia'),
  JP: country('JP', 'amazon.co.jp', 'JPY', 'ja_JP', 'ja', 'Japan'),
  MX: country('MX', 'amazon.com.mx', 'MXN', 'es_MX', 'es', 'Mexico'),
  BR: country('BR', 'amazon.com.br', 'BRL', 'pt_BR', 'pt', 'Brazil'),
  NL: country('NL', 'amazon.nl', 'EUR', 'nl_NL', 'nl', 'Netherlands'),
  SE: country('SE', 'amazon.se', 'SEK', 'sv_SE', 'sv', 'Sweden'),
  PL: country('PL', 'amazon.pl', 'PLN', 'pl_PL', 'pl', 'Poland'),
  TR: country('TR', 'amazon.com.tr', 'TRY', 'tr_TR', 'tr', 'Turkey'),
  SA: country('SA', 'amazon.sa', 'SAR', 'ar_SA', 'ar', 'Saudi Arabia'),
  EG: country('EG', 'amazon.eg', 'EGP', 'ar_EG', 'ar', 'Egypt'),
  CN: country('CN', 'amazon.cn', 'CNY', 'zh_CN', 'zh', 'China'),
} as const;

export type CountryCode = keyof typeof COUNTRIES;

export const COUNTRY_CODES = Object.keys(COUNTRIES) as [CountryCode, ...CountryCode[]];

export function getCountry(code: string): CountryConfig | undefined {
  return COUNTRIES[code.toUpperCase() as CountryCode];
}

export function requireCountry(code: string): CountryConfig {
  const found = getCountry(code);
  if (!found) throw new Error(`Unknown country: ${code}`);
  return found;
}

export function amazonBaseUrl(country: CountryConfig): string {
  return `https://www.${country.domain}`;
}
