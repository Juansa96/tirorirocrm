import { createFileRoute } from "@tanstack/react-router";

// Proxy server-side de /telas.json de la web (mismo origen → sin CORS).
// Devuelve la biblioteca de telas publicada por tirorirohome.com para que el
// CRM la use en el selector de telas (nombre + foto), sin duplicar imágenes.
const WEB_TELAS_URL = process.env.WEB_TELAS_URL || "https://tirorirohome.com/telas.json";

export const Route = createFileRoute("/api/public/telas")({
  server: {
    handlers: {
      GET: async () => {
        const cors = {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=600",
        };
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 5000);
          const res = await fetch(WEB_TELAS_URL, { signal: ctrl.signal, cache: "no-cache" });
          clearTimeout(t);
          if (!res.ok) return new Response(JSON.stringify({ telas: [] }), { status: 200, headers: cors });
          const data = await res.json();
          return new Response(JSON.stringify(data), { status: 200, headers: cors });
        } catch {
          return new Response(JSON.stringify({ telas: [] }), { status: 200, headers: cors });
        }
      },
    },
  },
});
