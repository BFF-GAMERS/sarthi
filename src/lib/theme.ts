export type Mode = "millennial" | "genz";

const KEY = "swyam.theme";

export function getMode(): Mode {
  try {
    return localStorage.getItem(KEY) === "genz" ? "genz" : "millennial";
  } catch {
    return "millennial";
  }
}

export function setMode(m: Mode): void {
  document.documentElement.dataset.mode = m;
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* storage unavailable: the mode still applies for this page view */
  }
}

export function initTheme(): void {
  setMode(getMode());
}
