import { COUNTRY_CODES } from './countries';

type Obj = Record<string, unknown>;

const p = (name: string, schema: Obj, description?: string, required = false) => ({
  name,
  in: 'query',
  required,
  description,
  schema,
});

const asin = p('asin', { type: 'string', pattern: '^[A-Za-z0-9]{10}$' }, 'Amazon ASIN', true);
const country = p(
  'country',
  { type: 'string', enum: [...COUNTRY_CODES], default: 'US' },
  'Amazon marketplace country code',
);
const fresh = p(
  'fresh',
  { type: 'boolean', default: false },
  'Bypass the cache and force a live upstream fetch',
);
const page = p('page', { type: 'integer', minimum: 1, default: 1 }, 'Page number');
const booleanFilter = (name: string, description: string) =>
  p(name, { type: 'boolean', default: false }, description);
const sortBy = (values: string[], description: string) =>
  p('sort_by', { type: 'string', enum: values }, description);

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const errorResponses: Obj = {
  400: { description: 'Missing or invalid parameter', content: { 'application/json': { schema: ref('ErrorEnvelope') } } },
  401: { description: 'Invalid API key', content: { 'application/json': { schema: ref('ErrorEnvelope') } } },
  403: { description: 'Not subscribed or origin proxy secret missing', content: { 'application/json': { schema: ref('ErrorEnvelope') } } },
  404: { description: 'Resource or route not found', content: { 'application/json': { schema: ref('ErrorEnvelope') } } },
  429: { description: 'Rate limit or quota exceeded', content: { 'application/json': { schema: ref('ErrorEnvelope') } } },
  502: { description: 'Upstream blocked', content: { 'application/json': { schema: ref('ErrorEnvelope') } } },
  503: { description: 'Upstream temporarily unavailable', content: { 'application/json': { schema: ref('ErrorEnvelope') } } },
  504: { description: 'Upstream fetch timed out', content: { 'application/json': { schema: ref('ErrorEnvelope') } } },
};

function operation(options: {
  summary: string;
  description?: string;
  tag: string;
  parameters?: Obj[];
  data: Obj;
  security?: Obj[];
}): Obj {
  return {
    summary: options.summary,
    description: options.description,
    tags: [options.tag],
    parameters: [...(options.parameters ?? []), country, fresh],
    security: options.security,
    responses: {
      200: {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: { allOf: [ref('SuccessEnvelope'), { type: 'object', properties: { data: options.data } }] },
          },
        },
      },
      ...errorResponses,
    },
  };
}

