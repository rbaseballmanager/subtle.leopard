const ALLOWED_ORIGINS = new Set(["https://rbaseballmanager.github.io", "http://localhost:4173", "http://127.0.0.1:4173"]);
const OPEN_DART_ORIGIN = "https://opendart.fss.or.kr";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://rbaseballmanager.github.io";
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Vary": "Origin",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "GET") {
      return json({ error: "Only GET requests are allowed." }, 405, corsHeaders);
    }

    try {
      if (!env.OPEN_DART_API_KEY) {
        return json({ error: "OPEN_DART_API_KEY secret is missing." }, 500, corsHeaders);
      }

      const requestUrl = new URL(request.url);
      const rawTargetUrl = requestUrl.searchParams.get("url");

      if (!rawTargetUrl) {
        return json({ error: "Missing url query parameter." }, 400, corsHeaders);
      }

      const targetUrl = new URL(rawTargetUrl);

      if (targetUrl.origin !== OPEN_DART_ORIGIN) {
        return json({ error: "Only OpenDART API requests are allowed." }, 400, corsHeaders);
      }

      targetUrl.searchParams.set("crtfc_key", env.OPEN_DART_API_KEY);

      const upstream = await fetch(targetUrl.toString(), {
        method: "GET",
        headers: {
          "User-Agent": "subtle-leopard-opendart-proxy",
          "Accept": "*/*",
        },
      });

      const headers = new Headers(corsHeaders);
      headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/octet-stream");
      headers.set("Cache-Control", "no-store");

      return new Response(upstream.body, {
        status: upstream.status,
        headers,
      });
    } catch (error) {
      return json(
        {
          error: "OpenDART proxy request failed.",
          detail: String(error?.message || error),
        },
        500,
        corsHeaders,
      );
    }
  },
};

function json(body, status, corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
