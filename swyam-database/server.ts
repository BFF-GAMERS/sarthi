import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import type { RequestHandler } from "@tanstack/react-start/server";
import type { Register } from "@tanstack/react-router";
import { gzipHtml } from "./server-gzip";

const handler = createStartHandler(defaultStreamHandler);

const fetch: RequestHandler<Register> = async (request, opts) =>
  gzipHtml(request, await handler(request, opts));

export default { fetch };
