import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const FREE_LIMIT = 3

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { user_id } = await req.json()
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const month = new Date().toISOString().slice(0, 7)

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Check active subscription first
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user_id)
      .single()

    if (sub?.status === "active") {
      return new Response(
        JSON.stringify({ allowed: true, isPro: true, used: 0, limit: FREE_LIMIT }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Check freemium counter
    const { data: usage } = await supabase
      .from("sign_usage")
      .select("count")
      .eq("user_id", user_id)
      .eq("month", month)
      .single()

    const count = usage?.count ?? 0

    return new Response(
      JSON.stringify({
        allowed: count < FREE_LIMIT,
        isPro: false,
        used: count,
        limit: FREE_LIMIT
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
