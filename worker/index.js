import { ASSETS } from "./assets.js";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const key = routeToAssetKey(url.pathname);
    const asset = ASSETS[key];
    if (!asset) return new Response("Not found", { status: 404 });

    return new Response(asset.body, {
      headers: {
        "content-type": asset.content_type,
        "cache-control": key.endsWith(".json") ? "no-store" : "public, max-age=300",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
      },
    });
  },
};

function routeToAssetKey(pathname) {
  if (pathname === "/" || pathname === "") return "index.html";
  const key = pathname.replace(/^\/+/, "");
  if (key === "financial-pond" || key === "financial-pond/") return "index.html";
  return key;
}
