import { createFileRoute } from "@tanstack/react-router";

// Proxy server-side del catálogo de precios de la web (Fase 2, fuente única).
// El navegador del CRM pide ESTA ruta (mismo origen → sin problemas de CORS) y
// aquí se descarga el JSON de la web server-to-server (tampoco hay CORS).
// La web publica su catálogo en WEB_CATALOG_URL (por defecto, /catalog.json de
// tirorirohome.com), generado desde su única fuente de precios (pricing.ts).
const WEB_CATALOG_URL =
  process.env.WEB_CATALOG_URL || "https://tirorirohome.com/catalog.json";

export const Route = createFileRoute("/api/public/catalog")({
  server: {
    handlers: {
      GET: async () => {
        const cors = {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
          // Cache 5 min en el navegador; el catálogo cambia rara vez.
          "Cache-Control": "public, max-age=300",
        };
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 5000);
          const res = await fetch(WEB_CATALOG_URL, { signal: ctrl.signal, cache: "no-cache" });
          clearTimeout(t);
          if (!res.ok) {
            return new Response(JSON.stringify({ error: "upstream", status: res.status }), { status: 502, headers: cors });
          }
          const data = await res.json();
          return new Response(JSON.stringify(data), { status: 200, headers: cors });
        } catch {
          // La web no responde: el CRM caerá a su catálogo espejo local.
          return new Response(JSON.stringify({ error: "unreachable" }), { status: 502, headers: cors });
        }
      },
    },
  },
});
