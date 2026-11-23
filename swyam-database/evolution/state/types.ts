/**
 * Store / runtime contract (plan §3.5, §4.1). The persistence lane implements
 * EvolutionRuntimeApi with zustand persisted stores, scoped keys, cross-tab
 * sync, presenter and coordinator. Every other lane talks to the engine at
 * runtime ONLY through this interface (via getRuntime() in state/commands.ts)
 * or the React hooks in react/hooks.ts.
 *
 * Rules: track() never awaits this; React state changes only on committed
 * snapshots; the AI never blocks; nothing here reads profile type, age,
 * region or any sensitive attribute.
 */
import type { AnalyzerAdvice } from "../core/analyzer/types";
import type { EngineState } from "../core/evolution/engine";
import type {
  AdaptiveSetting,
  AiStatus,
  BehaviourEvent,
  DecisionSource,
  EvolutionSnapshot,
  EvolutionSnapshotRef,
  PersonaId,
  ReasonCode,
  TrackInput,
  UIState,
} from "../types";

export interface AuthContextForEvolution {
  /** null = visitor (guest scope). Hashed to acct_<8 hex> by the store; never stored raw. */
  profileId: string | null;
  /** D4: no server sync for minors. On-device adaptation still works and is disclosed. */
  isMinor: boolean;
  /** D5: recruiter/institute keep stable navigation. Read from profile type ONLY for this flag. */
  stableNav: boolean;
}

/** What a transient preview can show: a past structure (Time-Scrub) or a persona's tier-3 structure (Try-On). */
export type PreviewTarget = EvolutionSnapshotRef | PersonaId;

/** "scrub" = Time-Scrub slider, "hold" = press-and-hold on the chip, "tryon" = Try On Another Swayam. */
export type PreviewSource = "scrub" | "hold" | "tryon";

export interface PreviewOptions {
  source?: PreviewSource;
  /** Auto-clear after this many ms (Try-On uses about 8 s). Omitted = stays until cleared. */
  ttlMs?: number;
  /** Shown with a scrubbed stop; only the reason and confidence the engine stored for it. */
  reasonCode?: ReasonCode;
  confidence?: number;
}

/**
 * A transient plan override. It lives in memory only: it is never written to storage, never synced and never
 * fed to the engine. useHomePlan / useNavPlan return `ui` while it is set.
 */
export interface PreviewPlan {
  /** Monotonic per runtime: a new preview, or a moved scrub stop, always has a new id. */
  id: number;
  source: PreviewSource;
  ref: EvolutionSnapshotRef;
  persona: PersonaId | null;
  ui: UIState;
  reasonCode: ReasonCode;
  confidence: number;
  startedAt: number;
  /** When the auto-clear fires, or null. */
  expiresAt: number | null;
}

export interface EvolutionCommands {
  /** Clears events and profile. Non-evolution swayam-* keys stay byte-identical. */
  resetBehaviour(): void;
  /** Engine epoch + 1, decision → UNIVERSAL; keeps events. */
  resetEvolution(): void;
  /** Both, plus remote delete when synced. The WhyPanel's "Reset my experience". */
  resetExperience(): void;
  /** "Keep my current layout": learning continues, structure frozen. */
  setLocked(locked: boolean): void;
  setAdaptive(setting: AdaptiveSetting): void;
  /** Undo the last committed change (vetoes that renderKey). */
  undo(): void;
  /**
   * Show another structure on the real Home and navigation, transiently. Nothing is persisted; it is dropped
   * on a route change, on any tracked event, on any command that changes the experience, and on its ttl.
   */
  previewPlan(target: PreviewTarget, opts?: PreviewOptions): void;
  /** Drop the preview and return to the live plan. */
  clearPreview(): void;
  /**
   * Make the previewed structure the arrangement ("Restore this layout", "Make this mine"): presents it
   * and uses the existing Keep path (locked) so learning continues but the structure holds.
   */
  commitPreview(): void;
}

export interface EvolutionRuntimeApi extends EvolutionCommands {
  getSnapshot(): EvolutionSnapshot;
  /** Server/SSR snapshot: always UNIVERSAL, visitor, not hydrated. */
  getServerSnapshot(): EvolutionSnapshot;
  subscribe(listener: () => void): () => void;

  /** Tracker sink: one batch per idle flush (runtime/tracker). Ignored when adaptive === 'off'. */
  ingestBatch(batch: readonly TrackInput[]): void;
  /** Synchronous ingest for the persona player; source 'persona' is released instantly. */
  ingestNow(input: TrackInput, source?: DecisionSource): void;
  /** Force a session boundary (persona player between journey sessions). */
  newSession(): void;

  /** Read-only views for the AI lane and the Lab. */
  getEngineState(): EngineState;
  getEvents(): readonly BehaviourEvent[];

  /** The transient override (or null). Identity is stable until it changes. */
  getPreview(): PreviewPlan | null;
  subscribePreview(listener: () => void): () => void;

  /** AI lane: merged advice (core/analyzer/merge.ts) → engine.applyAdvice → hysteresis. */
  applyAdvice(advice: AnalyzerAdvice): void;
  setAiStatus(patch: Partial<AiStatus>): void;

  setAuth(auth: AuthContextForEvolution): void;

  /**
   * Lab sandbox. 'lab': switch to the persisted lab scope and reset it (never synced;
   * the real scope is untouched). 'preview': in-memory, read-only preview_<persona> scope
   * folded from the persona journey, tracking disabled, no storage writes (/lab/compare iframes).
   */
  enterSandbox(kind: "lab" | "preview", persona: PersonaId | null): void;
  exitSandbox(): void;
}
