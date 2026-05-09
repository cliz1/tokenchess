export async function onRequest(context) {
  const cache = caches.default;
  const cacheKey = new Request(context.request.url);

  let response = await cache.match(cacheKey);
  if (response) return response;

  const upstream = await fetch(
    'https://github.com/cliz1/tokenchess/releases/download/v1.0-assets/stockfish.wasm'
  );

  response = new Response(upstream.body, {
    headers: {
      'content-type': 'application/wasm',
      'cache-control': 'public, max-age=604800, immutable',
    },
  });

  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
