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
    const { google_access_token } = await req.json()
    if (!google_access_token) {
      return new Response(
        JSON.stringify({ error: "Missing google_access_token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Verify Google access token via Google's userinfo endpoint
    const googleRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${google_access_token}` },
    })
    if (!googleRes.ok) {
      return new Response(
        JSON.stringify({ error: "Invalid Google access token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    const { email, sub } = await googleRes.json()
    if (!email) {
      return new Response(
        JSON.stringify({ error: "Google account has no email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Verify token audience matches one of our OAuth clients. These
    // client IDs are public (they ship in the extension manifest that
    // anyone can inspect), so hard-coding them here is not a leak.
    // The original plan called for an OAUTH_CLIENT_IDS secret, but the
    // available Supabase MCP does not expose secret management, and the
    // Supabase CLI is not installed in this environment. Hard-coding
    // avoids a 500 "not configured" response taking down prod sign-in.
    // Env-var override is honored if set, so a future migration to
    // secrets just needs `supabase secrets set OAUTH_CLIENT_IDS=...`.
    const envAuds = (Deno.env.get("OAUTH_CLIENT_IDS") ?? "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
    const allowedAuds = envAuds.length > 0 ? envAuds : [
      // prod Chrome App OAuth client
      "836027625583-4ai30de2tvaduepb4vgink6jm8nnjosg.apps.googleusercontent.com",
      // dev Chrome App OAuth client
      "836027625583-ut67ekjtdnfrp5tieh6ggep2dk9kopnb.apps.googleusercontent.com",
    ]

    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(google_access_token)}`
    )
    if (!tokenInfoRes.ok) {
      return new Response(
        JSON.stringify({ error: "Token info check failed" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    const { aud } = await tokenInfoRes.json()
    if (!aud || !allowedAuds.includes(aud)) {
      return new Response(
        JSON.stringify({ error: "Token audience not allowed" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Admin client for user management
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Create user if not exists (idempotent — ignore "already registered" error)
    await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { google_sub: sub },
    })

    // Generate magic link to get a verifiable token
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    })
    if (linkError) {
      throw linkError
    }

    return new Response(
      JSON.stringify({ token_hash: linkData.properties.hashed_token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
