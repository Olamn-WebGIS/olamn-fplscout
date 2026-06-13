-- Create user_data table to store watchlist and synced team data
CREATE TABLE IF NOT EXISTS user_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  watchlist JSONB DEFAULT '[]',
  synced_team JSONB DEFAULT NULL,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_data_email ON user_data(email);

-- Add RLS policies
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own data
CREATE POLICY "Users can view own data"
  ON user_data
  FOR SELECT
  USING (auth.jwt() ->> 'email' = email);

-- Policy: Users can update their own data
CREATE POLICY "Users can update own data"
  ON user_data
  FOR UPDATE
  USING (auth.jwt() ->> 'email' = email)
  WITH CHECK (auth.jwt() ->> 'email' = email);

-- Policy: Users can insert their own data
CREATE POLICY "Users can insert own data"
  ON user_data
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = email);
