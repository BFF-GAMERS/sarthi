/**
 * "Demo: Career Seeker · See Home · Exit", visible app-wide while a Lab persona runs (plan §6).
 * CONTRACT: default export, no props; mounted in __root.tsx. Reads useEvolutionStatus().demo.
 * Plain links and buttons, never tracked and never blocking: the demo only changes the
 * sandbox scope, and Exit returns to the user's real experience.
 *
 * Inside a /lab/compare frame (?evoPreview=) the banner is a read-only label with no
 * actions, anchored to the top of the page instead of floating. While any demo shows,
 * html[data-evo-demo] reserves a band at the top of the page (evo-lab.css), so the banner
 * never sits on top of the hero eyebrow.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PERSONAS } from "@/evolution/core/fixtures/journeys";
import { useEvolutionStatus } from "@/evolution/react/hooks";
import { exitDemo } from "@/evolution/runtime/evolution/sandbox";

/** True when this page is a read-only compare frame. Read after mount, so SSR and hydration agree. */
function useIsPreviewFrame(): boolean {
  const [framed, setFramed] = useState(false);
  useEffect(() => {
    try {
      setFramed(new URLSearchParams(window.location.search).has("evoPreview"));
    } catch {
      setFramed(false);
    }
  }, []);
  return framed;
}

export default function DemoBanner() {
  const { demo } = useEvolutionStatus();
  const framed = useIsPreviewFrame();
  const kind = demo ? (framed ? "preview" : "lab") : null;

  useEffect(() => {
    if (!kind) return;
    const el = document.documentElement;
    el.dataset["evoDemo"] = kind;
    return () => {
      delete el.dataset["evoDemo"];
    };
  }, [kind]);

  if (!demo) return null;
  if (framed) {
    return (
      <div
        role="status"
        data-evo-demo-banner="preview"
        className="evo-demo evo-demo--frame font-body"
      >
        <span className="font-semibold">Preview: {PERSONAS[demo].label}</span>
        <span aria-hidden>·</span>
        <span className="text-ink-soft">read-only</span>
      </div>
    );
  }
  return (
    <div role="status" data-evo-demo-banner="lab" className="evo-demo font-body">
      <span className="font-semibold">Demo: {PERSONAS[demo].label}</span>
      <span aria-hidden>·</span>
      <Link
        to="/"
        className="font-semibold text-saffron-700 underline-offset-2 hover:underline"
        data-evo-demo-home
      >
        See Home
      </Link>
      <span aria-hidden>·</span>
      <button
        type="button"
        onClick={exitDemo}
        className="rounded-full px-1.5 font-semibold text-ink-soft hover:text-ink"
      >
        Exit
      </button>
    </div>
  );
}
