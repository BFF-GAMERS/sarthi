/**
 * /lab: the Evolution Lab (plan §6). It opens on the demo itself: the persona picker with
 * its play controls and a live Before/After, so one tap shows the structure changing. Then
 * what Swayam has learned on this device, how its structure changed and why, a replay and
 * the resets. /lab?play=<persona> (career, learning, skills, community, fast, or a full
 * persona id) starts that persona on arrival with the real streaming choreography.
 * Everything here is wrapped in <TrackingScope disabled>, so using the Lab never trains
 * the engine, and nothing on this page emits a tracking event.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";
import AiDecisionCard from "@/components/evolution/lab/AiDecisionCard";
import BeforeAfter from "@/components/evolution/lab/BeforeAfter";
import BehaviourBars from "@/components/evolution/lab/BehaviourBars";
import HistoryTimeline from "@/components/evolution/lab/HistoryTimeline";
import LabControls from "@/components/evolution/lab/LabControls";
import { labStatusLine, resolvePlayParam } from "@/components/evolution/lab/labModel";
import PatternCard from "@/components/evolution/lab/PatternCard";
import PersonaPicker from "@/components/evolution/lab/PersonaPicker";
import ReplayPlayer from "@/components/evolution/lab/ReplayPlayer";
import StructureDiagram from "@/components/evolution/lab/StructureDiagram";
import TraitBars from "@/components/evolution/lab/TraitBars";
import { useReplay } from "@/components/evolution/lab/useReplay";
import { useRunningPersona } from "@/components/evolution/lab/useRunningPersona";
import { useEvolutionSnapshot } from "@/evolution/react/hooks";
import { TrackingScope } from "@/evolution/runtime/tracker/TrackingScope";
import { startPersona } from "@/evolution/runtime/evolution/sandbox";
import type { PersonaId } from "@/evolution/types";

export default function EvolutionLab() {
  return (
    <TrackingScope disabled>
      <LabBody />
    </TrackingScope>
  );
}

function LabBody() {
  const { user } = useAuth();
  const signedIn = !!user;
  const snap = useEvolutionSnapshot();
  const running = useRunningPersona();
  const [persona, setPersona] = useState<PersonaId | null>(running);
  const replay = useReplay(signedIn, snap.ui.locked);
  const ui = replay.view?.ui ?? snap.ui;

  const pick = (id: PersonaId) => {
    replay.stop();
    setPersona(id);
    startPersona(id);
  };

  // ?play=<persona>: start it once, after the real runtime is up (before that the hooks
  // read the static universal stub, and a sandbox started on it would go nowhere).
  const played = useRef<PersonaId | null>(null);
  const hydrated = snap.hydrated;
  useEffect(() => {
    if (!hydrated) return;
    let target: PersonaId | null = null;
    try {
      target = resolvePlayParam(new URLSearchParams(window.location.search).get("play"));
    } catch {
      target = null;
    }
    if (!target || played.current === target) return;
    played.current = target;
    setPersona(target);
    startPersona(target);
  }, [hydrated]);

  const demo = snap.status.demo;
  const replaying = replay.view !== null;
  const status = labStatusLine({
    demo,
    running,
    replayStep:
      replaying && replay.state ? { index: replay.state.index, total: replay.state.total } : null,
    state: ui.state,
    tier: ui.tier,
  });
  const evolved = !running && !replaying && demo !== null && ui.tier >= 1;

  return (
    <div className="container-x pb-24 pt-24 sm:pt-28" data-evo-lab>
      <header className="evo-lab-head max-w-2xl">
        <p className="datum">Evolution Lab</p>
        <h1 className="section-title mt-2">See how स्वYAM arranges itself</h1>
        <p className="mt-3 hidden font-body text-[14.5px] leading-relaxed text-ink-soft sm:block">
          स्वYAM learns from what you do here, on this device, to arrange itself. Nothing is sold or
          shared, and no sensitive attribute is used.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-body text-[13.5px] font-semibold">
          <Link to="/lab/compare" className="text-saffron-700 underline-offset-2 hover:underline">
            Two people, side by side
          </Link>
          <Link to="/privacy" className="text-saffron-700 underline-offset-2 hover:underline">
            What is kept
          </Link>
        </p>
      </header>

      <div className="evo-lab-stage mt-5" data-lab="stage">
        <PersonaPicker
          selected={persona}
          running={running}
          status={status}
          evolved={evolved}
          onPick={pick}
          onReplay={replay.start}
        />
        <BeforeAfter after={ui} signedIn={signedIn} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ReplayPlayer replay={replay} />
        <PatternCard />
        <BehaviourBars />
        <TraitBars />
        <AiDecisionCard />
        <StructureDiagram ui={ui} signedIn={signedIn} replaying={replaying} />
        <HistoryTimeline history={replay.view?.history} replaying={replaying} />
        <LabControls />
      </div>
    </div>
  );
}
