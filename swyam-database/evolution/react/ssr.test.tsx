// SSR: the server (and the hydration pass) always renders UNIVERSAL and "not hydrated", whatever the device
// has stored, so there is no hydration mismatch; the evolved structure arrives with the client snapshot.
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import AdaptingIndicator from "../../components/evolution/AdaptingIndicator";
import EvolutionNotice from "../../components/evolution/EvolutionNotice";
import TimeScrub from "../../components/evolution/TimeScrub";
import TryOn from "../../components/evolution/TryOn";
import WhyPanel from "../../components/evolution/WhyPanel";
import YourSwayamSettings from "../../components/evolution/YourSwayamSettings";
import { EvolutionStage } from "../../components/motion/EvolutionStage";
import { actionsFor } from "../core/evolution/compose";
import { createEngine } from "../core/evolution/engine";
import { createLocalAdapter, type WindowLike } from "../platform/storage/local";
import { keyOf } from "../platform/storage/keys";
import { createFakeWindow, FakeStorage } from "../platform/testing/fake-window";
import { registerRuntime } from "../state/commands";
import { defaultSnapshot } from "../state/defaults";
import { createEvolutionRuntime, type EvolutionRuntimeHandle } from "../state/runtime";
import {
  useEvolutionHydrated,
  useEvolutionStatus,
  useHomePlan,
  useNavPlan,
  useUiState,
} from "./hooks";

function Probe() {
  const ui = useUiState();
  const nav = useNavPlan();
  const home = useHomePlan();
  const status = useEvolutionStatus();
  const hydrated = useEvolutionHydrated();
  return (
    <p>{`${ui.state}|${ui.tier}|${hydrated}|${nav.top.join(",")}|${home.sections[0]?.id}|${status.label}`}</p>
  );
}

let live: EvolutionRuntimeHandle | null = null;
afterEach(() => {
  live?.dispose();
  live = null;
});

function careerRuntime() {
  const scope = "guest";
  const decision = {
    primaryState: "CAREER_FIRST",
    behaviourMode: "CAREER_FOCUSED",
    navigationMode: "CAREER_PRIORITY",
    homepageLayout: "CAREER_DISCOVERY",
    priorityActions: actionsFor("CAREER_FIRST", 3),
    reason: "Arranged around what you do most.",
    confidence: 0.86,
  };
  const committed = {
    rev: 2,
    decision,
    tier: 3,
    reasonCode: { key: "DOMAIN_CONFIRMED" },
    source: "deterministic",
    at: 1,
  };
  const ls = new FakeStorage();
  ls.map.set(
    keyOf(scope, "engine"),
    JSON.stringify({
      state: {
        engine: { ...createEngine(scope), decision, tier: 3 },
        rev: 2,
        presented: committed,
        sessionId: "old",
        committedSource: "deterministic",
        committedAt: 1,
        updatedAt: 1,
        syncedAt: null,
      },
      version: 1,
    }),
  );
  const rt = createEvolutionRuntime({
    adapter: createLocalAdapter(createFakeWindow(ls) as unknown as WindowLike),
    session: { read: () => null, write: () => {} },
    sync: null,
    coordinatorPorts: { every: () => () => {}, later: () => () => {} },
  });
  rt.setAuth({ profileId: null, isMinor: false, stableNav: false });
  return rt;
}

describe("server rendering", () => {
  it("renders UNIVERSAL, not hydrated, with the static runtime", () => {
    const u = defaultSnapshot();
    const html = renderToString(<Probe />);
    expect(html).toContain(`UNIVERSAL|0|false|${u.ui.navigation.top.join(",")}|`);
  });

  it("renders the SAME markup after a real runtime restored an evolved state (no hydration mismatch)", () => {
    const before = renderToString(<Probe />);
    live = careerRuntime();
    expect(live.getSnapshot().ui.state).toBe("CAREER_FIRST"); // the client really is evolved
    registerRuntime(live);
    expect(renderToString(<Probe />)).toBe(before); // yet the server pass is unchanged
  });

  it("the chip renders nothing until hydrated; the notice region is an empty polite live region", () => {
    expect(renderToString(<AdaptingIndicator variant="nav" />)).toBe("");
    const notice = renderToString(<EvolutionNotice />);
    expect(notice).toContain('role="status"');
    expect(notice).toContain('aria-live="polite"');
    expect(notice).not.toContain('evo-notice"');
  });

  it("Settings shows the three choices, a disabled group before hydration, and no delete-copy button", () => {
    const html = renderToString(<YourSwayamSettings />);
    expect(html).toContain("Your Swayam");
    expect(html).toContain("Keep current layout");
    expect(html).toContain("Reset my experience");
    expect(html).toContain('id="your-swayam"');
    expect(html).not.toContain("Delete synced copy");
    expect(html).toMatch(/<fieldset[^>]*disabled/);
  });
});

describe("transient plan override on the server", () => {
  it("a preview never changes the server render (no hydration mismatch)", () => {
    const before = renderToString(<Probe />);
    live = careerRuntime();
    registerRuntime(live);
    live.previewPlan("learning-explorer", { source: "tryon", ttlMs: 8000 });
    expect(live.getPreview()?.ui.state).toBe("LEARNING_FIRST");
    expect(renderToString(<Probe />)).toBe(before);
  });

  it("the Stage, Try-On, Time-Scrub and the panel render safely with nothing to show", () => {
    const stage = renderToString(
      <EvolutionStage
        groupId="ssr-stage"
        items={["a", "b", "c"]}
        getKey={(x) => x}
        renderItem={(x) => <b>{x}</b>}
      />,
    );
    expect(stage).toContain("data-evo-item");
    expect(stage).not.toContain("data-evo-ghost");
    const tryOn = renderToString(<TryOn />);
    for (const chip of ["Learner", "Career", "Skills", "Community"]) expect(tryOn).toContain(chip);
    expect(tryOn).toContain("Try on another Swayam");
    expect(renderToString(<TimeScrub />)).toContain("Nothing to replay yet");
    expect(renderToString(<WhyPanel />)).toBe("");
  });
});
