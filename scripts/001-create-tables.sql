-- Volley Transfers Database Schema
-- Users profile table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  trust_score INTEGER DEFAULT 0,
  total_votes_received INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clubs table
CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  province TEXT,
  division TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rumours table
CREATE TABLE IF NOT EXISTS rumours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  from_club_id UUID REFERENCES clubs(id),
  to_club_id UUID REFERENCES clubs(id),
  from_club_name TEXT,
  to_club_name TEXT,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('transfer', 'trainer_transfer', 'player_retirement', 'trainer_retirement')),
  status TEXT DEFAULT 'rumour' CHECK (status IN ('rumour', 'confirmed', 'denied')),
  votes_true INTEGER DEFAULT 0,
  votes_false INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rumour votes table
CREATE TABLE IF NOT EXISTS rumour_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rumour_id UUID REFERENCES rumours(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  vote_type BOOLEAN NOT NULL, -- true = believe, false = don't believe
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(rumour_id, user_id)
);

-- Confirmed transfers table
CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name TEXT NOT NULL,
  from_club TEXT,
  to_club TEXT,
  category TEXT NOT NULL CHECK (category IN ('player_male', 'player_female', 'trainer_male', 'trainer_female', 'player_retirement', 'trainer_retirement')),
  province TEXT,
  division TEXT,
  position TEXT,
  source_rumour_id UUID REFERENCES rumours(id),
  confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Classifieds/Zoekertjes table
CREATE TABLE IF NOT EXISTS classifieds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('team_seeks_trainer', 'team_seeks_player', 'player_seeks_team', 'trainer_seeks_team')),
  title TEXT NOT NULL,
  description TEXT,
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  team_name TEXT,
  position TEXT,
  province TEXT,
  division TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rumours ENABLE ROW LEVEL SECURITY;
ALTER TABLE rumour_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classifieds ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Clubs policies
CREATE POLICY "Clubs are viewable by everyone" ON clubs
  FOR SELECT USING (true);

-- Rumours policies
CREATE POLICY "Rumours are viewable by everyone" ON rumours
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create rumours" ON rumours
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update own rumours" ON rumours
  FOR UPDATE USING (auth.uid() = creator_id);

-- Rumour votes policies
CREATE POLICY "Votes are viewable by everyone" ON rumour_votes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can vote" ON rumour_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own votes" ON rumour_votes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes" ON rumour_votes
  FOR DELETE USING (auth.uid() = user_id);

-- Transfers policies
CREATE POLICY "Transfers are viewable by everyone" ON transfers
  FOR SELECT USING (true);

-- Classifieds policies
CREATE POLICY "Classifieds are viewable by everyone" ON classifieds
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create classifieds" ON classifieds
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own classifieds" ON classifieds
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own classifieds" ON classifieds
  FOR DELETE USING (auth.uid() = user_id);

-- Function to update trust score when votes are added
CREATE OR REPLACE FUNCTION update_creator_trust_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the rumour vote counts
  UPDATE rumours
  SET 
    votes_true = (SELECT COUNT(*) FROM rumour_votes WHERE rumour_id = NEW.rumour_id AND vote_type = true),
    votes_false = (SELECT COUNT(*) FROM rumour_votes WHERE rumour_id = NEW.rumour_id AND vote_type = false)
  WHERE id = NEW.rumour_id;
  
  -- Update creator's trust score
  UPDATE profiles
  SET 
    trust_score = (
      SELECT COALESCE(SUM(votes_true - votes_false), 0)
      FROM rumours
      WHERE creator_id = (SELECT creator_id FROM rumours WHERE id = NEW.rumour_id)
    ),
    total_votes_received = (
      SELECT COALESCE(SUM(votes_true + votes_false), 0)
      FROM rumours
      WHERE creator_id = (SELECT creator_id FROM rumours WHERE id = NEW.rumour_id)
    )
  WHERE id = (SELECT creator_id FROM rumours WHERE id = NEW.rumour_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for vote updates
CREATE TRIGGER on_vote_change
  AFTER INSERT OR UPDATE OR DELETE ON rumour_votes
  FOR EACH ROW EXECUTE FUNCTION update_creator_trust_score();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
