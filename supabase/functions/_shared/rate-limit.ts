import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

export class RateLimitError extends Error {
  constructor(public endpoint: string, public subject: string) {
    super(`Rate limit exceeded for ${endpoint}`)
    this.name = "RateLimitError"
  }
}

interface Params {
  endpoint: string
  subject: string         // user_id or IP-hash; identifies the caller
  maxPerMinute: number
}

export async function enforceRateLimit(p: Params): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  const windowStart = new Date(Date.now() - 60_000).toISOString()

  const { count, error: countErr } = await supabase
    .from("rate_limit_log")
    .select("*", { count: "exact", head: true })
    .eq("endpoint", p.endpoint)
    .eq("subject", p.subject)
    .gte("at", windowStart)

  if (countErr) {
    // Fail-open on lookup failure — Postgres outage shouldn't lock everyone
    // out. Log for observability only.
    console.error("rate-limit lookup failed", countErr)
    return
  }

  if ((count ?? 0) >= p.maxPerMinute) {
    throw new RateLimitError(p.endpoint, p.subject)
  }

  const { error: insertErr } = await supabase
    .from("rate_limit_log")
    .insert({ endpoint: p.endpoint, subject: p.subject })
  if (insertErr) {
    console.error("rate-limit insert failed", insertErr)
    // Non-fatal.
  }
}
