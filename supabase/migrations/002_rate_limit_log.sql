-- Rate limiting log. Every edge-function call inserts a row; a lookup
-- window counts recent rows for (endpoint, user_id or ip) and rejects
-- over the threshold. Old rows are cleaned periodically.
-- Rollback: DROP TABLE public.rate_limit_log CASCADE;
--           DROP FUNCTION public.cleanup_rate_limit_log();
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id BIGSERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL,
  subject TEXT NOT NULL,          -- user_id (uuid::text) or IP hash for anon
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The query we run is `COUNT(*) WHERE endpoint=$1 AND subject=$2 AND at > now() - interval 'N seconds'`
CREATE INDEX IF NOT EXISTS rate_limit_log_lookup
  ON public.rate_limit_log (endpoint, subject, at DESC);

-- RLS: edge functions use service_role and bypass RLS. No anon access.
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Cleanup helper — call from cron or at start of each RL check.
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_log()
RETURNS void AS $$
  DELETE FROM public.rate_limit_log WHERE at < NOW() - INTERVAL '10 minutes';
$$ LANGUAGE SQL SECURITY DEFINER;
