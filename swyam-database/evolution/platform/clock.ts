/** The ONLY Date.now() in the evolution runtime. Tests fake it (vi.spyOn(clock, "now") or fake timers). */
export const clock: { now(): number } = {
  now: () => Date.now(),
};
