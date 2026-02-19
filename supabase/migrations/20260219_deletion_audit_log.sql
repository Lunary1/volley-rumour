-- KAN-52: GDPR Right to be Forgotten – deletion audit log table
-- Stores only a SHA-256 hash of the deleted user's ID (no personal data retained)

CREATE TABLE public.deletion_audit_log (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id_hash  text        NOT NULL,
  deleted_at    timestamptz NOT NULL DEFAULT now(),
  auth_provider text,
  CONSTRAINT deletion_audit_log_pkey PRIMARY KEY (id)
);

ALTER TABLE public.deletion_audit_log ENABLE ROW LEVEL SECURITY;
-- No SELECT policy — only the service role can read this table
