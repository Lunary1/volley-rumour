-- Function to increment upvotes
CREATE OR REPLACE FUNCTION increment_upvotes(rumour_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE rumours SET upvotes = upvotes + 1 WHERE id = rumour_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment downvotes
CREATE OR REPLACE FUNCTION increment_downvotes(rumour_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE rumours SET downvotes = downvotes + 1 WHERE id = rumour_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment trust score
CREATE OR REPLACE FUNCTION increment_trust_score(profile_uuid UUID, points_to_add INT)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET trust_score = trust_score + points_to_add WHERE id = profile_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement trust score
CREATE OR REPLACE FUNCTION decrement_trust_score(profile_uuid UUID, points_to_remove INT)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET trust_score = GREATEST(0, trust_score - points_to_remove) WHERE id = profile_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
