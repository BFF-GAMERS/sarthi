/**
 * Two people, two Swayams (plan §6.2): the real app, twice, in same-origin iframes.
 * The runtime folds each persona's journey into an in-memory, read-only preview scope
 * (/?evoPreview=<persona>), so neither frame tracks or writes anything.
 *
 * Once a frame's Home has hydrated at its final tier, the frame scrolls to the first Home
 * section where the two personas diverge (or back to the top, by the "Show" switch), so the
 * two frames differ above the fold, not only far down the page. "What differs" fills the
 * width the frames leave free. Phone = 390px wide; Desktop = 1280px scaled to fit (0.5 at
 * most). Below 1024px the frames share one column and tabs choose which is shown.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { EVOLUTION_CONFIG } from "@/evolution/config/evolution-config";
import { SECTION_META } from "@/evolution/config/sections";
import { PERSONAS } from "@/evolution/core/fixtures/journeys";
import type { PersonaId, SectionId } from "@/evolution/types";
import { compareUis, experienceLabel, personaUi, previewSrc } from "./labModel";
import WhatDiffers from "./WhatDiffers";

const FRAMES: readonly [PersonaId, PersonaId] = ["learning-explorer", "career-seeker"];
type Device = "phone" | "desktop";
type Focus = "diff" | "top";
type Phase = "loading" | "ready" | "slow";

const PHONE = { w: 390, h: 780 };
const DESKTOP = { w: 1280, h: 800, max: 0.5 };
/** Room kept above the target section for the frame's own top bar. */
const SCROLL_OFFSET = 92;
const POLL_MS = 300;
const GIVE_UP_MS = 30_000;

function useFitScale(max: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(max);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const fit = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.max(0.2, Math.min(max, w / DESKTOP.w)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [max]);
  return { ref, scale };
}

/** True at 1024px and up, where both frames show side by side and the tabs are hidden. */
function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

/** True once the frame's Home hydrated and reached at least `tier` (the real plan, from the DOM). */
function frameReady(frame: HTMLIFrameElement | null, tier: number): boolean {
  try {
    const home = frame?.contentDocument?.querySelector('[data-evo-region="home"]');
    return (
      !!home &&
      home.getAttribute("data-hydrated") === "true" &&
      Number(home.getAttribute("data-tier")) >= tier &&
      !!home.querySelector("[data-section]")
    );
  } catch {
    return false;
  }
}

/** The Home sections a frame really drew, top to bottom (folded ones live inside "More for you"). */
function renderedOrder(frame: HTMLIFrameElement | null): SectionId[] {
  try {
    const home = frame?.contentDocument?.querySelector('[data-evo-region="home"]');
    if (!home) return [];
    return [...home.children]
      .map((el) => el.getAttribute("data-section"))
      .filter(
        (id): id is SectionId =>
          !!id && id !== "MORE_FOR_YOU" && Object.prototype.hasOwnProperty.call(SECTION_META, id),
      );
  } catch {
    return [];
  }
}

/** Scroll a frame so `section` sits just under its top bar, or to the top when null. */
function scrollFrame(frame: HTMLIFrameElement | null, section: SectionId | null, smooth: boolean) {
  try {
    const win = frame?.contentWindow;
    const doc = frame?.contentDocument;
    if (!win || !doc) return;
    const behavior: ScrollBehavior = smooth ? "smooth" : "auto";
    if (!section) {
      win.scrollTo({ top: 0, behavior });
      return;
    }
    const el =
      doc.querySelector(`[data-evo-region="home"] > [data-section="${section}"]`) ??
      doc.querySelector('[data-evo-region="home"] > [data-section]');
    if (!el) return;
    const top = el.getBoundingClientRect().top + win.scrollY - SCROLL_OFFSET;
    win.scrollTo({ top: Math.max(0, Math.round(top)), behavior });
  } catch {
    /* A frame that cannot be scrolled just stays at the top. */
  }
}

const prefersReduced = (): boolean => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
};

