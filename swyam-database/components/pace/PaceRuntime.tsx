import { useEffect, useRef, useSyncExternalStore } from "react";
import { useLocation } from "@tanstack/react-router";
import { useEvolutionPrefs } from "../../evolution/react/hooks";
import { useReducedMotionPref } from "../motion/hooks";
import { applyPace, clearPace } from "../../lib/pace/apply";
import { getEffective } from "../../lib/pace/effective";
import { derivePace, MIN_SAMPLES } from "../../lib/pace/profile";
import { SignalCollector, attachSignals, type Totals } from "../../lib/pace/signals";
import { installSteadyGuard } from "../../lib/pace/steady-guard";
import {
  commitLearning,
  defaultData,
  diffTotals,
  getPaceData,
  getPaceEpoch,
  hydratePace,
  subscribePace,
} from "../../lib/pace/store";
import SteadyConfirm from "./SteadyConfirm";

const CHECK_MS = 4000;
/** Evaluate the profile after this many new actions, so each window holds mostly fresh evidence. */
const EVAL_STEP = 10;
const SERVER_DATA = defaultData();

const progress = (t: Totals) => t.taps + t.scrolls + t.navs;

/**
 * Starts the pace system and keeps it honest. Mount once, inside the Evolution provider and the router.
 *
 * It learns only while pace is on and Swayam's adaptation is not off, applies the result unless motion is
 * reduced, and puts every default back the moment any of that stops being true.
 */
export default function PaceRuntime() {
  const adaptiveOff = useEvolutionPrefs().adaptive === "off";
  const reduced = useReducedMotionPref();
  const data = useSyncExternalStore(subscribePace, getPaceData, () => SERVER_DATA);
  const { pathname } = useLocation();
  const path = useRef(pathname);
  const collector = useRef<SignalCollector | null>(null);

  useEffect(() => {
    hydratePace();
  }, []);

  useEffect(() => {
    applyPace({ data, adaptiveOff, reduced });
  }, [data, adaptiveOff, reduced]);

  useEffect(() => clearPace, []);

  useEffect(() => installSteadyGuard(() => getEffective().guard), []);

  // Nothing is watched while motion is reduced either: no pace is applied then, so there is nothing to learn for.
  const learning = data.enabled && !adaptiveOff && !reduced;
  useEffect(() => {
    if (!learning) return;
    const c = new SignalCollector();
    collector.current = c;
    c.routeChange(path.current, performance.now());
    const detach = attachSignals(c);

    let committed = c.totals();
    let lastVersion = c.version;
    let lastEval = 0;
    let epoch = getPaceEpoch();

    const tick = () => {
      if (document.hidden) return;
      if (getPaceEpoch() !== epoch) {
        // "Reset what it learned" was pressed: start the window over as well.
        epoch = getPaceEpoch();
        c.reset();
        committed = c.totals();
        lastVersion = c.version;
        lastEval = 0;
        return;
      }
      if (c.version === lastVersion) return;
      lastVersion = c.version;
      const totals = c.totals();
      let state = getPaceData().state;
      if (progress(totals) - lastEval >= EVAL_STEP) {
        const snap = c.snapshot();
        if (snap.samples >= MIN_SAMPLES) {
          state = derivePace(snap, state);
          lastEval = progress(totals);
        }
      }
      commitLearning(state, diffTotals(totals, committed));
      committed = totals;
    };
    const timer = window.setInterval(tick, CHECK_MS);
    return () => {
      window.clearInterval(timer);
      detach();
      collector.current = null;
    };
  }, [learning]);

  useEffect(() => {
    path.current = pathname;
    collector.current?.routeChange(pathname, performance.now());
  }, [pathname]);

  return <SteadyConfirm />;
}
