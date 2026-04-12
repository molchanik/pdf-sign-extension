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

    // Upsert: increment count or create with count=1
    const { data: existing } = await supabase
      .from("sign_usage")
      .select("id, count")
      .eq("user_id", user_id)
      .eq("month", month)
      .single()

    let newCount: number

    if (existing) {
      newCount = existing.count + 1
      await supabase
        .from("sign_usage")
        .update({ count: newCount })
        .eq("id", existing.id)
    } else {
      newCount = 1
      await supabase
        .from("sign_usage")
        .insert({ user_id, month, count: 1 })
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
