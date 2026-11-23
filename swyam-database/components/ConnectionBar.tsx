import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTx } from "../lib/i18n";
import { usePacks } from "../lib/offline/store";
import { registerOfflineSw } from "../lib/offline/sw-register";

/**
 * "You are offline" — said once, quietly, with what still works.
 *
 * A dropped connection used to show up as a page of spinners that never
 * resolved, or an error in the middle of a course. On a ₹200-a-month data
 * pack that is a normal Tuesday, not an edge case, so it gets a real state:
 * one line at the top of the page, what is still usable, and a retry that
 * actually refetches rather than reloading and losing the place.
 *
 * It says nothing at all while the connection is fine.
 *
 * When lessons have been downloaded for offline study it says so, and links to
 * them. Those links are plain anchors on purpose: a full page load is what the
 * offline service worker can answer from its cache, where a client-side route
 * change would ask the network for code it may not have.
 */
export default function ConnectionBar() {
  const tx = useTx();
  const qc = useQueryClient();
  // Assume online until the browser says otherwise: a false negative here
  // would put a warning over a page that is working.
  const [online, setOnline] = useState(true);
  const [justBack, setJustBack] = useState(false);
  const { packs, ready: packsReady } = usePacks();
  const hasPacks = packsReady && packs.length > 0;

  // The offline page cache is only worth having once something is downloaded.
  // Registered after hydration, feature-detected, and a no-op if already done.
  useEffect(() => {
    if (hasPacks) void registerOfflineSw();
  }, [hasPacks]);

  useEffect(() => {
    const goOffline = () => {
      setOnline(false);
      setJustBack(false);
    };
    const goOnline = () => {
      setOnline(true);
      setJustBack(true);
      // Anything that failed while the connection was gone can succeed now.
      void qc.refetchQueries({ type: "active" });
      window.setTimeout(() => setJustBack(false), 4000);
    };
    setOnline(navigator.onLine);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [qc]);

  if (online && !justBack) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 top-[calc(var(--nav-h)+1rem)] z-[70] mx-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border p-3 shadow-[var(--shadow-float)] ${
        online ? "border-emeraldx-400/40 bg-paper-light" : "border-saffron-300 bg-paper-light"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
            online ? "bg-emeraldx-400/12 text-emeraldx-400" : "bg-saffron-50 text-saffron-600"
          }`}
        >
          {online ? <Wifi size={15} /> : <CloudOff size={15} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-[13.5px] font-semibold text-ink">
            {online ? tx("Back online") : tx("You are offline")}
          </p>
          <p className="mt-0.5 font-body text-[12.5px] leading-relaxed text-ink-mute">
            {online
              ? tx("Everything on this page has been refreshed.")
              : hasPacks
                ? tx(
                    "Lessons you downloaded still work. Saving, notes and applying need the connection back.",
                  )
                : tx(
                    "Pages you have already opened still work, and anything you type is kept on this device. Saving and applying need the connection back.",
                  )}
          </p>
          {!online && hasPacks && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-[12.5px]">
              {packs.slice(0, 2).map((p) => (
                <a
                  key={p.courseSlug}
                  href={`/learn/${encodeURIComponent(p.courseSlug)}`}
                  className="inline-flex min-h-[44px] max-w-full items-center break-words font-medium text-saffron-700 underline underline-offset-2"
                >
                  {tx("Open")} {p.title}
                </a>
              ))}
              <Link
                to="/my-learning"
                className="inline-flex min-h-[44px] items-center font-medium text-saffron-700 underline underline-offset-2"
              >
                {tx("My downloads")}
              </Link>
            </p>
          )}
        </div>
        {!online && (
          <button
            type="button"
            onClick={() => void qc.refetchQueries({ type: "active" })}
            className="btn-ghost min-h-[44px] shrink-0 !px-3 !py-1.5 !text-[11px]"
          >
            <RefreshCw size={12} aria-hidden /> {tx("Retry")}
          </button>
        )}
      </div>
    </div>
  );
}
