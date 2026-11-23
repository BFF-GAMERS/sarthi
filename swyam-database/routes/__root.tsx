import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { Suspense, lazy, useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
// Hashed by the build and immutable on the host. Imported as URLs (not bundled)
// so the first paint can preload exactly the faces it is about to draw.
import bodyFontLatin from "../fonts/instrumentsans-normal-400-700-latin.woff2?url";
import genzFontLatin from "../fonts/teko-latin-600-normal.woff2?url";
import genzBodyLatin from "../fonts/hind-latin-400-normal.woff2?url";
import paperFontLatin from "../fonts/newsreader-normal-200-800-latin.woff2?url";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "../context/AuthContext";
import { PreferencesProvider, PREFERENCES_BOOTSTRAP_SCRIPT } from "../context/PreferencesContext";
import Navbar from "../components/Navbar";
import LiveTranslate from "../components/LiveTranslate";
import Footer from "../components/Footer";
import SmoothScroll, { ScrollProgress } from "../components/SmoothScroll";
import ScrollToTop from "../components/ScrollToTop";
import { ToastProvider } from "../components/Toast";
import IntentResume from "../components/IntentResume";
import BottomNav from "../components/BottomNav";
import AppRail from "../components/AppRail";
import ConnectionBar from "../components/ConnectionBar";
import CompareDock from "../components/compare/CompareDock";
import StorageNotice from "../components/StorageNotice";
import DepthField from "../components/DepthField";
import NotFound from "../pages/NotFound";
import EvolutionProvider from "../evolution/react/EvolutionProvider";
import EvolutionRuntime from "../evolution/react/EvolutionRuntime";
import EvolutionNotice from "../components/evolution/EvolutionNotice";
import DemoBanner from "../components/evolution/lab/DemoBanner";
import AssistantLauncher from "../components/AssistantLauncher";
import LocaleLoader from "../components/LocaleLoader";
import { useIdleReady } from "../lib/use-idle";
import { FX_BOOTSTRAP_SCRIPT, startFrameBudget } from "../evolution/platform/frame-budget";

/*
 * Loaded when it is wanted, not before.
 *
 * Onboarding, the tour, the voice guide and the keyboard shortcuts draw
 * nothing for most visits, but a static import put all four, and everything
 * they pull in (SkillSwap, the coach, job alerts, company data, the onboarding
 * flow), into the first-load graph of every page. They now arrive in one chunk
 * after the page is idle, or the instant somebody touches it. The Sarthi
 * assistant (a 200 kB chunk plus a markdown renderer) is further back still:
 * AssistantLauncher shows its button immediately and loads the real thing on
 * demand. Nothing is added to the layout when they arrive, so nothing shifts.
 */
const DeferredOverlays = lazy(() => import("../components/DeferredOverlays"));

/*
 * Preload the faces the first paint draws, and no others.
 *
 * Both registers set body copy in Instrument Sans, so that one is a static
 * <link> (below). The display face depends on the saved register, which only
 * the bootstrap script knows — it has already stamped data-mode by the time
 * this runs — so a second tiny script adds the one preload that will be used.
 * It also sets the browser-chrome colour to match the register. Fetching a
 * face the page then does not use is worse than not preloading, hence the
 * script and not a pair of static links. (Noto Devanagari is no longer preloaded
 * for hi/mr/ne: the only Devanagari the site sets in it is the wordmark and the
 * footer tagline, now a 7 kB subset that loads with the first paint on its own.)
 */
const FONT_PRELOAD_SCRIPT = `(function(){try{
var r=document.documentElement,h=document.head,m=document.querySelector("meta[name=theme-color]");
if(m&&r.dataset.mode==="millennial")m.setAttribute("content","#f6f1e7");
function p(u){var f=document.createElement("link");f.rel="preload";f.as="font";f.type="font/woff2";f.crossOrigin="anonymous";f.href=u;h.appendChild(f);}
if(r.dataset.mode==="millennial"){p(${JSON.stringify(paperFontLatin)});}else{p(${JSON.stringify(genzFontLatin)});p(${JSON.stringify(genzBodyLatin)});}
}catch(e){}})();`;

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="container-x flex min-h-screen flex-col items-center justify-center text-center">
      <h1 className="font-display text-4xl tracking-tight">This page didn't load</h1>
      <p className="mt-3 max-w-md font-body text-sm text-ink-mute">
        Something went wrong on our end. Try again or head back home.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="btn-primary"
        >
          Try again
        </button>
        <a href="/" className="btn-ghost">
          Go home
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Learn a skill. Get hired. — स्वYAM" },
      {
        name: "description",
        content:
          "Courses, apprenticeships, government schemes and jobs for every Indian learner, from your district to your trade.",
      },
      // The dark register is the default for a new visitor; FONT_PRELOAD_SCRIPT
      // switches this to the paper colour when the saved register is the light one.
      { name: "theme-color", content: "#13110e" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "स्वYAM" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Learn a skill. Get hired. — स्वYAM" },
      { name: "twitter:title", content: "Learn a skill. Get hired. — स्वYAM" },
      {
        property: "og:description",
        content:
          "Courses, apprenticeships, government schemes and jobs for every Indian learner, from your district to your trade.",
      },
      {
        name: "twitter:description",
        content:
          "Courses, apprenticeships, government schemes and jobs for every Indian learner, from your district to your trade.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // The body face, on every page in both registers (30 kB). The display face
      // is chosen by FONT_PRELOAD_SCRIPT once the saved register is known.
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: bodyFontLatin,
        crossOrigin: "anonymous",
      },
      // The .ico carries every frame a tab, a bookmark bar or a pinned
      // Windows tile asks for. Its 16 and 24px frames are a plain S rather
      // than the full monogram: the mark's character is thin interlocking
      // strokes, several of them near-black on black, and at tab size those
      // merge into a smudge. Bigger frames use the artwork as drawn.
      //
      // apple-touch-icon is linked rather than left for iOS to guess at the
      // site root, so the home-screen icon is a decision and not a default.
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-16.png", type: "image/png", sizes: "16x16" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    /*
      `suppressHydrationWarning` because this element is *meant* to differ.

      PREFERENCES_BOOTSTRAP_SCRIPT below runs before React hydrates and stamps
      the saved preferences straight onto <html>: data-contrast, data-dyslexia,
      data-motion, --text-scale, and the language and direction. That is
      deliberate — waiting for React would mean a flash of the default look,
      which is a real problem for somebody who chose high contrast or larger
      text because they need it.

      But React then hydrated against JSX that declared none of those, so every
      page load logged "A tree hydrated but some attributes of the server
      rendered HTML didn't match the client properties. This won't be patched
      up." One line per navigation, on every route, drowning any real error in
      the console — and an open invitation for React to clobber an accessibility
      setting on a future re-render.

      The flag says what is true: this subtree's attributes are owned by the
      bootstrap script, not by the server render. It applies only to this
      element's own attributes, so a genuine mismatch anywhere inside still
      reports normally.
    */
    <html lang="en" data-mode="millennial" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Stamps every saved preference before first paint. A flash of the
            default is a cosmetic annoyance for the interface mode, and a real
            problem for someone using high contrast or larger text. */}
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_BOOTSTRAP_SCRIPT }} />
        {/* Frame-Budget Mode: stamps html[data-fx=full|lite|static] from the device's own hints
            (memory, cores, save-data, connection) and the saved measurement, before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: FX_BOOTSTRAP_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: FONT_PRELOAD_SCRIPT }} />
      </head>
      <body>
        {children}
        <Analytics />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { pathname } = useLocation();

  /*
   * Sign-in and sign-up run without the site around them.
   *
   * Every other page wants the navigation: it is how you get anywhere. This
   * one has exactly one job, and a full menu bar, a footer of links, a chat
   * launcher and an onboarding prompt are all invitations to go and do
   * something else instead — on the single screen where leaving means not
   * having an account. Stripping them also removes the state that made the
   * old bug so confusing: a header showing a name above a form asking you to
   * log in.
   *
   * The redirect routes (/login, /signup, /register) resolve to /auth before
   * anything renders, so matching the one path is enough.
   */
  const chromeless = pathname === "/auth";

  // False through SSR and hydration; true once the page is loaded and quiet,
  // or the moment somebody uses it.
  const idle = useIdleReady();

  // Frame-Budget Mode: measure dropped frames after load and shed cost in tiers (html[data-fx]).
  useEffect(() => startFrameBudget(), []);

  /*
   * The learning page keeps the navigation but loses the footer.
   *
   * A five-column sitemap with a repeated wordmark, a mission statement and a
   * "Start free" button underneath a lesson is noise: the reader is already a
   * member, already enrolled, and already mid-task. The nav stays, because
   * getting back out is a real need.
   */
  const learning = pathname.startsWith("/learn/");

  /*
   * The application, as opposed to the shop window.
   *
   * On a laptop the member's own sections are pinned down the left and the
   * content moves over to make room. Which pages those are is a question
   * only AppRail can answer — it depends on the member's profile type, not
   * on the path alone — so it answers it, by setting `--rail-inset`. These
   * two classes are inert until it does, which is why they can be
   * unconditional: the shell and the rail can no longer disagree.
   */

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PreferencesProvider>
          <EvolutionProvider>
            <ToastProvider>
              <div className="flex min-h-dvh flex-col">
                {/* First thing in the tab order: past the fixed navigation in one key. */}
                <a href="#main" className="skip-link">
                  Skip to content
                </a>
                {/* Gen Z only: the room the content sits in. */}
                <DepthField />
                <SmoothScroll />
                <LiveTranslate />
                <ScrollToTop />
                <ScrollProgress />
                {!chromeless && <Navbar />}
                {/* The signed-in member's own sections, pinned on a laptop. */}
                {!chromeless && <AppRail />}
                <main id="main" tabIndex={-1} className="app-main relative z-20 flex-1">
                  {/* Required: nested routes render here. */}
                  <Outlet />
                </main>
                {!chromeless && (
                  <>
                    {!learning && (
                      <div className="app-main">
                        <Footer />
                      </div>
                    )}
                    {/* The Sarthi button, drawn now; the assistant itself loads on demand. */}
                    <AssistantLauncher />
                    {/* The phone's navigation. Hidden on a laptop and in a lesson. */}
                    <BottomNav />
                    {/* Silent while the connection is fine. */}
                    <ConnectionBar />
                    {/* The compare tray for the lists; draws nothing until something is picked. */}
                    <CompareDock />
                    {/* One polite line per committed evolution change, with Undo. */}
                    <EvolutionNotice />
                    {/* Visible only while an Evolution Lab persona demo runs. */}
                    <DemoBanner />
                    {/* Shown once, on a first visit. */}
                    <StorageNotice />
                  </>
                )}
                {/* Onboarding, tour, voice guide and shortcuts: loaded when idle or touched. */}
                {idle && (
                  <Suspense fallback={null}>
                    <DeferredOverlays chrome={!chromeless} />
                  </Suspense>
                )}
                {/* Fetches the saved language's strings; English needs nothing. */}
                <LocaleLoader />
                {/* The Evolution Engine runtime: tracker sink, scope, persistence, AI scheduler. Draws nothing. */}
                <EvolutionRuntime />
                {/* Finishes a save, an enrolment or an application that was
                interrupted by the sign-in wall. Draws nothing by itself. */}
                <IntentResume />
              </div>
            </ToastProvider>
          </EvolutionProvider>
        </PreferencesProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
