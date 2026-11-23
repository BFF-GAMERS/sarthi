/**
 * Mounted once in __root.tsx (inside Auth/Preferences providers). Draws nothing.
 *
 * - builds the real runtime and registers it (hooks swap over from the static UNIVERSAL runtime);
 * - tracker sink, router -> route events, router onResolved -> the coordinator's arrival safe point;
 * - auth -> scope (guest / acct_*), is_minor (sync gate) and stableNav (recruiter / institute);
 * - ?evoPreview=<persona> -> an in-memory, read-only preview scope with tracking disabled;
 * - the AI scheduler starts after hydration, in idle time, never before first paint;
 * - pagehide marks an analysis as pending and pushes any waiting sync;
 * - keeps <html data-evo-*> in step with what is presented (the bootstrap script stamped the first paint).
 */
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { PERSONA_IDS } from "../config/ids";
import { stampHtml } from "../platform/dom";
import { idle } from "../platform/schedule";
import { startAiScheduler } from "../runtime/evolution/ai-scheduler";
import { subscribeRouteEvents } from "../runtime/tracker/route-events";
import { setTrackSink } from "../runtime/tracker/track";
import { registerRuntime } from "../state/commands";
import { createEvolutionRuntime, type EvolutionRuntimeHandle } from "../state/runtime";
import { fetchIsMinor } from "../sync/supabase-sync";
import type { PersonaId } from "../types";

function previewPersona(): PersonaId | null {
  try {
    const p = new URLSearchParams(window.location.search).get("evoPreview");
    return p && (PERSONA_IDS as readonly string[]).includes(p) ? (p as PersonaId) : null;
  } catch {
    return null;
  }
}

type RouterLike = {
  subscribe: (
    e: "onResolved",
    cb: (ev: { toLocation: { pathname: string } }) => void,
  ) => () => void;
};

export default function EvolutionRuntime() {
  const router = useRouter();
  const { profileId, user, ready } = useAuth();
  const [rt, setRt] = useState<EvolutionRuntimeHandle | null>(null);
  /** null = unknown. Sync stays off until profiles.is_minor is known to be false. */
  const [minor, setMinor] = useState<{ id: string; value: boolean } | null>(null);
  const aiStarted = useRef(false);
  const stopAi = useRef<(() => void) | null>(null);

  useEffect(() => {
    const runtime = createEvolutionRuntime();
    registerRuntime(runtime);
    setTrackSink(runtime.ingestBatch);
    const offRoute = subscribeRouteEvents(router);
    const offResolved = (router as unknown as RouterLike).subscribe("onResolved", (ev) =>
      runtime.setRoute(ev.toLocation.pathname),
    );
    runtime.setRoute(window.location.pathname);

    const persona = previewPersona();
    if (persona) runtime.enterSandbox("preview", persona);

    const onHide = () => runtime.onPageHide();
    window.addEventListener("pagehide", onHide);

    const off = runtime.subscribe(() => {
      const ui = runtime.getSnapshot().ui;
      stampHtml({
        state: ui.state,
        nav: ui.navMode,
        layout: ui.layout,
        density: ui.density,
        tier: ui.tier,
      });
    });
    setRt(runtime);

    return () => {
      window.removeEventListener("pagehide", onHide);
      off();
      offResolved();
      offRoute();
      setTrackSink(null);
      stopAi.current?.();
      stopAi.current = null;
      aiStarted.current = false;
      runtime.dispose();
      setRt(null);
    };
  }, [router]);

  // is_minor, read once per signed-in member (D4). The only age-related fact, and only to switch sync off.
  useEffect(() => {
    if (!profileId) {
      setMinor(null);
      return;
    }
    let live = true;
    void fetchIsMinor(profileId).then((v) => {
      if (live && v !== null) setMinor({ id: profileId, value: v });
    });
    return () => {
      live = false;
    };
  }, [profileId]);

  // Auth -> scope. Waits for the stored session check, so a returning member never flashes the guest scope.
  const stableNav = user?.role === "recruiter" || user?.role === "institute";
  const isMinor = minor && minor.id === profileId ? minor.value : true;
  useEffect(() => {
    if (!rt || !ready) return;
    rt.setAuth({ profileId, isMinor, stableNav });
    if (!aiStarted.current && rt.getSnapshot().hydrated) {
      aiStarted.current = true;
      let stop: (() => void) | null = null;
      const cancel = idle(
        () => {
          stop = startAiScheduler(rt);
        },
        { timeout: 4000 },
      );
      stopAi.current = () => {
        cancel();
        stop?.();
      };
    }
  }, [rt, ready, profileId, isMinor, stableNav]);

  return null;
}
