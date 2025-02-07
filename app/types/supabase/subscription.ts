import { Tables } from '@/types_db'

export type Price = Tables<'prices'>
/*
type Price = {
    active: boolean | null;
    currency: string | null;
    id: string;
    interval: Database["public"]["Enums"]["pricing_plan_interval"] | null;
    interval_count: number | null;
    product_id: string | null;
    trial_period_days: number | null;
    type: Database["public"]["Enums"]["pricing_type"] | null;
    unit_amount: number | null;
}
    */

export type Product = Tables<'products'>
/* 
type Product = {
    active: boolean | null;
    description: string | null;
    id: string;
    image: string | null;
    metadata: Json | null;
    name: string | null;
} */

export type Subscription = Tables<'subscriptions'>

/* type Subscription = {
    cancel_at: string | null;
    cancel_at_period_end: boolean | null;
    canceled_at: string | null;
    created: string;
    current_period_end: string;
    current_period_start: string;
    ended_at: string | null;
    ... 7 more ...;
    user_id: string;
} */

export type SubscriptionWithPriceAndProduct = Subscription & {
  prices:
    | (Price & {
        products: Product | null
      })
    | null
}

// Type for the products query response
export interface ProductWithPrices extends Product {
  prices: Price[]
}