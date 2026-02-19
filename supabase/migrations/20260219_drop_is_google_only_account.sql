-- KAN-53: Drop is_google_only_account function (security fix)
--
-- This function was introduced to detect login method mismatches (Google vs
-- email/password). It has been removed because calling it after a failed login
-- constitutes account enumeration: an unauthenticated user could probe any
-- email address to confirm whether it is registered and which auth provider
-- it uses — a GDPR violation and a security risk.
--
-- The login page now shows a static, unconditional hint for Google users
-- ("Via Google aangemeld? Gebruik de knop 'Doorgaan met Google' hierboven.")
-- which guides legitimate users without leaking any per-email information.

DROP FUNCTION IF EXISTS public.is_google_only_account(text);
