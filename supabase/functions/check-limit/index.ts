import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const FREE_LIMIT = 1

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Verify the JWT and extract user ID server-side
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    )
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(
      authHeader.replace("Bearer ", "")
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const userId = user.id

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Count total usage across all months
    const { data: usage } = await supabase
      .from("sign_usage")
      .select("count")
      .eq("user_id", userId)

    const totalCount = (usage || []).reduce((sum, row) => sum + (row.count || 0), 0)

    return new Response(
      JSON.stringify({
        allowed: totalCount < FREE_LIMIT,
        isPro: false,
        used: totalCount,
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
