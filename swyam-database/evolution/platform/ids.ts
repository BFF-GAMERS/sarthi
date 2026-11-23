/** Opaque ids (session, history). Never derived from anything personal. */
function rand(n: number): string {
  let out = "";
  try {
    const bytes = new Uint8Array(n);
    globalThis.crypto.getRandomValues(bytes);
    for (const b of bytes) out += (b % 36).toString(36);
  } catch {
    for (let i = 0; i < n; i++) out += Math.floor(Math.random() * 36).toString(36);
  }
  return out;
}

export function newSessionId(now: number): string {
  return `s${Math.max(0, Math.floor(now)).toString(36)}${rand(6)}`;
}

export function newHistoryId(seq: number, now: number): string {
  return `h${Math.max(0, Math.floor(now)).toString(36)}.${seq}`;
}
