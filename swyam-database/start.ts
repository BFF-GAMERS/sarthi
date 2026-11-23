import { createStart, createCsrfMiddleware } from "@tanstack/react-start";

// Start installs CSRF protection automatically only when this file is absent;
// defining it opts out, so re-add the middleware explicitly to keep server
// functions protected from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}));
