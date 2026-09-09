export default {
  async fetch(request, env) {
    const publicUrl = new URL(request.url);
    if (publicUrl.hostname !== env.PUBLIC_HOSTNAME) {
      return new Response('Not found', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    if (publicUrl.protocol !== 'https:') {
      publicUrl.protocol = 'https:';
      return Response.redirect(publicUrl.toString(), 308);
    }

    const origin = new URL(env.ORIGIN);
    const upstreamUrl = new URL(publicUrl);
    upstreamUrl.host = origin.host;
    const upstream = new Request(upstreamUrl, request);
    // Cloud Run routes by Host, even when the browser used the custom hostname.
    upstream.headers.set('Host', origin.host);
    upstream.headers.set('X-Forwarded-Host', publicUrl.host);
    upstream.headers.set('X-Forwarded-Proto', 'https');

    // Let the browser handle redirects so credentials never follow an upstream
    // redirect to another host. Preserve successful responses' origin cache policy,
    // but never cache an error even if an older origin still marks it immutable.
    const response = await fetch(upstream, {
      redirect: 'manual',
      cf: { cacheTtlByStatus: { '400-599': -1 } },
    });
    if (response.status >= 400) {
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store');
      headers.delete('CDN-Cache-Control');
      headers.delete('Cloudflare-CDN-Cache-Control');
      headers.delete('Expires');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    const location = response.headers.get('Location');
    if (location) {
      const redirect = new URL(location, upstreamUrl);
      if (redirect.origin === origin.origin) {
        redirect.host = publicUrl.host;
        const headers = new Headers(response.headers);
        headers.set('Location', redirect.toString());
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    }
    return response;
  },
};
