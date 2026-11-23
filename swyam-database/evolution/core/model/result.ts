/** A value or a typed error. Used by the validator, the commerce reducers and the demo transaction layer. */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is { readonly ok: true; readonly value: T } => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is { readonly ok: false; readonly error: E } =>
  !r.ok;

export const unwrapOr = <T, E>(r: Result<T, E>, fallback: T): T => (r.ok ? r.value : fallback);

export const mapResult = <T, U, E>(r: Result<T, E>, f: (v: T) => U): Result<U, E> =>
  r.ok ? ok(f(r.value)) : r;
