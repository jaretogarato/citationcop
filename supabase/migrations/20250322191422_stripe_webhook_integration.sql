-- Add user_id to customers table to establish relationship
ALTER TABLE customers
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Add subscription-related columns for easier access
ALTER TABLE customers
ADD COLUMN subscription_status TEXT;

-- Create a SQL function to handle Stripe webhook events
CREATE OR REPLACE FUNCTION handle_stripe_webhook(stripe_event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  event_type TEXT;
  subscription_id TEXT;
  customer_id TEXT;
  subscription_status TEXT;
  price_id TEXT;
  user_id UUID;
  result JSONB;
BEGIN
  -- Extract event type
  event_type := stripe_event->>'type';

  -- Process based on event type
  IF event_type = 'customer.subscription.created' OR
     event_type = 'customer.subscription.updated' THEN

    -- Extract subscription details
    subscription_id := (stripe_event->'data'->'object'->>'id');
    customer_id := (stripe_event->'data'->'object'->>'customer');
    subscription_status := (stripe_event->'data'->'object'->>'status');
    price_id := (stripe_event->'data'->'object'->'items'->'data'->0->>'price');

    -- Find user via customers table
    SELECT c.user_id INTO user_id
    FROM customers c
    WHERE c.stripe_customer_id = customer_id
    LIMIT 1;

    IF user_id IS NOT NULL THEN
      -- Update or insert subscription record
      INSERT INTO subscriptions (
        id,
        user_id,
        status,
        price_id,
        current_period_start,
        current_period_end,
        created
      ) VALUES (
        subscription_id,
        user_id,
        subscription_status,
        price_id,
        to_timestamp((stripe_event->'data'->'object'->>'current_period_start')::bigint),
        to_timestamp((stripe_event->'data'->'object'->>'current_period_end')::bigint),
        to_timestamp((stripe_event->'data'->'object'->>'created')::bigint)
      )
      ON CONFLICT (id) DO UPDATE SET
        status = subscription_status,
        current_period_start = to_timestamp((stripe_event->'data'->'object'->>'current_period_start')::bigint),
        current_period_end = to_timestamp((stripe_event->'data'->'object'->>'current_period_end')::bigint),
        ended_at = CASE
          WHEN stripe_event->'data'->'object'->>'ended_at' IS NOT NULL
          THEN to_timestamp((stripe_event->'data'->'object'->>'ended_at')::bigint)
          ELSE NULL
        END,
        cancel_at = CASE
          WHEN stripe_event->'data'->'object'->>'cancel_at' IS NOT NULL
          THEN to_timestamp((stripe_event->'data'->'object'->>'cancel_at')::bigint)
          ELSE NULL
        END,
        canceled_at = CASE
          WHEN stripe_event->'data'->'object'->>'canceled_at' IS NOT NULL
          THEN to_timestamp((stripe_event->'data'->'object'->>'canceled_at')::bigint)
          ELSE NULL
        END,
        cancel_at_period_end = (stripe_event->'data'->'object'->>'cancel_at_period_end')::boolean;

      -- Also update customers table
      UPDATE customers
      SET subscription_status = subscription_status
      WHERE stripe_customer_id = customer_id;

      result := jsonb_build_object('status', 'updated', 'user_id', user_id);
    ELSE
      -- No user found with this customer ID
      result := jsonb_build_object('status', 'pending', 'customer_id', customer_id);
    END IF;

  ELSIF event_type = 'customer.subscription.deleted' THEN
    -- Handle subscription cancellation
    subscription_id := (stripe_event->'data'->'object'->>'id');
    customer_id := (stripe_event->'data'->'object'->>'customer');

    -- Update subscription status in subscriptions table
    UPDATE subscriptions
    SET
      status = 'canceled',
      canceled_at = to_timestamp((stripe_event->'data'->'object'->>'canceled_at')::bigint),
      ended_at = to_timestamp((stripe_event->'data'->'object'->>'ended_at')::bigint)
    WHERE id = subscription_id;

    -- Also update customers table
    UPDATE customers
    SET subscription_status = 'canceled'
    WHERE stripe_customer_id = customer_id;

    result := jsonb_build_object('status', 'canceled', 'subscription_id', subscription_id);
  ELSE
    -- Other event types, just acknowledge
    result := jsonb_build_object('status', 'ignored', 'event_type', event_type);
  END IF;

  RETURN result;
END;
$$;