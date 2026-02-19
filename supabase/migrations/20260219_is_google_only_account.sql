-- KAN-53: Auth model mismatch detection
-- Helper function to check whether an email address is registered
-- exclusively via Google OAuth (no email/password identity).
-- SECURITY DEFINER runs as the function owner so it can access auth.identities.
-- Only callable server-side (via service-role admin client).

CREATE OR REPLACE FUNCTION public.is_google_only_account(email_address text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- At least one Google identity exists for this email
    EXISTS (
      SELECT 1
      FROM auth.identities i
      JOIN auth.users u ON u.id = i.user_id
      WHERE lower(u.email) = lower(email_address)
        AND i.provider = 'google'
    )
    AND
    -- No email/password identity exists for this email
    NOT EXISTS (
      SELECT 1
      FROM auth.identities i
      JOIN auth.users u ON u.id = i.user_id
      WHERE lower(u.email) = lower(email_address)
        AND i.provider = 'email'
    );
$$;

-- Only the service-role (postgres super user) needs to call this;
-- revoke broader access so it cannot be probed by anon/authenticated users.
REVOKE EXECUTE ON FUNCTION public.is_google_only_account(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_google_only_account(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_google_only_account(text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.is_google_only_account(text) TO service_role;
