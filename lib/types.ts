export interface Price {
  value: number;
  currency: string;
  display: string;
  original_value?: number;
  original_display?: string;
  discount_percent?: number;
}

export interface Rating {
  value: number;
  count: number;
  distribution?: Record<string, number>;
}

export interface Product {
  asin: string;
  title?: string;
  url?: string;
  photo?: string;
  price?: Price;
  rating?: Rating;
  brand?: string;
  prime?: boolean;
  sales_volume?: string;
  delivery_text?: string;
  badges?: string[];
}

export interface ProductDetails extends Product {
  country: string;
  description?: string;
  about_bullets?: string[];
  images?: string[];
  video?: string;
  product_information?: Record<string, string>;
  variations?: Array<{ type: string; values: string[] }>;
  best_sellers_rank?: Array<{ rank: number; category: string }>;
  category_path?: string[];
  review_insights?: string[];
  buy_box?: {
    price?: Price;
    seller?: string;
    fulfillment?: string;
    availability?: string;
    shipping?: string;
    is_prime?: boolean;
  };
  availability?: string;
  coupon?: string;
}

export interface SearchData {
  products: Product[];
  total_products: number;
  country: string;
  page: number;
  query: string;
}

export interface Offer {
  seller?: string;
  seller_rating?: number;
  price?: Price;
  shipping?: string;
  delivery_date?: string;
  condition?: string;
  is_fba?: boolean;
  is_prime?: boolean;
  url?: string;
}

export interface OffersData {
  product: ProductDetails | Product;
  offers: Offer[];
  total_offers: number;
  page: number;
  limit: number;
  country: string;
}

export interface Review {
  id: string;
  title?: string;
  text?: string;
  rating?: number;
  author?: string;
  date?: string;
  verified: boolean;
  helpful_votes: number;
  images?: string[];
  url?: string;
}

export interface ReviewsData {
  asin: string;
  reviews: Review[];
  next_cursor?: string;
  country: string;
}

export interface RankedProduct extends Product {
  rank: number;
}

export interface BestSellersData {
  products: RankedProduct[];
  category: string;
  type: string;
  page: number;
  country: string;
}

export interface Deal {
  deal_id: string;
  title?: string;
  type?: string;
  discount?: number;
  end_time?: string;
  claimed_percent?: number;
  photo?: string;
  url?: string;
  sample_products: Product[];
}

export interface DealsData {
  deals: Deal[];
  page: number;
  country: string;
}

export interface DealProductsData {
  deal_id: string;
  products: Product[];
  total_products: number;
  page: number;
  country: string;
}

export interface PromoCodeData {
  promo_code: string;
  title?: string;
  discount?: string;
  products: Product[];
  total_products: number;
  country: string;
}

export interface AsinToGtinData {
  asin: string;
  type: string;
  value: string;
  country: string;
}

export interface GtinToAsinData {
  gtin: string;
  products: Array<Product & { sales_rank?: number; rank_category?: string }>;
  total_products: number;
  country: string;
}

export interface Category {
  id: string;
  name: string;
  url?: string;
}

export interface CategoryListData {
  categories: Category[];
  country: string;
}

export interface InfluencerProfileData {
  name: string;
  url: string;
  bio?: string;
  followers?: number;
  avatar?: string;
  products?: Product[];
  country: string;
}
