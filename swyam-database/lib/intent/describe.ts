import { NAV_REGISTRY } from "@/evolution/config/navigation";
import type { IntentMatch } from "./routes";

type Tx = (english: string) => string;

/** What a match is called in the confirm step: "remote internships", "Jobs", "search for plumber". */
export function describeMatch(match: IntentMatch, tx: Tx): string {
  const f = match.filters;
  if (match.routeId === "OPPORTUNITIES" && (f["kind"] || f["remote"] || f["free"])) {
    const nouns: Record<string, string> = {
      course: tx("courses"),
      internship: tx("internships"),
      job: tx("jobs"),
      work: tx("work"),
    };
    const noun = (f["kind"] && nouns[f["kind"]]) || tx("openings");
    return [f["free"] ? tx("free") : "", f["remote"] ? tx("remote") : "", noun]
      .filter(Boolean)
      .join(" ");
  }
  if (match.routeId === "SEARCH" && f["q"]) {
    return tx('search for "{q}"').replace("{q}", () => f["q"]!);
  }
  return tx(NAV_REGISTRY[match.routeId].label);
}

/** "Go to {what}?" with the translated frame. */
export function confirmQuestion(match: IntentMatch, tx: Tx): string {
  return tx("Go to {what}?").replace("{what}", () => describeMatch(match, tx));
}
