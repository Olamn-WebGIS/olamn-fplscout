-- Watchlist Activity Tracker Table
-- Tracks last known activity snapshot for each watched rival
-- Used to detect new transfers, captain changes, and chip usage

CREATE TABLE IF NOT EXISTS watchlist_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  rival_manager_id BIGINT NOT NULL,
  rival_name TEXT NOT NULL,
  rival_team_name TEXT,
  
  -- Last activity snapshot
  last_checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_captain_element_id INT,
  last_transfer_count INT DEFAULT 0,
  last_chip_used TEXT,
  last_chip_used_gw INT,
  
  -- Activity data (JSON for flexibility)
  recent_transfers JSONB DEFAULT '[]'::jsonb,
  recent_captains JSONB DEFAULT '[]'::jsonb,
  recent_chips JSONB DEFAULT '[]'::jsonb,
  
  -- Notification tracking
  notifications_sent JSONB DEFAULT '[]'::jsonb,
  last_notified_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, rival_manager_id),
  FOREIGN KEY(user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_watchlist_activity_user ON watchlist_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_activity_checked ON watchlist_activity(last_checked_at);

-- Disable RLS for watchlist_activity because this app does not use Supabase Auth
ALTER TABLE watchlist_activity DISABLE ROW LEVEL SECURITY;