function Frame({
  id,
  device,
  active,
  shown,
  reloadKey,
  target,
  focus,
  settled,
  onRendered,
}: {
  id: PersonaId;
  device: Device;
  active: boolean;
  /** Laid out at all: the chosen tab below 1024px, both frames above it. */
  shown: boolean;
  reloadKey: number;
  target: SectionId | null;
  focus: Focus;
  /** Both frames drew their Home, so the first difference is known: safe to scroll. */
  settled: boolean;
  /** Reports the order the frame drew once it settled, and null while it (re)loads. */
  onRendered: (id: PersonaId, order: SectionId[] | null) => void;
}) {
  const p = PERSONAS[id];
  const { ref, scale } = useFitScale(DESKTOP.max);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  /** Bumped on every (re)load of the frame's document, so a reload inside it restarts the wait. */
  const [loads, setLoads] = useState(0);
  const desktop = device === "desktop";
  const want = focus === "diff" ? target : null;

  // Wait for the frame's Home to hydrate at its final tier (restarts on reload and when shown).
  useEffect(() => {
    if (!shown) return;
    setPhase("loading");
    onRendered(id, null);
    const started = Date.now();
    const timer = setInterval(() => {
      if (frameReady(frameRef.current, p.expected.tier)) {
        clearInterval(timer);
        onRendered(id, renderedOrder(frameRef.current));
        setPhase("ready");
      } else if (Date.now() - started > GIVE_UP_MS) {
        clearInterval(timer);
        setPhase("slow");
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [shown, reloadKey, loads, device, id, p.expected.tier, onRendered]);

  // Auto-scroll once ready, and again when the Show switch changes. A second pass after the
  // frame's images and fonts settle keeps the target in place, unless the person has scrolled.
  useEffect(() => {
    if (phase !== "ready" || !settled) return;
    const frame = frameRef.current;
    let touched = false;
    const mark = () => {
      touched = true;
    };
    let win: Window | null = null;
    try {
      win = frame?.contentWindow ?? null;
    } catch {
      win = null;
    }
    const evts = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    evts.forEach((e) => win?.addEventListener(e, mark, { passive: true }));
    scrollFrame(frame, want, !prefersReduced());
    const settle = setTimeout(() => {
      if (!touched) scrollFrame(frame, want, false);
    }, 900);
    return () => {
      clearTimeout(settle);
      evts.forEach((e) => win?.removeEventListener(e, mark));
    };
  }, [phase, settled, want]);

  const note =
    phase === "loading"
      ? "Reaching its final arrangement…"
      : phase === "slow"
        ? "This preview is slow to load. Try Reload both."
        : !settled
          ? "Waiting for the other frame…"
          : want
            ? `Scrolled to "${SECTION_META[want].title}", where the two first differ.`
            : "Top of Home.";

  return (
    <figure className="evo-frame min-w-0" data-active={active} data-frame={id} data-phase={phase}>
      <figcaption className="mb-2">
        <span className="font-body text-[14px] font-semibold text-ink">{p.label}</span>
        <span className="ml-2 font-mono text-[11px] text-ink-mute">
          {experienceLabel(
            EVOLUTION_CONFIG.states[p.expected.state].label,
            EVOLUTION_CONFIG.modeLabels[p.expected.mode],
          )}
        </span>
        <span className="evo-frame__note" role="status">
          {note}
        </span>
      </figcaption>
      <div
        ref={ref}
        className="evo-frame__stage"
        style={{
          width: desktop ? "100%" : `min(${PHONE.w}px, 100%)`,
          height: desktop ? DESKTOP.h * scale : PHONE.h,
        }}
      >
        <iframe
          ref={frameRef}
          key={`${id}-${reloadKey}`}
          onLoad={() => setLoads((n) => n + 1)}
          title={`स्वYAM as ${p.label}`}
          src={previewSrc(id)}
          loading="lazy"
          className="evo-frame__iframe"
          style={
            desktop
              ? {
                  width: DESKTOP.w,
                  height: DESKTOP.h,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }
              : { width: "100%", height: PHONE.h }
          }
        />
      </div>
      <a
        href={previewSrc(id)}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block font-body text-[12.5px] font-semibold text-saffron-700 underline-offset-2 hover:underline"
      >
        Open full size
      </a>
    </figure>
  );
}

export default function CompareFrames() {
  const { user } = useAuth();
  const signedIn = !!user;
  const [device, setDevice] = useState<Device>("phone");
  const [focus, setFocus] = useState<Focus>("diff");
  const [tab, setTab] = useState<PersonaId>(FRAMES[0]);
  const [reloadKey, setReloadKey] = useState(0);
  const wide = useWide();

  const [rendered, setRendered] = useState<Partial<Record<PersonaId, SectionId[]>>>({});
  const onRendered = useCallback((id: PersonaId, order: SectionId[] | null) => {
    setRendered((cur) => {
      if (!order && !cur[id]) return cur;
      const next = { ...cur };
      if (order) next[id] = order;
      else delete next[id];
      return next;
    });
  }, []);

  // Scroll only once both frames drew, so the first difference is read from what is on screen.
  const bothRendered = !!(rendered[FRAMES[0]] && rendered[FRAMES[1]]);
  const anyRendered = !!(rendered[FRAMES[0]] || rendered[FRAMES[1]]);
  const [grace, setGrace] = useState(false);
  useEffect(() => {
    setGrace(false);
    if (!anyRendered || bothRendered) return;
    const t = setTimeout(() => setGrace(true), 6000);
    return () => clearTimeout(t);
  }, [anyRendered, bothRendered]);
  const settled = !wide || bothRendered || grace;

  const model = useMemo(() => {
    const ctx = { signedIn, stableNav: false, locked: false };
    const a = rendered[FRAMES[0]];
    const b = rendered[FRAMES[1]];
    return compareUis(
      personaUi(FRAMES[0], ctx),
      personaUi(FRAMES[1], ctx),
      6,
      a && b ? { a, b } : null,
    );
  }, [signedIn, rendered]);
  // A frame scrolls to the section the plan names, unless it did not draw it (Home leaves out
  // sections with nothing to show), in which case it takes the section at the same position.
  const targetFor = (id: PersonaId, planned: SectionId | null): SectionId | null => {
    const own = rendered[id];
    if (!own || own.length === 0 || (planned && own.includes(planned))) return planned;
    return own[Math.max(0, model.firstIndex)] ?? own[0] ?? planned;
  };
  const targets: Record<string, SectionId | null> = {
    [FRAMES[0]]: targetFor(FRAMES[0], model.targetA),
    [FRAMES[1]]: targetFor(FRAMES[1], model.targetB),
  };

  return (
    <div data-compare>
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Device size" className="flex gap-1.5">
          {(["phone", "desktop"] as const).map((d) => (
            <button
              key={d}
              type="button"
              className="filter-pill !h-9 !px-3 !text-[12.5px]"
              aria-pressed={device === d}
              onClick={() => setDevice(d)}
            >
              {d === "phone" ? "Phone" : "Desktop"}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Show" className="flex items-center gap-1.5">
          <span className="font-body text-[12.5px] text-ink-mute">Show</span>
          {(
            [
              ["diff", "First difference"],
              ["top", "Top of Home"],
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              className="filter-pill !h-9 !px-3 !text-[12.5px]"
              aria-pressed={focus === f}
              onClick={() => setFocus(f)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn-ghost !px-3 !py-2 !text-[12.5px]"
          onClick={() => setReloadKey((n) => n + 1)}
        >
          Reload both
        </button>
      </div>

      <div role="tablist" aria-label="Persona" className="evo-compare-tabs mt-4 gap-1.5">
        {FRAMES.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className="filter-pill !h-9 !px-3 !text-[12.5px]"
            onClick={() => setTab(id)}
          >
            {PERSONAS[id].label}
          </button>
        ))}
      </div>

      <div className="evo-compare mt-4" data-device={device}>
        {FRAMES.map((id) => (
          <Frame
            key={id}
            id={id}
            device={device}
            active={tab === id}
            shown={wide || tab === id}
            reloadKey={reloadKey}
            target={targets[id] ?? null}
            focus={focus}
            settled={settled}
            onRendered={onRendered}
          />
        ))}
        <WhatDiffers a={FRAMES[0]} b={FRAMES[1]} model={model} />
      </div>
    </div>
  );
}
