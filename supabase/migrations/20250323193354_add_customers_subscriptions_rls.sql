-- Add RLS policies for customers and subscriptions tables
-- This ensures users can create accounts during signup and view their own data

-- Enable Row Level Security on customers table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create policy to allow inserting into customers table during signup
CREATE POLICY "Allow signup to create customer records"
ON customers
FOR INSERT
WITH CHECK (true);

-- Enable Row Level Security on subscriptions table
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow inserting into subscriptions table during signup
CREATE POLICY "Allow signup to create subscription records"
ON subscriptions
FOR INSERT
WITH CHECK (true);

-- Create policies for reading customer and subscription data
CREATE POLICY "Users can view their own customer data"
ON customers
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own subscriptions"
ON subscriptions
FOR SELECT
USING (auth.uid() = user_id);