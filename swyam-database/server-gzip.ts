import { Readable, pipeline } from "node:stream";
import { constants, createGzip } from "node:zlib";

/**
 * Gzip the streamed SSR HTML when the Node server artifact serves it.
 *
 * Hashed assets are pre-compressed at build time (`compressPublicAssets` in
 * vite.config.ts), but the document is rendered per request and Nitro's
 * node-server sends it raw: about 125 KB for Home. Vercel's edge compresses
 * function output itself, so this steps aside there. `Z_SYNC_FLUSH` keeps
 * React's streaming intact: each chunk reaches the browser as it renders.
 *
 * Lifetime: `stream.pipeline` joins the render stream, gzip and the response
 * body. If the browser goes away (the web body is cancelled) or the render
 * throws, pipeline destroys every stream in the chain, and destroying the
 * `fromWeb` source cancels the underlying render stream, so React stops
 * rendering for a closed socket instead of leaking it. A bare `.pipe()` did
 * neither: errors were unhandled and the source kept producing.
 */
export function gzipHtml(request: Request, response: Response): Response {
  if (process.env["VERCEL"]) return response;
  if (!response.body || response.headers.has("content-encoding")) return response;
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return response;
  if (!/\bgzip\b/.test(request.headers.get("accept-encoding") ?? "")) return response;

  const source = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
  const gzip = createGzip({ flush: constants.Z_SYNC_FLUSH });
  // The callback only swallows the premature-close / render error: the failure already reaches the browser as
  // an aborted stream, and an unhandled 'error' here would take the whole server process down.
  pipeline(source, gzip, () => {});
  // Belt and braces: whichever end closes first, the render source is released.
  gzip.once("close", () => {
    if (!source.destroyed) source.destroy();
  });

  const headers = new Headers(response.headers);
  headers.set("content-encoding", "gzip");
  headers.delete("content-length");
  headers.append("vary", "Accept-Encoding");
  return new Response(Readable.toWeb(gzip) as ReadableStream, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
