import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const nonce = url.searchParams.get("nonce");
    if (!nonce) {
      return new Response(JSON.stringify({ error: "Missing nonce" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data } = await supabase
      .from("kingschat_auth_sessions")
      .select("session_data, error, expires_at")
      .eq("nonce", nonce)
      .maybeSingle();

    if (!data) {
      return new Response(JSON.stringify({ status: "pending" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(data.expires_at) < new Date()) {
      await supabase.from("kingschat_auth_sessions").delete().eq("nonce", nonce);
      return new Response(JSON.stringify({ status: "expired" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (data.error) {
      await supabase.from("kingschat_auth_sessions").delete().eq("nonce", nonce);
      return new Response(JSON.stringify({ status: "error", error: data.error }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (data.session_data) {
      // Single-use: delete after handing off
      await supabase.from("kingschat_auth_sessions").delete().eq("nonce", nonce);
      return new Response(JSON.stringify({ status: "ready", ...data.session_data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "pending" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
