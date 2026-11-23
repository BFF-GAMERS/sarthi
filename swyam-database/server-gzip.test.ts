// @vitest-environment node
import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gzipHtml } from "./server-gzip";

const req = (enc = "gzip, br") =>
  new Request("https://swayam.test/", { headers: { "accept-encoding": enc } });
const html = (body: ReadableStream<Uint8Array>, headers: Record<string, string> = {}) =>
  new Response(body, { headers: { "content-type": "text/html; charset=utf-8", ...headers } });

function source(chunks: string[], opts: { fail?: boolean; hang?: boolean } = {}) {
  const enc = new TextEncoder();
  const state = { cancelled: false, pulled: 0 };
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(c): Promise<void> | void {
      state.pulled++;
      if (i < chunks.length) c.enqueue(enc.encode(chunks[i++]));
      else if (opts.fail) c.error(new Error("render blew up"));
      else if (opts.hang) return new Promise<void>(() => {});
      else c.close();
      return undefined;
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return { stream, state };
}

const unhandled = vi.fn();
process.on("unhandledRejection", unhandled);
afterEach(() => {
  vi.unstubAllEnvs();
  unhandled.mockClear();
});

describe("gzipHtml", () => {
  it("compresses a streamed document and says so", async () => {
    const { stream } = source(["<html>", "<body>hello</body>", "</html>"]);
    const res = gzipHtml(req(), html(stream, { "content-length": "99" }));
    expect(res.headers.get("content-encoding")).toBe("gzip");
    expect(res.headers.get("content-length")).toBeNull();
    expect(res.headers.get("vary")).toContain("Accept-Encoding");
    const out = gunzipSync(Buffer.from(await res.arrayBuffer())).toString();
    expect(out).toBe("<html><body>hello</body></html>");
  });

  it("steps aside for non-HTML, already-encoded, no-gzip and Vercel", () => {
    const mk = () => source(["x"]).stream;
    const json = new Response(mk(), { headers: { "content-type": "application/json" } });
    expect(gzipHtml(req(), json)).toBe(json);
    const enc = html(mk(), { "content-encoding": "br" });
    expect(gzipHtml(req(), enc)).toBe(enc);
    const plain = html(mk());
    expect(gzipHtml(req("identity"), plain)).toBe(plain);
    vi.stubEnv("VERCEL", "1");
    const v = html(mk());
    expect(gzipHtml(req(), v)).toBe(v);
  });

  it("cancels the render source when the browser goes away", async () => {
    const { stream, state } = source(["<html>"], { hang: true });
    const res = gzipHtml(req(), html(stream));
    const reader = res.body!.getReader();
    await reader.read(); // first flushed chunk arrives
    await reader.cancel(); // the client closed the connection
    await vi.waitFor(() => expect(state.cancelled).toBe(true));
  });

  it("a render error aborts the response without an unhandled error", async () => {
    const { stream } = source(["<html>"], { fail: true });
    const res = gzipHtml(req(), html(stream));
    await expect(res.arrayBuffer()).rejects.toBeDefined();
    await new Promise((r) => setTimeout(r, 20));
    expect(unhandled).not.toHaveBeenCalled();
  });
});
