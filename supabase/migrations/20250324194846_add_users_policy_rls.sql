-- Update the function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into users table if the record doesn't already exist
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING; -- Skip if the user already exists

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger already exists, so we don't need to create it again

-- Enable Row Level Security on users table (if not already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own data (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE tablename = 'users'
    AND policyname = 'Users can view their own user data'
  ) THEN
    CREATE POLICY "Users can view their own user data"
    ON users
    FOR SELECT
    USING (auth.uid() = id);
  END IF;
END
$$;

---- Create a function to handle new user registration
--CREATE OR REPLACE FUNCTION public.handle_new_user()
--RETURNS TRIGGER AS $$
--BEGIN
--  -- Insert into users table
--  INSERT INTO public.users (id, email)
--  VALUES (NEW.id, NEW.email);

--  RETURN NEW;
--END;
--$$ LANGUAGE plpgsql SECURITY DEFINER;

---- Create a trigger to call this function after insert on auth.users
--CREATE TRIGGER on_auth_user_created
--  AFTER INSERT ON auth.users
--  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

---- Enable Row Level Security on users table (if not already enabled)
--ALTER TABLE users ENABLE ROW LEVEL SECURITY;

---- Create policy for users to view their own data
--CREATE POLICY "Users can view their own user data"
--ON users
--FOR SELECT
--USING (auth.uid() = id);