import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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
    const month = new Date().toISOString().slice(0, 7)

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Upsert: increment count or create with count=1
    const { data: existing } = await supabase
      .from("sign_usage")
      .select("id, count")
      .eq("user_id", userId)
      .eq("month", month)
      .single()

    let newCount: number

    if (existing) {
      newCount = existing.count + 1
      const { error: updateError } = await supabase
        .from("sign_usage")
        .update({ count: newCount })
        .eq("id", existing.id)
      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to update usage" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    } else {
      newCount = 1
      const { error: insertError } = await supabase
        .from("sign_usage")
        .insert({ user_id: userId, month, count: 1 })
      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Failed to record usage" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    }

    return new Response(
      JSON.stringify({ success: true, new_count: newCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
