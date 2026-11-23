import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Lists and detail pages are re-opened constantly; refetching each time they
  // mount is a request nobody notices being skipped. Thirty seconds of freshness,
  // ten minutes in memory, and one retry so a real failure surfaces quickly.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, gcTime: 10 * 60_000, retry: 1 } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // Off by design: restoring the previous offset made newly opened pages
    // render from the middle. <ScrollToTop /> pins every route to the top.
    scrollRestoration: false,
    // Fetch a route's code when the pointer or focus reaches its link, so the
    // click that follows finds it already there.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