export const openApiSpec: Obj = {
  openapi: '3.0.3',
  info: {
    title: 'Amazon Product Data API',
    version: '1.0.0',
    description:
      'Structured Amazon product data in real time. All responses use a common envelope with request_id and freshness metadata. Distributed through the api.market gateway; direct calls to the origin require the configured origin credential.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Utility' },
    { name: 'Search' },
    { name: 'Products' },
    { name: 'Reviews' },
    { name: 'Discovery' },
    { name: 'Identifiers' },
    { name: 'Influencers' },
  ],
  security: [{ ApiMarketKey: [] }],
  paths: {
    '/health': {
      get: {
        summary: 'Health check (no authentication)',
        tags: ['Utility'],
        security: [],
        responses: {
          200: {
            description: 'Service is up',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'OK' },
                    uptime_seconds: { type: 'number' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/openapi.json': {
      get: {
        summary: 'Machine-readable OpenAPI 3 specification (no authentication)',
        tags: ['Utility'],
        security: [],
        responses: { 200: { description: 'OpenAPI document', content: { 'application/json': { schema: { type: 'object' } } } } },
      },
    },
    '/search': {
      get: operation({
        summary: 'Product search',
        tag: 'Search',
        data: ref('SearchData'),
        parameters: [
          p('query', { type: 'string' }, 'Search keywords', true),
          page,
          sortBy(
            ['relevance', 'lowest_price', 'highest_price', 'reviews', 'newest', 'best_sellers'],
            'Sort order',
          ),
          p('category_id', { type: 'string' }, 'Amazon category node id'),
          p('min_price', { type: 'number' }),
          p('max_price', { type: 'number' }),
          p('brand', { type: 'string' }),
          p('condition', { type: 'string', enum: ['new', 'used', 'renewed'] }),
          booleanFilter('is_prime', 'Only Prime-eligible products'),
          booleanFilter('deals_and_discounts', 'Only products with deals'),
        ],
      }),
    },
    '/product-details': {
      get: operation({
        summary: 'Full product details',
        tag: 'Products',
        data: ref('ProductDetails'),
        parameters: [asin],
      }),
    },
    '/product-offers': {
      get: operation({
        summary: 'Buy box and marketplace offers',
        tag: 'Products',
        data: ref('OffersData'),
        parameters: [
          asin,
          p('condition', { type: 'string', enum: ['new', 'used', 'renewed'] }),
          page,
          p('limit', { type: 'integer', default: 10, minimum: 1, maximum: 50 }),
          p('delivery', { type: 'string' }, 'Delivery location filter'),
        ],
      }),
    },
    '/product-reviews': {
      get: operation({
        summary: 'Product reviews (10 per page)',
        tag: 'Reviews',
        data: ref('ReviewsData'),
        parameters: [
          asin,
          p('cursor', { type: 'string' }, 'Pagination cursor from the previous response'),
          sortBy(['top_reviews', 'most_recent'], 'Review sort order'),
          p('star_rating', { type: 'string', enum: ['all', '5', '4', '3', '2', '1', 'positive', 'critical'] }),
          booleanFilter('verified_purchases_only', 'Only verified purchases'),
          booleanFilter('images_or_videos_only', 'Only reviews with media'),
          booleanFilter('current_format_only', 'Only current product format'),
        ],
      }),
    },
    '/top-product-reviews': {
      get: operation({
        summary: 'Top reviews shown on the product page',
        tag: 'Reviews',
        data: ref('ReviewsData'),
        parameters: [asin],
      }),
    },
    '/best-sellers': {
      get: operation({
        summary: 'Best sellers and other ranked lists',
        tag: 'Discovery',
        data: ref('BestSellersData'),
        parameters: [
          p('category', { type: 'string' }, 'Category name or path'),
          p('type', {
            type: 'string',
            default: 'BEST_SELLERS',
            enum: ['BEST_SELLERS', 'NEW_RELEASES', 'MOVERS_AND_SHAKERS', 'MOST_WISHED_FOR', 'GIFT_IDEAS'],
          }),
          page,
        ],
      }),
    },
    '/deals': {
      get: operation({
        summary: 'Current, upcoming or ended deals',
        tag: 'Discovery',
        data: ref('DealsData'),
        parameters: [
          page,
          p('min_product_star_rating', { type: 'number', minimum: 1, maximum: 5 }),
          p('price_range', { type: 'string', example: '10-50' }),
          p('discount_range', { type: 'string', example: '20-80' }),
          p('category', { type: 'string' }),
          p('deal_state', { type: 'string', enum: ['available', 'upcoming', 'ended'] }),
        ],
      }),
    },
    '/deal-products': {
      get: operation({
        summary: 'Products in a specific deal',
        tag: 'Discovery',
        data: ref('DealProductsData'),
        parameters: [p('deal_id', { type: 'string' }, 'Deal identifier', true), page],
      }),
    },
    '/promo-code-details': {
      get: operation({
        summary: 'Products offered by a promo code',
        tag: 'Discovery',
        data: ref('PromoCodeData'),
        parameters: [p('promo_code', { type: 'string' }, 'Promo or coupon code', true)],
      }),
    },
    '/asin-to-gtin': {
      get: operation({
        summary: 'Convert an ASIN to EAN-13, UPC or ISBN',
        tag: 'Identifiers',
        data: ref('AsinToGtinData'),
        parameters: [asin, p('type', { type: 'string', enum: ['EAN-13', 'UPC', 'ISBN'], default: 'EAN-13' })],
      }),
    },
    '/gtin-to-asin': {
      get: operation({
        summary: 'Find ASINs matching a GTIN',
        tag: 'Identifiers',
        data: ref('GtinToAsinData'),
        parameters: [p('gtin', { type: 'string' }, 'UPC, EAN or ISBN', true)],
      }),
    },
    '/product-category-list': {
      get: operation({
        summary: 'Category ids and names for use with search',
        tag: 'Discovery',
        data: ref('CategoryListData'),
      }),
    },
    '/influencer-profile': {
      get: operation({
        summary: 'Amazon influencer store profile',
        tag: 'Influencers',
        data: ref('InfluencerProfileData'),
        parameters: [p('influencer_name', { type: 'string' }, 'Influencer name or handle', true)],
      }),
    },
  },
  components: {
    securitySchemes: {
      ApiMarketKey: { type: 'apiKey', in: 'header', name: 'x-api-market-key' },
    },
    schemas: {
      SuccessEnvelope: {
        type: 'object',
        required: ['status', 'request_id', 'parameters', 'meta', 'data'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          request_id: { type: 'string', format: 'uuid' },
          parameters: { type: 'object', additionalProperties: true },
          meta: {
            type: 'object',
            properties: {
              cache_hit: { type: 'boolean' },
              fetched_at: { type: 'string', format: 'date-time' },
            },
          },
          data: {},
        },
      },
      ErrorEnvelope: {
        type: 'object',
        required: ['status', 'request_id', 'error'],
        properties: {
          status: { type: 'string', enum: ['ERROR'] },
          request_id: { type: 'string', format: 'uuid' },
          error: {
            type: 'object',
            required: ['message', 'code'],
            properties: {
              message: { type: 'string' },
              code: { type: 'integer', enum: [400, 401, 403, 404, 429, 500, 502, 503, 504] },
            },
          },
        },
      },
      Price: {
        type: 'object',
        required: ['value', 'currency', 'display'],
        properties: {
          value: { type: 'number' },
          currency: { type: 'string' },
          display: { type: 'string' },
          original_value: { type: 'number' },
          original_display: { type: 'string' },
          discount_percent: { type: 'number' },
        },
      },
      Rating: {
        type: 'object',
        properties: {
          value: { type: 'number' },
          count: { type: 'integer' },
          distribution: { type: 'object', additionalProperties: { type: 'number' } },
        },
      },
      Product: {
        type: 'object',
        required: ['asin'],
        properties: {
          asin: { type: 'string' },
          title: { type: 'string' },
          price: ref('Price'),
          original_price: { type: 'string' },
          currency: { type: 'string' },
          rating: ref('Rating'),
          rating_count: { type: 'integer' },
          photo: { type: 'string', format: 'uri' },
          url: { type: 'string', format: 'uri' },
          prime: { type: 'boolean' },
          sales_volume: { type: 'string' },
          delivery_text: { type: 'string' },
          badges: { type: 'array', items: { type: 'string' } },
        },
      },
      ProductDetails: {
        allOf: [
          ref('Product'),
          {
            type: 'object',
            properties: {
              description: { type: 'string' },
              about_bullets: { type: 'array', items: { type: 'string' } },
              brand: { type: 'string' },
              images: { type: 'array', items: { type: 'string' } },
              video: { type: 'string' },
              product_information: { type: 'object', additionalProperties: { type: 'string' } },
              variations: { type: 'array', items: { type: 'object', additionalProperties: true } },
              best_sellers_rank: { type: 'array', items: { type: 'object', additionalProperties: true } },
              category_path: { type: 'array', items: { type: 'string' } },
              review_insights: { type: 'array', items: { type: 'string' } },
              buy_box: { type: 'object', additionalProperties: true },
              availability: { type: 'string' },
            },
          },
        ],
      },
      SearchData: {
        type: 'object',
        properties: {
          products: { type: 'array', items: ref('Product') },
          total_products: { type: 'integer' },
          country: { type: 'string' },
          page: { type: 'integer' },
          query: { type: 'string' },
        },
      },
      OffersData: {
        type: 'object',
        properties: {
          product: ref('ProductDetails'),
          offers: { type: 'array', items: { type: 'object', additionalProperties: true } },
          total_offers: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          country: { type: 'string' },
        },
      },
      ReviewsData: {
        type: 'object',
        properties: {
          asin: { type: 'string' },
          reviews: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                text: { type: 'string' },
                rating: { type: 'number' },
                author: { type: 'string' },
                date: { type: 'string' },
                verified: { type: 'boolean' },
                helpful_votes: { type: 'integer' },
                images: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          next_cursor: { type: 'string' },
          country: { type: 'string' },
        },
      },
      BestSellersData: {
        type: 'object',
        properties: {
          products: { type: 'array', items: { allOf: [ref('Product'), { type: 'object', properties: { rank: { type: 'integer' } } }] } },
          category: { type: 'string' },
          type: { type: 'string' },
          page: { type: 'integer' },
          country: { type: 'string' },
        },
      },
      DealsData: {
        type: 'object',
        properties: {
          deals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                deal_id: { type: 'string' },
                title: { type: 'string' },
                type: { type: 'string' },
                discount: { type: 'number' },
                end_time: { type: 'string' },
                claimed_percent: { type: 'number' },
                sample_products: { type: 'array', items: ref('Product') },
              },
            },
          },
          page: { type: 'integer' },
          country: { type: 'string' },
        },
      },
      DealProductsData: {
        type: 'object',
        properties: {
          deal_id: { type: 'string' },
          products: { type: 'array', items: ref('Product') },
          total_products: { type: 'integer' },
          page: { type: 'integer' },
          country: { type: 'string' },
        },
      },
      PromoCodeData: {
        type: 'object',
        properties: {
          promo_code: { type: 'string' },
          title: { type: 'string' },
          discount: { type: 'string' },
          products: { type: 'array', items: ref('Product') },
          total_products: { type: 'integer' },
          country: { type: 'string' },
        },
      },
      AsinToGtinData: {
        type: 'object',
        properties: {
          asin: { type: 'string' },
          type: { type: 'string' },
          value: { type: 'string' },
          country: { type: 'string' },
        },
      },
      GtinToAsinData: {
        type: 'object',
        properties: {
          gtin: { type: 'string' },
          products: { type: 'array', items: ref('Product') },
          total_products: { type: 'integer' },
          country: { type: 'string' },
        },
      },
      CategoryListData: {
        type: 'object',
        properties: {
          categories: {
            type: 'array',
            items: {
              type: 'object',
              properties: { id: { type: 'string' }, name: { type: 'string' }, url: { type: 'string' } },
            },
          },
          country: { type: 'string' },
        },
      },
      InfluencerProfileData: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          url: { type: 'string' },
          bio: { type: 'string' },
          followers: { type: 'integer' },
          avatar: { type: 'string' },
          products: { type: 'array', items: ref('Product') },
          country: { type: 'string' },
        },
      },
    },
  },
};
