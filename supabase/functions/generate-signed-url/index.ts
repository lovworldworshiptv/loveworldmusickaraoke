import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user with their JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check premium/admin role using service client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["premium", "admin"]);

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Premium subscription required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get song ID from request
    const { songId } = await req.json();
    if (!songId) {
      return new Response(JSON.stringify({ error: "songId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get song details
    const { data: song, error: songError } = await adminClient
      .from("songs")
      .select("audio_url, title, artist, lyrics_lrc")
      .eq("id", songId)
      .single();

    if (songError || !song) {
      return new Response(JSON.stringify({ error: "Song not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If audio_url is a Supabase storage URL, generate a signed URL
    let signedUrl = song.audio_url;

    if (song.audio_url && song.audio_url.includes("/storage/v1/object/public/")) {
      // Extract bucket and path from public URL
      const match = song.audio_url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
      if (match) {
        const [, bucket, path] = match;
        const { data: signed, error: signError } = await adminClient.storage
          .from(bucket)
          .createSignedUrl(path, 120); // 120 seconds expiry

        if (!signError && signed?.signedUrl) {
          signedUrl = signed.signedUrl;
        }
      }
    }

    return new Response(
      JSON.stringify({
        signedUrl,
        title: song.title,
        artist: song.artist,
        lyricsLrc: song.lyrics_lrc,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
