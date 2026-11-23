/** Throws when `cond` is falsy. Use for programmer errors, never for user input. */
export function assert(cond: unknown, message = "Assertion failed"): asserts cond {
  if (!cond) throw new Error(message);
}

/** Exhaustiveness check for discriminated unions and enum switches. */
export function assertNever(x: never, message = "Unexpected value"): never {
  throw new Error(`${message}: ${JSON.stringify(x)}`);
}

/** Narrows away null/undefined or throws. */
export function defined<T>(x: T | null | undefined, message = "Expected a value"): T {
  if (x === null || x === undefined) throw new Error(message);
  return x;
}

/** Recursively freezes plain objects and arrays (dev tables, constants). Returns the same reference. */
export function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}
